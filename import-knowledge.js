const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const prisma = new PrismaClient();

async function main() {
  try {
    // CSV ファイルの読み込み
    const csvFilePath = path.resolve(__dirname, 'modified_knowledge.csv');
    const csvFile = fs.readFileSync(csvFilePath, 'utf8');
    
    // CSV パース（ヘッダー行を含む）
    const records = parse(csvFile, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`CSVから${records.length}件のレコードを読み込みました`);
    
    // 既存のレコードをいったん削除（ID 132-153）
    const deleteResult = await prisma.knowledge.deleteMany({
      where: {
        id: {
          gte: 132,
          lte: 153
        }
      }
    });
    
    console.log(`${deleteResult.count}件のレコードを削除しました`);
    
    // 新しいレコードを追加
    for (const record of records) {
      // boolean フィールドの変換
      const isTemplate = record.is_template === 'true';
      
      // ID の数値変換
      const id = parseInt(record.id, 10);
      
      // レコードの作成
      await prisma.knowledge.create({
        data: {
          id,
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
    }
    
    console.log(`${records.length}件のレコードをインポートしました`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 