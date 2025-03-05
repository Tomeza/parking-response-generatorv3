const { PrismaClient } = require('@prisma/client');
const { parse } = require('csv-parse/sync');
const { readFileSync } = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importCsv() {
  try {
    // CSVファイルを読み込む
    const csvFilePath = path.join(process.cwd(), 'src', 'data', 'csv', 'production', 'knowledge.csv');
    const csvContent = readFileSync(csvFilePath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`Found ${records.length} records to import`);

    // 各レコードをデータベースにインポート
    for (const record of records) {
      const knowledge = await prisma.knowledge.create({
        data: {
          main_category: record.main_category,
          sub_category: record.sub_category,
          detail_category: record.detail_category || null,
          question: record.question,
          answer: record.answer,
          usage: record.usage || null,
          note: record.note || null,
          issue: record.issue || null,
          is_template: record.is_template === 'true',
        },
      });

      console.log(`Imported knowledge record with ID: ${knowledge.id}`);
    }

    console.log('Import completed successfully');
  } catch (error) {
    console.error('Error importing CSV:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importCsv(); 