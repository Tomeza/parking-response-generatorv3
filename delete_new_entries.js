const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteNewEntriesSafely() {
  try {
    console.log('====== 最近追加されたエントリーを安全に削除します ======');

    // 1. 削除対象の Knowledge ID を特定
    const entriesToDelete = await prisma.knowledge.findMany({
      where: {
        OR: [
          { main_category: '利用の流れ', sub_category: '初回利用' },
          { main_category: 'サービス案内', sub_category: '概要' },
          { question: { contains: '初めて利用する場合、どのような手順で駐車場を利用すればよいですか？' } },
          { question: { contains: '駐車場サービスの概要を教えてください' } }
        ]
      },
      select: {
        id: true // ID のみ取得
      }
    });

    const idsToDelete = entriesToDelete.map(entry => entry.id);

    if (idsToDelete.length === 0) {
      console.log('削除対象のエントリーが見つかりませんでした。');
      return;
    }

    console.log(`削除対象のKnowledge ID: ${idsToDelete.join(', ')}`);

    // 2. 関連データの削除
    console.log('関連データの削除を開始します...');

    // KnowledgeTag の削除
    const deletedTagsCount = await prisma.knowledgeTag.deleteMany({
      where: { knowledge_id: { in: idsToDelete } }
    });
    console.log(`- KnowledgeTag: ${deletedTagsCount.count}件削除`);

    // KnowledgeQuestionVariation の削除
    const deletedVariationsCount = await prisma.knowledgeQuestionVariation.deleteMany({
      where: { knowledge_id: { in: idsToDelete } }
    });
    console.log(`- KnowledgeQuestionVariation: ${deletedVariationsCount.count}件削除`);

    // FeedbackWeight の削除
    const deletedWeightsCount = await prisma.feedbackWeight.deleteMany({
      where: { knowledge_id: { in: idsToDelete } }
    });
    console.log(`- FeedbackWeight: ${deletedWeightsCount.count}件削除`);
    
    // ResponseLog は knowledge_id が Nullable なので、削除ではなく NULL に設定するか、そのままにする（今回はそのまま）
    // 必要であれば更新処理を追加
    // const updatedLogsCount = await prisma.responseLog.updateMany({
    //   where: { knowledge_id: { in: idsToDelete } },
    //   data: { knowledge_id: null }
    // });
    // console.log(`- ResponseLog: ${updatedLogsCount.count}件の関連を解除`);

    // 3. Knowledge 本体の削除
    console.log('Knowledge本体の削除を開始します...');
    const deletedKnowledgeCount = await prisma.knowledge.deleteMany({
      where: {
        id: { in: idsToDelete }
      }
    });
    
    console.log(`
====== 結果 ======`);
    console.log(`${deletedKnowledgeCount.count}件のKnowledgeエントリーを削除しました。`);

    // カテゴリ一覧を表示
    const categories = await prisma.$queryRaw`
      SELECT DISTINCT main_category, sub_category, COUNT(*) as count
      FROM "Knowledge"
      GROUP BY main_category, sub_category
      ORDER BY main_category, sub_category
    `;

    console.log('\n現在のカテゴリ一覧:');
    console.table(categories);

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteNewEntriesSafely(); 