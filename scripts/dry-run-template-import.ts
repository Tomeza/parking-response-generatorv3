import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ESM対応の__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 簡約マッピング規則
const categoryMapping = {
  '利用の流れ': 'reservation',
  '予約関連': 'reservation',
  '車両関連': 'vehicle',
  '送迎関連': 'shuttle',
  '料金関連': 'payment',
  '記入情報': 'information',
  '利用制限': 'restriction',
  '免責約款': 'disclaimer',
  'アクセス': 'access',
  'サービス案内': 'general',
  '対応': 'trouble'
};

const intentMapping = {
  '問い合わせ': 'inquiry',
  '確認': 'check',
  '新規': 'create',
  '変更': 'modify',
  '取消': 'cancel',
  '報告': 'report',
  '予約方法': 'inquiry',
  '予約確認': 'check',
  '来場時': 'inquiry',
  '帰着時': 'inquiry',
  '送迎時': 'inquiry',
  '精算時': 'inquiry',
  '鍵管理': 'inquiry',
  '必要物': 'inquiry',
  '予約条件': 'inquiry',
  '予約時間': 'inquiry',
  '期間制限': 'inquiry',
  '制限時間': 'inquiry',
  '確認事項': 'check',
  '遅延対応': 'inquiry',
  'システム制限': 'inquiry',
  '複数予約': 'inquiry',
  '繁忙期': 'inquiry',
  '満車対応': 'inquiry',
  'システム管理': 'inquiry',
  '長期予約': 'inquiry',
  'システム通知': 'inquiry',
  '割引プラン': 'inquiry',
  '来場時間': 'inquiry',
  '利用目的': 'inquiry',
  'キャンセル': 'cancel',
  '日程変更': 'modify',
  '時間変更': 'modify',
  '車両情報': 'inquiry',
  'サイズ制限': 'inquiry',
  '車種制限': 'inquiry',
  'サイズ確認': 'check',
  '確認手順': 'check',
  '駐車環境': 'inquiry',
  '受入基準': 'inquiry',
  '時間': 'inquiry',
  '制限事項': 'inquiry',
  '特別対応': 'inquiry',
  '案内': 'inquiry',
  '待ち時間': 'inquiry',
  '配車管理': 'inquiry',
  '深夜対応': 'inquiry',
  '案内変更': 'inquiry',
  '忘れ物対応': 'inquiry',
  '運行管理': 'inquiry',
  '緊急対応': 'inquiry',
  '所要時間': 'inquiry',
  '案内方法': 'inquiry',
  '設備': 'inquiry',
  '割引': 'inquiry',
  '支払時期': 'inquiry',
  '領収書': 'inquiry',
  'キャンセル料': 'inquiry',
  '支払方法': 'inquiry',
  '追加料金': 'inquiry',
  '料金改定': 'inquiry',
  '団体予約': 'inquiry',
  '変更料金': 'inquiry',
  'フライト情報': 'inquiry',
  '備考欄': 'inquiry',
  '個人情報': 'inquiry',
  '確認項目': 'check',
  'データ管理': 'inquiry',
  'データ修正': 'modify',
  '利用範囲': 'inquiry',
  '保険対象': 'inquiry',
  '判断基準': 'inquiry',
  '引渡後': 'inquiry',
  '車両損傷': 'inquiry',
  '機械不具合': 'inquiry',
  'ガラス損傷': 'inquiry',
  'タイヤ': 'inquiry',
  '車内物品': 'inquiry',
  '走行距離': 'inquiry',
  '盗難': 'inquiry',
  '天災': 'inquiry',
  'その他': 'inquiry'
};

const toneMapping = {
  '緊急': 'urgent',
  '深夜': 'urgent',
  '将来': 'future',
  '改定予定': 'future',
  '標準対応': 'normal',
  '条件付対応': 'conditional',
  '例外不可': 'strict',
  '時間制限あり': 'urgent',
  '計画必要': 'future',
  'トラブル可能性': 'urgent',
  '連絡必須': 'urgent',
  '配慮説明': 'polite',
  '安全優先': 'urgent',
  '迅速連絡': 'urgent',
  '案内物説明': 'normal',
  '設備案内': 'normal',
  '特別対応案内': 'special',
  '明確説明': 'normal',
  '明確指示': 'normal',
  '入力例示': 'normal',
  '補償説明': 'normal',
  '解決方法提示': 'normal',
  '場所説明': 'normal',
  '経路案内': 'normal',
  '情報提供': 'normal',
  '具体案内': 'normal',
  '共感対応': 'polite',
  'サービス説明': 'normal',
  '明確回答': 'normal',
  'ルール説明': 'normal',
  '手順案内': 'normal',
  '可否回答': 'normal',
  '条件説明': 'normal'
};

interface CsvTemplate {
  main_category: string;
  sub_category: string;
  detail_category: string;
  question: string;
  answer: string;
  usage: string;
  note: string;
}

// ハッシュ生成関数
function generateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// 変数の簡易抽出
function extractVariables(content: string): Record<string, any> {
  const variables: Record<string, any> = {};
  
  // 予約番号
  if (content.includes('予約番号')) {
    variables.reservation_number = { type: 'string', value: '予約番号' };
  }
  
  // 来場時間
  if (content.includes('来場時間')) {
    variables.arrival_time = { type: 'string', value: '来場時間' };
  }
  
  // 利用期間
  if (content.includes('利用期間')) {
    variables.usage_period = { type: 'string', value: '利用期間' };
  }
  
  // 車種
  if (content.includes('車種')) {
    variables.vehicle_type = { type: 'string', value: '車種' };
  }
  
  // 人数
  if (content.includes('人数')) {
    variables.passenger_count = { type: 'number', value: '人数' };
  }
  
  return variables;
}

// 簡約マッピング
function mapCategory(mainCategory: string): string {
  return categoryMapping[mainCategory as keyof typeof categoryMapping] || 'other';
}

function mapIntent(subCategory: string): string {
  return intentMapping[subCategory as keyof typeof intentMapping] || 'inquiry';
}

function mapTone(detailCategory: string): string {
  return toneMapping[detailCategory as keyof typeof toneMapping] || 'normal';
}

async function importTemplatesFromCsv(csvPath: string, dryRun: boolean = true) {
  try {
    console.log('CSVファイルを読み込み中...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSVファイルが空またはヘッダーのみです');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const dataLines = lines.slice(1);

    console.log(`CSVから${dataLines.length}件のレコードを読み込みました`);

    let processedCount = 0;
    let skippedCount = 0;
    const templates: any[] = [];

    for (let rowIndex = 0; rowIndex < dataLines.length; rowIndex++) {
      const line = dataLines[rowIndex];
      if (!line.trim()) continue;

      const values = line.split(',').map(v => v.trim());
      const template: Partial<CsvTemplate> = {};

      headers.forEach((header, index) => {
        if (values[index] !== undefined) {
          let value = values[index];
          // ダブルクォートの除去
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          }
          template[header as keyof CsvTemplate] = value;
        }
      });

      // usage=◯のみを処理
      if (template.usage !== '◯') {
        continue;
      }

      // 必須フィールドの検証
      if (!template.main_category || !template.sub_category || !template.answer) {
        console.warn('必須フィールドが不足しているためスキップ:', template);
        skippedCount++;
        continue;
      }

      // 簡約マッピング
      const category = mapCategory(template.main_category);
      const intent = mapIntent(template.sub_category);
      const tone = mapTone(template.detail_category || '');

      // 変数の簡易抽出
      const variables = extractVariables(template.answer || '');

      // コンテンツハッシュの生成
      const contentHash = generateHash(template.answer || '');

      // テンプレート名の生成
      const name = `${category}:${intent}:${tone}:ver1`;
      const displayTitle = `${template.main_category}_${template.sub_category}_${template.detail_category || 'general'}`;

      // 由来情報
      const source = {
        source: 'csv',
        sourceRowId: rowIndex + 1,
        sourceHash: contentHash,
        usageLabel: template.usage,
        note: template.note || ''
      };

      const templateData = {
        name,
        displayTitle,
        category,
        intent,
        tone,
        content: template.answer || '',
        variables,
        source,
        rowIndex: rowIndex + 1
      };

      templates.push(templateData);
      processedCount++;
    }

    console.log(`\n処理結果:`);
    console.log(`- 処理済み: ${processedCount}件 (usage=◯)`);
    console.log(`- スキップ: ${skippedCount}件`);
    console.log(`- 合計: ${dataLines.length}件`);

    if (dryRun) {
      console.log('\n=== ドライランプレビュー ===');
      templates.slice(0, 10).forEach((template, index) => {
        console.log(`\n${index + 1}. ${template.name}`);
        console.log(`   表示名: ${template.displayTitle}`);
        console.log(`   カテゴリ: ${template.category} (${template.source.sourceRowId}行目)`);
        console.log(`   意図: ${template.intent}`);
        console.log(`   トーン: ${template.tone}`);
        console.log(`   内容: ${template.content.substring(0, 80)}...`);
        console.log(`   変数: ${Object.keys(template.variables).length}個`);
        console.log(`   ハッシュ: ${template.source.sourceHash.substring(0, 8)}`);
        console.log(`   備考: ${template.source.note}`);
      });

      if (templates.length > 10) {
        console.log(`\n... 他${templates.length - 10}件`);
      }

      console.log('\n=== マッピング統計 ===');
      const categoryStats = templates.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const intentStats = templates.reduce((acc, t) => {
        acc[t.intent] = (acc[t.intent] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const toneStats = templates.reduce((acc, t) => {
        acc[t.tone] = (acc[t.tone] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('カテゴリ別:', categoryStats);
      console.log('意図別:', intentStats);
      console.log('トーン別:', toneStats);

    } else {
      // 実際のインポート
      console.log('\n実際のインポートを実行中...');
      
      for (const template of templates) {
        await prisma.templates.create({
          data: {
            title: template.name,
            content: template.content,
            category: template.category,
            intent: template.intent,
            tone: template.tone,
            variables: template.variables,
            metadata: template.source,
            version: 1,
            is_approved: false,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        console.log(`インポート完了: ${template.name}`);
      }
      
      console.log(`\n${templates.length}件のテンプレートをインポートしました`);
    }

  } catch (error) {
    console.error('インポートエラー:', error);
    throw error;
  } finally {
    if (!dryRun) {
      await prisma.$disconnect();
    }
  }
}

// メイン実行
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  const csvPath = path.resolve(__dirname, '../src/data/csv/production/knowledge.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('CSVファイルが見つかりません:', csvPath);
    process.exit(1);
  }

  console.log(`モード: ${dryRun ? 'ドライラン' : '実際のインポート'}`);
  await importTemplatesFromCsv(csvPath, dryRun);
}

main().catch(console.error); 