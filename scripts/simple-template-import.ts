import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// ESM対応の__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 現場の言葉をそのままマッピング（根拠を保持）
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

    // 既存のテンプレートをクリア（オプション）
    // await prisma.templates.deleteMany({});

    let importedCount = 0;
    let skippedCount = 0;

    for (const line of dataLines) {
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

      // マッピング（現場の言葉をそのまま使用）
      const category = categoryMapping[template.category as keyof typeof categoryMapping] || template.category;
      const intent = intentMapping[template.intent as keyof typeof intentMapping] || template.intent;
      const tone = toneMapping[template.tone as keyof typeof toneMapping] || template.tone;

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

      // 根拠情報をmetadataに記録
      const metadata = {
        source: 'csv_import',
        original_category: template.category,
        original_intent: template.intent,
        original_tone: template.tone,
        importance: parseInt(template.importance || '3'),
        frequency: parseInt(template.frequency || '10'),
        import_date: new Date().toISOString()
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
      console.log(`インポート完了: ${category}:${intent}:${tone}`);
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