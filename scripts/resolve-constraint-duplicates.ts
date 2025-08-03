import { prisma } from '../src/lib/db';

async function resolveConstraintDuplicates() {
  console.log('🔄 制約重複の解決を開始...');
  
  try {
    // 1. 重複グループを取得
    const duplicates = await prisma.$queryRaw`
      SELECT category, intent, tone, COUNT(*) as count, array_agg(id ORDER BY id) as ids
      FROM "Templates"
      WHERE status = 'approved'
      GROUP BY category, intent, tone
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    console.log(`📊 重複グループ数: ${duplicates.length}`);
    
    let resolvedCount = 0;
    
    for (const group of duplicates) {
      const { category, intent, tone, count, ids } = group as any;
      console.log(`\n🔍 処理中: ${category}/${intent}/${tone} (${count}件)`);
      
      // 2. 各グループで最適なテンプレートを選択
      const templates = await prisma.templates.findMany({
        where: {
          id: { in: ids }
        },
        select: {
          id: true,
          title: true,
          content: true,
          note: true,
          usageLabel: true,
          replyTypeTags: true,
          infoSourceTags: true,
          situationTags: true
        },
        orderBy: [
          { usageLabel: 'desc' }, // ◯/△/✖️の優先順位
          { id: 'asc' } // 古い順
        ]
      });
      
      // 3. 最適なテンプレートを選択（最初の1件を保持）
      const primaryTemplate = templates[0];
      const secondaryTemplates = templates.slice(1);
      
      console.log(`  ✅ 一次テンプレート: ID=${primaryTemplate.id} (${primaryTemplate.title})`);
      console.log(`  📝 二次テンプレート: ${secondaryTemplates.length}件`);
      
      // 4. 二次テンプレートのステータスを変更
      if (secondaryTemplates.length > 0) {
        const secondaryIds = secondaryTemplates.map(t => t.id);
        
        await prisma.templates.updateMany({
          where: {
            id: { in: secondaryIds }
          },
          data: {
            status: 'draft' // 承認済みから下書きに変更
          }
        });
        
        console.log(`  🔄 ${secondaryTemplates.length}件をdraftに変更`);
        resolvedCount += secondaryTemplates.length;
      }
    }
    
    console.log(`\n✅ 重複解決完了: ${resolvedCount}件をdraftに変更`);
    
    // 5. 解決後の確認
    const finalDuplicates = await prisma.$queryRaw`
      SELECT category, intent, tone, COUNT(*) as count
      FROM "Templates"
      WHERE status = 'approved'
      GROUP BY category, intent, tone
      HAVING COUNT(*) > 1
    `;
    
    if (Array.isArray(finalDuplicates) && finalDuplicates.length === 0) {
      console.log('✅ 重複なし - 制約追加可能');
      return true;
    } else {
      console.log('❌ まだ重複が残っています:');
      console.table(finalDuplicates);
      return false;
    }
    
  } catch (error) {
    console.error('❌ 重複解決エラー:', error);
    return false;
  }
}

resolveConstraintDuplicates()
  .then((success) => {
    if (success) {
      console.log('✅ 重複解決が完了しました - 制約追加可能');
    } else {
      console.log('❌ 重複解決に失敗しました');
    }
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 