import { PrismaClient } from '@prisma/client';

async function main() {
  // コマンドライン引数から削除するIDの範囲を取得
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('使用方法: npx ts-node scripts/delete-old-reservation-entries.ts [開始ID] [終了ID]');
    process.exit(1);
  }
  
  const startId = parseInt(args[0], 10);
  const endId = parseInt(args[1], 10);
  
  if (isNaN(startId) || isNaN(endId)) {
    console.error('開始IDと終了IDは数値で指定してください');
    process.exit(1);
  }
  
  console.log(`ID ${startId} から ${endId} までのエントリを削除します...`);
  
  const prisma = new PrismaClient();
  
  try {
    // 関連するKnowledgeTagエントリを先に削除
    const deletedTags = await prisma.knowledgeTag.deleteMany({
      where: {
        knowledge_id: {
          gte: startId,
          lte: endId
        }
      }
    });
    
    console.log(`${deletedTags.count}件のKnowledgeTagエントリを削除しました`);
    
    // Knowledgeエントリを削除
    const deletedKnowledge = await prisma.knowledge.deleteMany({
      where: {
        id: {
          gte: startId,
          lte: endId
        }
      }
    });
    
    console.log(`${deletedKnowledge.count}件のKnowledgeエントリを削除しました`);
    
    console.log('削除が完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 