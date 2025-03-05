import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log('重複データのクリーンアップを開始します...');

  // 重複している質問と回答のペアを検索
  const duplicates = await prisma.$queryRaw`
    SELECT question, answer, COUNT(*), ARRAY_AGG(id) as ids
    FROM "Knowledge"
    GROUP BY question, answer
    HAVING COUNT(*) > 1
  `;

  console.log(`${(duplicates as any[]).length}件の重複データが見つかりました。`);

  // 各重複グループについて、最も小さいIDを残して他を削除
  for (const dup of duplicates as any[]) {
    const ids = dup.ids as number[];
    // 最も小さいIDを保持
    const keepId = Math.min(...ids);
    // 削除するID
    const deleteIds = ids.filter(id => id !== keepId);

    console.log(`質問: "${dup.question}" の重複を処理します。`);
    console.log(`ID ${keepId} を保持し、ID ${deleteIds.join(', ')} を削除します。`);

    // 関連するKnowledgeTagを削除
    await prisma.knowledgeTag.deleteMany({
      where: {
        knowledge_id: {
          in: deleteIds
        }
      }
    });

    // 重複しているKnowledgeを削除
    await prisma.knowledge.deleteMany({
      where: {
        id: {
          in: deleteIds
        }
      }
    });
  }

  console.log('重複データのクリーンアップが完了しました。');
}

cleanupDuplicates()
  .catch(e => {
    console.error('エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 