const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTemplates() {
  try {
    console.log('=== テンプレート状況確認 ===');
    
    // 総テンプレート数
    const totalCount = await prisma.templates.count();
    console.log(`総テンプレート数: ${totalCount}`);
    
    // 現場粒度テンプレート数（metadataあり）
    const granularCount = await prisma.templates.count({
      where: {
        metadata: {
          not: {
            equals: null
          }
        }
      }
    });
    console.log(`現場粒度テンプレート数: ${granularCount}`);
    
    // 汎用テンプレート数（metadataなし）
    const genericCount = await prisma.templates.count({
      where: {
        metadata: {
          equals: null
        }
      }
    });
    console.log(`汎用テンプレート数: ${genericCount}`);
    
    // カテゴリ別分布
    const categoryStats = await prisma.templates.groupBy({
      by: ['category'],
      _count: {
        id: true
      }
    });
    console.log('\nカテゴリ別分布:');
    categoryStats.forEach(stat => {
      console.log(`- ${stat.category}: ${stat._count.id}件`);
    });
    
    // 現場粒度テンプレートの例
    const granularExamples = await prisma.templates.findMany({
      where: {
        metadata: {
          not: {
            equals: null
          }
        }
      },
      take: 5,
      select: {
        title: true,
        category: true,
        intent: true,
        tone: true
      }
    });
    console.log('\n現場粒度テンプレート例:');
    granularExamples.forEach(t => {
      console.log(`- ${t.title} (${t.category}/${t.intent}/${t.tone})`);
    });
    
    // 特定のテンプレート検索
    const googleMapTemplates = await prisma.templates.findMany({
      where: {
        title: {
          contains: 'GoogleMap'
        }
      }
    });
    console.log('\nGoogleMap関連テンプレート:');
    googleMapTemplates.forEach(t => {
      console.log(`- ${t.title} (${t.category}/${t.intent}/${t.tone})`);
    });
    
    const receiptTemplates = await prisma.templates.findMany({
      where: {
        title: {
          contains: '領収書'
        }
      }
    });
    console.log('\n領収書関連テンプレート:');
    receiptTemplates.forEach(t => {
      console.log(`- ${t.title} (${t.category}/${t.intent}/${t.tone})`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplates(); 