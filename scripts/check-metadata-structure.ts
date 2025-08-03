import { prisma } from '../src/lib/db';

async function checkMetadataStructure() {
  console.log('🔍 metadata構造の確認を開始...');
  
  try {
    // metadataを持つテンプレートのサンプルを取得
    const samples = await prisma.templates.findMany({
      where: {
        metadata: {
          not: null
        }
      },
      select: {
        id: true,
        title: true,
        metadata: true
      },
      take: 5
    });
    
    console.log('📊 metadataサンプル:');
    samples.forEach(sample => {
      console.log(`\nID: ${sample.id}`);
      console.log(`Title: ${sample.title}`);
      console.log('Metadata keys:', Object.keys(sample.metadata || {}));
      console.log('Metadata:', JSON.stringify(sample.metadata, null, 2));
    });
    
    // キー名の統計
    const allKeys = new Set<string>();
    const templatesWithMetadata = await prisma.templates.findMany({
      where: {
        metadata: {
          not: null
        }
      },
      select: {
        metadata: true
      }
    });
    
    templatesWithMetadata.forEach(t => {
      if (t.metadata) {
        Object.keys(t.metadata).forEach(key => allKeys.add(key));
      }
    });
    
    console.log('\n📊 使用されているmetadataキー:');
    console.log(Array.from(allKeys).sort());
    
  } catch (error) {
    console.error('❌ metadata構造確認エラー:', error);
  }
}

checkMetadataStructure()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 