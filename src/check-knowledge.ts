import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkKnowledge() {
  try {
    // キャンセル関連のデータを取得
    const cancelKnowledge = await prisma.knowledge.findMany({
      where: {
        OR: [
          { main_category: 'キャンセル' },
          { sub_category: 'キャンセル' },
          { question: { contains: 'キャンセル' } }
        ]
      },
      orderBy: {
        id: 'desc'
      }
    });

    console.log('キャンセル関連のデータ:');
    console.log('====================');
    cancelKnowledge.forEach(item => {
      console.log(`ID: ${item.id}`);
      console.log(`メインカテゴリ: ${item.main_category}`);
      console.log(`サブカテゴリ: ${item.sub_category}`);
      console.log(`質問: ${item.question}`);
      console.log(`回答: ${item.answer}`);
      console.log('--------------------');
    });

    // 最新の5件のデータを取得
    const latestKnowledge = await prisma.knowledge.findMany({
      orderBy: {
        id: 'desc'
      },
      take: 5
    });

    console.log('\n最新の5件のデータ:');
    console.log('====================');
    latestKnowledge.forEach(item => {
      console.log(`ID: ${item.id}`);
      console.log(`メインカテゴリ: ${item.main_category}`);
      console.log(`サブカテゴリ: ${item.sub_category}`);
      console.log(`質問: ${item.question}`);
      console.log('--------------------');
    });

    // データの総数を取得
    const count = await prisma.knowledge.count();
    console.log(`\nデータの総数: ${count}`);

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkKnowledge(); 