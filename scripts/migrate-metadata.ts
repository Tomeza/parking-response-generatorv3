import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateMetadata() {
  try {
    console.log('🔄 metadataから新しいカラムへのデータ移設を開始...');
    
    // metadataを持つテンプレートを取得
    const templatesWithMetadata = await prisma.templates.findMany({
      where: {
        metadata: {
          not: null
        }
      }
    });
    
    console.log(`📊 ${templatesWithMetadata.length}件のテンプレートを処理します`);
    
    let updatedCount = 0;
    
    for (const template of templatesWithMetadata) {
      try {
        const metadata = template.metadata as any;
        const updates: any = {};
        
        // データ移設
        if (metadata.source && !template.source) {
          updates.source = metadata.source;
        }
        
        if (metadata.sourceRowId && !template.sourceRowId) {
          updates.sourceRowId = parseInt(metadata.sourceRowId);
        }
        
        if (metadata.sourceHash && !template.sourceHash) {
          updates.sourceHash = metadata.sourceHash;
        }
        
        if (metadata.usage && !template.usageLabel) {
          updates.usageLabel = metadata.usage;
        }
        
        if (metadata.note && !template.note) {
          updates.note = metadata.note;
        }
        
        // 配列データの移設
        if (metadata.replyTypeTags && Array.isArray(metadata.replyTypeTags) && template.replyTypeTags.length === 0) {
          updates.replyTypeTags = metadata.replyTypeTags;
        }
        
        if (metadata.infoSourceTags && Array.isArray(metadata.infoSourceTags) && template.infoSourceTags.length === 0) {
          updates.infoSourceTags = metadata.infoSourceTags;
        }
        
        if (metadata.situationTags && Array.isArray(metadata.situationTags) && template.situationTags.length === 0) {
          updates.situationTags = metadata.situationTags;
        }
        
        // 更新が必要な場合のみ実行
        if (Object.keys(updates).length > 0) {
          await prisma.templates.update({
            where: { id: template.id },
            data: updates
          });
          
          updatedCount++;
          console.log(`   ✅ ID ${template.id}: ${Object.keys(updates).join(', ')} を移設`);
        }
        
      } catch (error) {
        console.error(`   ❌ ID ${template.id} の移設エラー:`, error);
      }
    }
    
    console.log(`\n📊 移設完了: ${updatedCount}件のテンプレートを更新`);
    
    // 移設後の統計
    const stats = await prisma.templates.groupBy({
      by: ['source'],
      _count: true
    });
    
    console.log('\n📊 移設後の統計:');
    stats.forEach(stat => {
      console.log(`   - source: ${stat.source || 'null'}: ${stat._count}件`);
    });
    
  } catch (error) {
    console.error('❌ データ移設エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateMetadata();
}

export { migrateMetadata }; 