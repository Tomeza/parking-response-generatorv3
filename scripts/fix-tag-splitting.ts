import { prisma } from '../src/lib/db';

async function fixTagSplitting() {
  console.log('🔄 タグ分割の修正を開始...');
  
  try {
    // 現在のタグ状況を確認
    const currentTags = await prisma.$queryRaw`
      SELECT id, title, "replyTypeTags", "infoSourceTags", "situationTags"
      FROM "Templates"
      WHERE array_length("replyTypeTags", 1) > 0
      LIMIT 3
    `;
    
    console.log('📊 現在のタグ状況:');
    console.log(JSON.stringify(currentTags, null, 2));
    
    // タグを正しく分割（空白区切り→個別タグ）
    const replyTagsUpdate = await prisma.$executeRaw`
      UPDATE "Templates"
      SET "replyTypeTags" = 
        CASE
          WHEN metadata->>'reply_type_tags' IS NULL OR metadata->>'reply_type_tags' = '' THEN ARRAY[]::text[]
          ELSE string_to_array(metadata->>'reply_type_tags', ' ')
        END
      WHERE metadata ? 'reply_type_tags'
    `;
    console.log(`📝 replyTypeTags修正: ${replyTagsUpdate}件更新`);
    
    const infoTagsUpdate = await prisma.$executeRaw`
      UPDATE "Templates"
      SET "infoSourceTags" = 
        CASE
          WHEN metadata->>'info_source_tags' IS NULL OR metadata->>'info_source_tags' = '' THEN ARRAY[]::text[]
          ELSE string_to_array(metadata->>'info_source_tags', ' ')
        END
      WHERE metadata ? 'info_source_tags'
    `;
    console.log(`📝 infoSourceTags修正: ${infoTagsUpdate}件更新`);
    
    const situationTagsUpdate = await prisma.$executeRaw`
      UPDATE "Templates"
      SET "situationTags" = 
        CASE
          WHEN metadata->>'situation_tags' IS NULL OR metadata->>'situation_tags' = '' THEN ARRAY[]::text[]
          ELSE string_to_array(metadata->>'situation_tags', ' ')
        END
      WHERE metadata ? 'situation_tags'
    `;
    console.log(`📝 situationTags修正: ${situationTagsUpdate}件更新`);
    
    // 修正後の確認
    const fixedTags = await prisma.$queryRaw`
      SELECT id, title, "replyTypeTags", "infoSourceTags", "situationTags"
      FROM "Templates"
      WHERE id = 134
    `;
    
    console.log('\n📝 修正後のタグ（ID=134）:');
    console.log(JSON.stringify(fixedTags, null, 2));
    
  } catch (error) {
    console.error('❌ タグ分割修正エラー:', error);
  }
}

fixTagSplitting()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 