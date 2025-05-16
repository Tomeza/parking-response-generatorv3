const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteKnowledge() {
  try {
    console.log('ID 154から163のナレッジを削除します...');
    
    const result = await prisma.knowledge.deleteMany({
      where: {
        id: {
          gte: 154,
          lte: 163
        }
      }
    });
    
    console.log(`${result.count}件のナレッジを削除しました`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteKnowledge(); 