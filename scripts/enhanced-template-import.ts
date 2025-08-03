import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ESM対応の__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 現場ナレッジから安定抽出するためのマッピング
const categoryMapping = {
  'capacity': 'capacity',      // 定員関連
  'parking': 'parking',        // 駐車場関連
  'shuttle': 'shuttle',        // 送迎関連
  'reservation': 'reservation', // 予約関連
  'operation': 'operation'      // 運営関連
};

const intentMapping = {
  'restriction': 'restriction', // 制限・拒否
  'check': 'check',             // 確認・問い合わせ
  'change': 'change',           // 変更・修正
  'procedure': 'procedure',     // 手順・方法
  'schedule': 'schedule'        // スケジュール・時間
};

const toneMapping = {
  'formal': 'formal',           // 正式・丁寧
  'polite': 'polite'            // 親切・配慮
};

interface CsvTemplate {
  category: string;
  intent: string;
  tone: string;
  body: string;
  variables: string;
  importance: string;
  frequency: string;
  status: string;
}

// ハッシュ生成関数
function generateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// 現場ナレッジから安定抽出
function extractFromFieldKnowledge(field: string): { category: string; intent: string; tone: string } {
  const lowerField = field.toLowerCase();
  
  // カテゴリ抽出（現場の言葉から）
  let category = 'general';
  if (lowerField.includes('capacity') || lowerField.includes('定員')) {
    category = 'capacity';
  } else if (lowerField.includes('parking') || lowerField.includes('駐車')) {
    category = 'parking';
  } else if (lowerField.includes('shuttle') || lowerField.includes('送迎')) {
    category = 'shuttle';
  } else if (lowerField.includes('reservation') || lowerField.includes('予約')) {
    category = 'reservation';
  } else if (lowerField.includes('operation') || lowerField.includes('運営')) {
    category = 'operation';
  }

  // 意図抽出（現場の質問タイプから）
  let intent = 'inquiry';
  if (lowerField.includes('restriction') || lowerField.includes('制限') || lowerField.includes('不可')) {
    intent = 'restriction';
  } else if (lowerField.includes('check') || lowerField.includes('確認')) {
    intent = 'check';
  } else if (lowerField.includes('change') || lowerField.includes('変更')) {
    intent = 'change';
  } else if (lowerField.includes('procedure') || lowerField.includes('手順')) {
    intent = 'procedure';
  } else if (lowerField.includes('schedule') || lowerField.includes('時間')) {
    intent = 'schedule';
  }

  // トーン抽出（現場の対応スタイルから）
  let tone = 'normal';
  if (lowerField.includes('formal') || lowerField.includes('正式')) {
    tone = 'formal';
  } else if (lowerField.includes('polite') || lowerField.includes('親切')) {
    tone = 'polite';
  }

  return { category, intent, tone };
}

async function importTemplatesFromCsv(csvPath: string) {
  try {
    console.log('CSVファイルを読み込み中...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSVファイルが空またはヘッダーのみです');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const dataLines = lines.slice(1);

    console.log(`CSVから${dataLines.length}件のテンプレートを読み込みました`);

    let importedCount = 0;
    let skippedCount = 0;

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

      // 必須フィールドの検証
      if (!template.category || !template.intent || !template.tone || !template.body) {
        console.warn('必須フィールドが不足しているためスキップ:', template);
        skippedCount++;
        continue;
      }

      // 現場ナレッジから安定抽出
      const extracted = extractFromFieldKnowledge(template.category);
      const category = categoryMapping[extracted.category as keyof typeof categoryMapping] || extracted.category;
      const intent = intentMapping[extracted.intent as keyof typeof intentMapping] || extracted.intent;
      const tone = toneMapping[extracted.tone as keyof typeof toneMapping] || extracted.tone;

      // variablesのパース
      let variables = {};
      try {
        if (template.variables && template.variables !== '{}') {
          variables = JSON.parse(template.variables);
        }
      } catch (error) {
        console.warn('variablesのパースに失敗:', template.variables);
        variables = {};
      }

      // コンテンツハッシュの生成
      const contentHash = generateHash(template.body || '');

      // 完全な根拠情報をmetadataに記録
      const metadata = {
        source: 'csv_import',
        rowId: rowIndex + 1, // CSVの行番号（1ベース）
        contentHash: contentHash,
        original_category: template.category,
        original_intent: template.intent,
        original_tone: template.tone,
        extracted_category: category,
        extracted_intent: intent,
        extracted_tone: tone,
        importance: parseInt(template.importance || '3'),
        frequency: parseInt(template.frequency || '10'),
        import_date: new Date().toISOString(),
        field_knowledge: {
          category: extracted.category,
          intent: extracted.intent,
          tone: extracted.tone
        }
      };

      // テンプレートの作成
      await prisma.templates.create({
        data: {
          title: `${category}:${intent}:${tone}:ver1`,
          content: template.body || '',
          category,
          intent,
          tone,
          variables,
          metadata,
          version: 1,
          is_approved: template.status === 'approved',
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      importedCount++;
      console.log(`インポート完了: ${category}:${intent}:${tone} (rowId: ${rowIndex + 1}, hash: ${contentHash.substring(0, 8)})`);
    }

    console.log(`\nインポート結果:`);
    console.log(`- 成功: ${importedCount}件`);
    console.log(`- スキップ: ${skippedCount}件`);
    console.log(`- 合計: ${dataLines.length}件`);

  } catch (error) {
    console.error('インポートエラー:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// メイン実行
async function main() {
  const csvPath = path.resolve(__dirname, '../data/templates_import_fixed.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('CSVファイルが見つかりません:', csvPath);
    process.exit(1);
  }

  await importTemplatesFromCsv(csvPath);
}

main().catch(console.error); 