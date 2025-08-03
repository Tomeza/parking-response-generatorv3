import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resolveDuplicates() {
  try {
    console.log('🔧 重複解消を開始...');
    
    // 重複チェック
    const duplicates = await prisma.$queryRaw`
      SELECT category, intent, tone, title, version, COUNT(*) AS count
      FROM "Templates"
      GROUP BY category, intent, tone, title, version
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    if (Array.isArray(duplicates) && duplicates.length > 0) {
      console.log(`📊 ${duplicates.length}件の重複を解消します`);
      
      for (const dup of duplicates) {
        console.log(`\n🔄 重複解消: ${dup.category}:${dup.intent}:${dup.tone}:${dup.title}:v${dup.version} (${dup.count}件)`);
        
        // 重複データを取得
        const duplicateRecords = await prisma.templates.findMany({
          where: {
            category: dup.category,
            intent: dup.intent,
            tone: dup.tone,
            title: dup.title,
            version: dup.version
          },
          orderBy: { id: 'asc' }
        });
        
        // 最初のレコードを保持し、残りを削除
        const keepRecord = duplicateRecords[0];
        const deleteRecords = duplicateRecords.slice(1);
        
        console.log(`   ✅ 保持: ID ${keepRecord.id} (承認: ${keepRecord.is_approved})`);
        
        for (const deleteRecord of deleteRecords) {
          console.log(`   🗑️  削除: ID ${deleteRecord.id} (承認: ${deleteRecord.is_approved})`);
          
          await prisma.templates.delete({
            where: { id: deleteRecord.id }
          });
        }
      }
      
      // 解消後の確認
      const remainingDuplicates = await prisma.$queryRaw`
        SELECT category, intent, tone, title, version, COUNT(*) AS count
        FROM "Templates"
        GROUP BY category, intent, tone, title, version
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `;
      
      if (Array.isArray(remainingDuplicates) && remainingDuplicates.length > 0) {
        console.log(`\n⚠️  まだ ${remainingDuplicates.length}件の重複が残っています`);
      } else {
        console.log('\n✅ 重複解消完了！');
      }
      
    } else {
      console.log('✅ 重複は見つかりませんでした');
    }
    
    // 最終統計
    const totalCount = await prisma.templates.count();
    console.log(`\n📊 最終統計: ${totalCount}件のテンプレート`);
    
  } catch (error) {
    console.error('❌ 重複解消エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  resolveDuplicates();
}

export { resolveDuplicates }; 