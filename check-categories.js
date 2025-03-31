const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('データベースから全カテゴリ情報を取得中...');
    
    const categories = await prisma.$queryRaw`
      SELECT DISTINCT main_category, sub_category 
      FROM "Knowledge" 
      ORDER BY main_category, sub_category
    `;
    
    console.log('\n=== カテゴリ一覧 ===');
    console.table(categories);
    
    // 予約関連のエントリをサンプル表示
    const reservationEntries = await prisma.knowledge.findMany({
      where: {
        OR: [
          { main_category: { contains: '予約' } },
          { sub_category: { contains: '予約' } }
        ]
      },
      select: {
        id: true,
        main_category: true,
        sub_category: true,
        question: true
      },
      take: 10
    });
    
    console.log('\n=== 予約関連のエントリ (最大10件) ===');
    reservationEntries.forEach(entry => {
      console.log(`ID: ${entry.id}, ${entry.main_category} > ${entry.sub_category}`);
      console.log(`質問: ${entry.question}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 