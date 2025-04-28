const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const prisma = new PrismaClient();

async function main() {
  try {
    // CSV ファイルの読み込み
    const csvFilePath = path.resolve(__dirname, 'src/data/csv/first_time_users_knowledge.csv');
    const csvFile = fs.readFileSync(csvFilePath, 'utf8');
    
    // CSV パース（ヘッダー行を含む）
    const records = parse(csvFile, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`CSVから${records.length}件のレコードを読み込みました`);
    
    // 新しいレコードを追加（削除なし）
    let addedCount = 0;
    for (const record of records) {
      // boolean フィールドの変換
      const isTemplate = record.is_template === 'true';
      
      // レコードの作成
      await prisma.knowledge.create({
        data: {
          main_category: record.main_category,
          sub_category: record.sub_category,
          detail_category: record.detail_category || '',
          question: record.question,
          answer: record.answer,
          is_template: isTemplate,
          usage: record.usage || '',
          note: record.note || '',
          issue: record.issue || '',
        }
      });
      addedCount++;
    }
    
    console.log(`${addedCount}件のレコードをインポートしました`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 