import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface CSVRow {
  main_category: string;
  sub_category: string;
  detail_category: string;
  question: string;
  answer: string;
  usage: string;
  note: string;
}

interface TemplateData {
  title: string;
  content: string;
  category: string;
  intent: string;
  tone: string;
  variables: any;
  metadata: any;
}

// マッピング規則（修正版）
const categoryMapping: Record<string, string> = {
  '利用の流れ': 'reservation',
  '予約関連': 'reservation',
  '車両関連': 'vehicle',
  '送迎関連': 'shuttle',
  '料金関連': 'payment',
  '記入情報': 'information',
  '利用制限': 'disclaimer',
  '免責約款': 'disclaimer',
  'アクセス': 'access'
};

const intentMapping: Record<string, string> = {
  '確認': 'check',
  '教えて': 'inquiry',
  '知りたい': 'check',
  '予約': 'create',
  '変更': 'modify',
  '取消': 'cancel',
  '報告': 'report'
};

const toneMapping: Record<string, string> = {
  '緊急': 'urgent',
  '急': 'urgent',
  '今すぐ': 'urgent',
  '将来': 'future',
  '改定': 'future',
  '予定': 'future'
};

function analyzeQuery(query: string): { category: string; intent: string; tone: string } {
  const lowerQuery = query.toLowerCase();
  
  // カテゴリ判定
  let category = 'other';
  if (lowerQuery.includes('駐車') || lowerQuery.includes('パーキング')) {
    category = 'reservation';
  } else if (lowerQuery.includes('支払') || lowerQuery.includes('料金') || lowerQuery.includes('お金')) {
    category = 'payment';
  } else if (lowerQuery.includes('送迎') || lowerQuery.includes('シャトル')) {
    category = 'shuttle';
  } else if (lowerQuery.includes('車') || lowerQuery.includes('車両')) {
    category = 'vehicle';
  } else if (lowerQuery.includes('記入') || lowerQuery.includes('入力')) {
    category = 'information';
  } else if (lowerQuery.includes('制限') || lowerQuery.includes('免責')) {
    category = 'disclaimer';
  } else if (lowerQuery.includes('アクセス') || lowerQuery.includes('場所')) {
    category = 'access';
  }
  
  // 意図判定
  let intent = 'inquiry';
  if (lowerQuery.includes('確認')) {
    intent = 'check';
  } else if (lowerQuery.includes('教えて')) {
    intent = 'inquiry';
  } else if (lowerQuery.includes('予約') && (lowerQuery.includes('必要') || lowerQuery.includes('したい'))) {
    intent = 'create';
  } else if (lowerQuery.includes('知りたい')) {
    intent = 'check';
  }
  
  // トーン判定
  let tone = 'normal';
  if (lowerQuery.includes('緊急') || lowerQuery.includes('急') || lowerQuery.includes('今すぐ')) {
    tone = 'urgent';
  } else if (lowerQuery.includes('将来') || lowerQuery.includes('改定') || lowerQuery.includes('予定')) {
    tone = 'future';
  }
  
  return { category, intent, tone };
}

function extractVariables(content: string): any {
  const variables: any = {};
  
  // 基本的な変数パターンを抽出
  if (content.includes('予約番号')) variables.bookingNumber = 'string';
  if (content.includes('来場時間')) variables.arrivalTime = 'string';
  if (content.includes('利用期間')) variables.usagePeriod = 'string';
  if (content.includes('料金')) variables.fee = 'number';
  if (content.includes('車種')) variables.carType = 'string';
  
  return Object.keys(variables).length > 0 ? variables : null;
}

async function importTemplates(csvFilePath: string, batchSize: number = 10, dryRun: boolean = false) {
  console.log(`📦 バッチインポートを開始... (バッチサイズ: ${batchSize}, ドライラン: ${dryRun})`);
  
  const results: CSVRow[] = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row: any) => {
        if (row.usage === '◯') {
          results.push(row as CSVRow);
        }
      })
      .on('end', async () => {
        console.log(`📊 CSVから ${results.length}件のusage=◯データを読み込みました`);
        
        // 既存のCSVテンプレートを確認
        const existingCount = await prisma.templates.count({
          where: {
            metadata: {
              path: ['source'],
              equals: 'csv'
            }
          }
        });
        
        console.log(`📊 既存のCSVテンプレート: ${existingCount}件`);
        
        // バッチ処理
        const batches: CSVRow[][] = [];
        for (let i = 0; i < results.length; i += batchSize) {
          batches.push(results.slice(i, i + batchSize));
        }
        
        console.log(`📦 ${batches.length}バッチに分割しました`);
        
        let importedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`\n🔄 バッチ ${i + 1}/${batches.length} を処理中...`);
          
          for (const row of batch) {
            try {
              // 既存チェック
              const existing = await prisma.templates.findFirst({
                where: {
                  metadata: {
                    path: ['sourceRowId'],
                    equals: row.question
                  }
                }
              });
              
              if (existing) {
                console.log(`   ⏭️  スキップ: "${row.question.substring(0, 30)}..." (既存)`);
                skippedCount++;
                continue;
              }
              
              // テンプレートデータ生成
              const analysis = analyzeQuery(row.question);
              const variables = extractVariables(row.answer);
              
              const templateData: TemplateData = {
                title: `${analysis.category}:${analysis.intent}:${analysis.tone}:ver1`,
                content: row.answer,
                category: analysis.category,
                intent: analysis.intent,
                tone: analysis.tone,
                variables,
                metadata: {
                  source: 'csv',
                  sourceRowId: row.question,
                  sourceHash: Buffer.from(row.answer).toString('base64').substring(0, 16),
                  usageLabel: '◯',
                  note: row.note || '',
                  mainCategory: row.main_category,
                  subCategory: row.sub_category,
                  detailCategory: row.detail_category
                }
              };
              
              if (!dryRun) {
                await prisma.templates.create({
                  data: templateData
                });
              }
              
              console.log(`   ✅ インポート: "${row.question.substring(0, 30)}..." -> ${templateData.title}`);
              importedCount++;
              
            } catch (error) {
              console.error(`   ❌ エラー: "${row.question.substring(0, 30)}..." - ${error}`);
            }
          }
        }
        
        console.log(`\n📊 インポート結果:`);
        console.log(`   - インポート済み: ${importedCount}件`);
        console.log(`   - スキップ: ${skippedCount}件`);
        console.log(`   - 総処理: ${importedCount + skippedCount}件`);
        
        if (!dryRun) {
          // 承認
          const approveResult = await prisma.templates.updateMany({
            where: {
              metadata: {
                path: ['source'],
                equals: 'csv'
              },
              is_approved: false
            },
            data: {
              is_approved: true
            }
          });
          
          console.log(`   - 承認済み: ${approveResult.count}件`);
        }
        
        resolve({ importedCount, skippedCount });
      })
      .on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10');
  const dryRun = args.includes('--dry-run');
  const csvFile = args.find(arg => arg.startsWith('--file='))?.split('=')[1] || 'src/data/csv/production/knowledge.csv';
  
  try {
    await importTemplates(csvFile, batchSize, dryRun);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { importTemplates }; 