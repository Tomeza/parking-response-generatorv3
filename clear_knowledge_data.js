const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearKnowledgeData() {
  try {
    console.log('====== Knowledge および KnowledgeTag テーブルのデータをすべて削除します ======');

    // まず関連テーブル (KnowledgeTag) のデータを削除
    const deletedTagsCount = await prisma.knowledgeTag.deleteMany({});
    console.log(`- KnowledgeTag: ${deletedTagsCount.count}件削除`);

    // Knowledge テーブルのデータを削除
    const deletedKnowledgeCount = await prisma.knowledge.deleteMany({});
    console.log(`- Knowledge: ${deletedKnowledgeCount.count}件削除`);

    console.log('\nデータの削除が完了しました。');

    // 念のためカテゴリ一覧を表示（空のはず）
    const categories = await prisma.$queryRaw`
      SELECT DISTINCT main_category, sub_category, COUNT(*) as count
      FROM "Knowledge"
      GROUP BY main_category, sub_category
      ORDER BY main_category, sub_category
    `;
    console.log('\n現在のカテゴリ一覧:');
    console.table(categories);


  } catch (error) {
    console.error('データ削除中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearKnowledgeData(); 