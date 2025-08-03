import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    console.log('🔍 重複チェックを開始...');
    
    // 重複チェッククエリ
    const duplicates = await prisma.$queryRaw`
      SELECT category, intent, tone, title, version, COUNT(*) AS count
      FROM "Templates"
      GROUP BY category, intent, tone, title, version
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    console.log('📊 重複チェック結果:');
    
    if (Array.isArray(duplicates) && duplicates.length > 0) {
      console.log(`❌ ${duplicates.length}件の重複が見つかりました:`);
      
      for (const dup of duplicates) {
        console.log(`   - ${dup.category}:${dup.intent}:${dup.tone}:${dup.title}:v${dup.version} (${dup.count}件)`);
      }
      
      // 詳細な重複データを表示
      console.log('\n📋 重複データの詳細:');
      for (const dup of duplicates) {
        const details = await prisma.templates.findMany({
          where: {
            category: dup.category,
            intent: dup.intent,
            tone: dup.tone,
            title: dup.title,
            version: dup.version
          },
          orderBy: { id: 'asc' }
        });
        
        console.log(`\n   ${dup.category}:${dup.intent}:${dup.tone}:${dup.title}:v${dup.version}:`);
        details.forEach((detail, index) => {
          console.log(`     ${index + 1}. ID: ${detail.id}, 承認: ${detail.is_approved}, 作成日: ${detail.created_at}`);
        });
      }
    } else {
      console.log('✅ 重複は見つかりませんでした');
    }
    
    // 全テンプレートの統計
    const totalCount = await prisma.templates.count();
    console.log(`\n📊 全テンプレート数: ${totalCount}件`);
    
  } catch (error) {
    console.error('❌ 重複チェックエラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDuplicates();
}

export { checkDuplicates }; 