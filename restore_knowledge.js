const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const prisma = new PrismaClient();

async function restoreKnowledge() {
  try {
    console.log('====== バックアップからKnowledgeデータを復元します ======');
    
    // バックアップCSVファイルの読み込み
    const backupFilePath = path.resolve(__dirname, 'backups/csv/backup/knowledge_backup.csv');
    
    if (!fs.existsSync(backupFilePath)) {
      console.error(`バックアップファイルが見つかりません: ${backupFilePath}`);
      console.error('復元を中止します。');
      return;
    }
    
    const csvFile = fs.readFileSync(backupFilePath, 'utf8');
    
    // CSV パース（ヘッダー行を含む）
    const records = parse(csvFile, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`バックアップファイルから${records.length}件のレコードを読み込みました`);
    
    // 既存のデータを削除
    const deleteResult = await prisma.knowledgeTag.deleteMany({});
    console.log(`${deleteResult.count}件のKnowledgeTagレコードを削除しました`);
    
    const deleteKnowledgeResult = await prisma.knowledge.deleteMany({});
    console.log(`${deleteKnowledgeResult.count}件のKnowledgeレコードを削除しました`);
    
    // 新しいレコードを追加
    let addedCount = 0;
    for (const record of records) {
      // ID の数値変換
      const id = parseInt(record.id, 10);
      
      // boolean フィールドの変換
      const isTemplate = record.is_template === 'true' || record.is_template === 't';
      
      // レコードの作成
      await prisma.knowledge.create({
        data: {
          id,
          main_category: record.main_category || null,
          sub_category: record.sub_category || null,
          detail_category: record.detail_category || null,
          question: record.question || null,
          answer: record.answer || '',
          is_template: isTemplate,
          usage: record.usage || null,
          note: record.note || null,
          issue: record.issue || null,
        }
      });
      addedCount++;
    }
    
    console.log(`\n====== 結果 ======`);
    console.log(`復元されたKnowledgeレコード: ${addedCount}件`);
    
    // 復元後のカテゴリを表示
    const restoredCategories = await prisma.$queryRaw`
      SELECT DISTINCT main_category, sub_category, COUNT(*) as count
      FROM "Knowledge" 
      GROUP BY main_category, sub_category
      ORDER BY main_category, sub_category
    `;
    
    console.log('\n復元後の主要カテゴリ:');
    console.table(restoredCategories);
    
    // タグの復元はここでは行わないので注意喚起
    console.log('注意: KnowledgeTagの復元は行われていません。必要であれば別途実行してください。');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 実行確認
console.log('警告: この操作を実行すると、現在のKnowledgeデータはすべて削除され、バックアップから復元されます。');
console.log('処理を続行するには、以下のコマンドを実行してください:');
console.log('node restore_knowledge.js --confirm');

if (process.argv.includes('--confirm')) {
  console.log('復元を開始します...');
  restoreKnowledge();
} else {
  console.log('確認フラグがないため、処理を中止します。');
} 