import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';

const prisma = new PrismaClient();

async function importCsvWithCheck() {
  console.log('CSVインポートを開始します（重複チェック機能付き）...');
  
  const csvFilePath = path.resolve(process.cwd(), 'data', 'knowledge.csv');
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`CSVファイルが見つかりません: ${csvFilePath}`);
    return;
  }
  
  const records: any[] = [];
  
  // CSVファイルを読み込む
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => records.push(data))
      .on('end', () => resolve())
      .on('error', (error) => reject(error));
  });
  
  console.log(`${records.length}件のレコードをCSVから読み込みました。`);
  
  let importedCount = 0;
  let skippedCount = 0;
  
  for (const record of records) {
    // 既存のレコードを検索（質問と回答の組み合わせで重複チェック）
    const existingRecord = await prisma.knowledge.findFirst({
      where: {
        question: record.question,
        answer: record.answer
      }
    });
    
    if (existingRecord) {
      console.log(`重複レコードをスキップします: "${record.question}"`);
      skippedCount++;
      continue;
    }
    
    // タグの処理
    const tags = record.tags ? record.tags.split(',').map((tag: string) => tag.trim()) : [];
    
    // 新しいレコードを作成
    const knowledge = await prisma.knowledge.create({
      data: {
        question: record.question,
        answer: record.answer,
        main_category: record.main_category || '',
        sub_category: record.sub_category || '',
        detail_category: record.detail_category || ''
      }
    });
    
    // タグの関連付け
    for (const tagName of tags) {
      if (!tagName) continue;
      
      // タグが存在するか確認し、なければ作成
      let tag = await prisma.tag.findFirst({
        where: { name: tagName }
      });
      
      if (!tag) {
        tag = await prisma.tag.create({
          data: { name: tagName }
        });
      }
      
      // KnowledgeとTagを関連付け
      await prisma.knowledgeTag.create({
        data: {
          knowledge_id: knowledge.id,
          tag_id: tag.id
        }
      });
    }
    
    importedCount++;
  }
  
  console.log(`インポート完了: ${importedCount}件のレコードをインポートしました。`);
  console.log(`スキップされたレコード: ${skippedCount}件（重複）`);
}

importCsvWithCheck()
  .catch(e => {
    console.error('エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });