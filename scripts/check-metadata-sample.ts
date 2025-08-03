import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMetadataSample() {
  try {
    console.log('📋 metadataのサンプルを確認中...');
    
    // metadataを持つテンプレートを取得
    const templatesWithMetadata = await prisma.templates.findMany({
      where: {
        metadata: {
          not: null
        }
      },
      take: 5,
      orderBy: { id: 'asc' }
    });
    
    console.log(`📊 ${templatesWithMetadata.length}件のサンプルを表示します\n`);
    
    for (const template of templatesWithMetadata) {
      console.log(`📄 ID: ${template.id}`);
      console.log(`   タイトル: ${template.title}`);
      console.log(`   カテゴリ: ${template.category}`);
      console.log(`   意図: ${template.intent}`);
      console.log(`   トーン: ${template.tone}`);
      console.log(`   承認: ${template.is_approved}`);
      console.log(`   metadata: ${JSON.stringify(template.metadata, null, 2)}`);
      console.log('---\n');
    }
    
    // 統計情報
    const totalWithMetadata = await prisma.templates.count({
      where: {
        metadata: {
          not: null
        }
      }
    });
    
    const totalTemplates = await prisma.templates.count();
    
    console.log(`📊 統計:`);
    console.log(`   - metadataを持つテンプレート: ${totalWithMetadata}件`);
    console.log(`   - 総テンプレート数: ${totalTemplates}件`);
    console.log(`   - metadata率: ${((totalWithMetadata / totalTemplates) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  checkMetadataSample();
}

export { checkMetadataSample }; 