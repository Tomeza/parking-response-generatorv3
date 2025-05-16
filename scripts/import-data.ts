import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
// ESM関連の import や定義は不要

const prisma = new PrismaClient();

interface KnowledgeData {
  main_category?: string;
  sub_category?: string;
  detail_category?: string;
  question?: string;
  answer?: string;
  is_template?: string; // Keep as string initially for parsing
  usage?: string;
  note?: string;
  issue?: string;
}

// 関数が csvPath を引数で受け取るように変更
async function importKnowledgeData(csvPath: string) {
  if (!csvPath) {
    console.error('エラー: CSVファイルのパスをコマンドライン引数として指定してください。');
    process.exit(1);
  }
  const absoluteCsvPath = path.resolve(csvPath); // 引数のパスを使用
  if (!fs.existsSync(absoluteCsvPath)) {
    console.error(`エラー: 指定されたCSVファイルが見つかりません: ${absoluteCsvPath}`);
    process.exit(1);
  }

  try {
    console.log(`データインポート開始: ${absoluteCsvPath}`);

    // --- 条件付き削除ロジック --- (コメントアウトを解除し、正式なロジックに)
    /* // Users/user1/parking-response-generatorv3/scripts/import-data.ts
    if (path.basename(absoluteCsvPath) === 'knowledge.csv') { // Check for exact match
      console.warn('警告: knowledge.csv が指定されたため、既存のKnowledgeおよびKnowledgeTagデータを削除します。');
      // 既存のデータを削除
      await prisma.knowledgeTag.deleteMany({}); // deleteMany を実行
      await prisma.knowledge.deleteMany({});   // deleteMany を実行
    } else {
      console.log('追加入力モード: 既存データは削除しません。');
    }
    */
    console.log('追加入力モード: 既存データは削除しません。'); // Always log this message
    // --- ここまで ---

    // CSVファイルを読み込む (引数のパスを使用)
    const csvData = fs.readFileSync(absoluteCsvPath, 'utf8');
    const lines = csvData.split('\n');
    if (lines.length < 2) {
        console.log('CSVにヘッダー行またはデータ行がありません。');
        return;
    }
    const headers = lines[0].split(',').map(h => h.trim()); // Trim headers

    // データをインポート (ループ処理)
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(','); // Simple split, may need improvement for complex CSVs
      const data: Partial<KnowledgeData> = {}; // Use Partial for safety

      headers.forEach((header: string, index: number) => {
         if (values[index] !== undefined) {
            let value = values[index].trim();
             // Remove surrounding double quotes
             if (value.startsWith('"') && value.endsWith('"')) {
               value = value.substring(1, value.length - 1);
               // Handle escaped double quotes inside if necessary: value = value.replace(/""/g, '"');
             }
             // Assign value to data object based on header key
             // Ensure header matches a key in KnowledgeData
             if (header in {main_category:0, sub_category:0, detail_category:0, question:0, answer:0, is_template:0, usage:0, note:0, issue:0}) { // Basic check
                 data[header as keyof KnowledgeData] = value;
             }
         }
      });

      // Convert is_template string to boolean
      const isTemplateBoolean = (data.is_template || '').toLowerCase() === 'true';

      // Insert into Knowledge table
      await prisma.knowledge.create({
        data: {
          main_category: data.main_category || null,
          sub_category: data.sub_category || null,
          detail_category: data.detail_category || null,
          question: data.question || null,
          answer: data.answer || '', // Default to empty string if null/undefined
          is_template: isTemplateBoolean, // Use the converted boolean value
          usage: data.usage || null,
          note: data.note || null,
          issue: data.issue || null
        }
      });
    }

    console.log('データインポート完了');
  } catch (error) {
    console.error('データインポートエラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// --- 引数処理 --- (スクリプトの最後)
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error('エラー: インポートするCSVファイルのパスをコマンドライン引数として指定してください。');
  console.log('例: npm run import-data src/data/csv/production/knowledge.csv');
  process.exit(1);
}
importKnowledgeData(csvFilePath); // 引数を渡して呼び出し
// --- ここまで --- 