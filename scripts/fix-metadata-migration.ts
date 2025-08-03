import { prisma } from '../src/lib/db';

async function fixMetadataMigration() {
  console.log('🔄 metadata移送の修正を開始...');
  
  try {
    // 1. original_question → note への移送
    const originalQuestionUpdate = await prisma.$executeRaw`
      UPDATE "Templates"
      SET note = NULLIF(metadata->>'original_question', '')
      WHERE note IS NULL AND metadata ? 'original_question'
    `;
    console.log(`📝 original_question → note: ${originalQuestionUpdate}件更新`);
    
    // 2. source情報の移送
    const categoryUpdate = await prisma.$executeRaw`
      UPDATE "Templates"
      SET 
        source = COALESCE(metadata->>'source', 'csv'),
        "sourceRowId" = CASE 
          WHEN metadata->>'rowId' ~ '^[0-9]+$' THEN (metadata->>'rowId')::int
          ELSE NULL 
        END,
        "sourceHash" = metadata->>'sourceHash'
      WHERE source IS NULL AND metadata IS NOT NULL
    `;
    console.log(`📝 source情報: ${categoryUpdate}件更新`);
    
    // 3. タグ系の移送（空白区切り→配列）
    const originalTagsUpdate = await prisma.$executeRaw`
      UPDATE "Templates"
      SET "replyTypeTags" = 
        CASE
          WHEN metadata->>'reply_type_tags' IS NULL OR metadata->>'reply_type_tags' = '' THEN ARRAY[]::text[]
          ELSE regexp_split_to_array(metadata->>'reply_type_tags', '\\s+')
        END
      WHERE array_length("replyTypeTags", 1) IS NULL OR array_length("replyTypeTags", 1) = 0
    `;
    console.log(`📝 reply_type_tags → replyTypeTags: ${originalTagsUpdate}件更新`);
    
    const infoSourceTagsUpdate = await prisma.$executeRaw`
      UPDATE "Templates"
      SET "infoSourceTags" = 
        CASE
          WHEN metadata->>'info_source_tags' IS NULL OR metadata->>'info_source_tags' = '' THEN ARRAY[]::text[]
          ELSE regexp_split_to_array(metadata->>'info_source_tags', '\\s+')
        END
      WHERE array_length("infoSourceTags", 1) IS NULL OR array_length("infoSourceTags", 1) = 0
    `;
    console.log(`📝 info_source_tags → infoSourceTags: ${infoSourceTagsUpdate}件更新`);
    
    const situationTagsUpdate = await prisma.$executeRaw`
      UPDATE "Templates"
      SET "situationTags" = 
        CASE
          WHEN metadata->>'situation_tags' IS NULL OR metadata->>'situation_tags' = '' THEN ARRAY[]::text[]
          ELSE regexp_split_to_array(metadata->>'situation_tags', '\\s+')
        END
      WHERE array_length("situationTags", 1) IS NULL OR array_length("situationTags", 1) = 0
    `;
    console.log(`📝 situation_tags → situationTags: ${situationTagsUpdate}件更新`);
    
    // 4. usageLabel の移送
    const usageLabelUpdate = await prisma.$executeRaw`
      UPDATE "Templates"
      SET "usageLabel" = metadata->>'usageLabel'
      WHERE "usageLabel" IS NULL AND metadata ? 'usageLabel'
    `;
    console.log(`📝 usageLabel: ${usageLabelUpdate}件更新`);
    
    // 5. 確認クエリ
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT("note") FILTER (WHERE "note" IS NOT NULL) as cnt_note,
        COUNT(source) FILTER (WHERE source IS NOT NULL) as cnt_source,
        COUNT("replyTypeTags") FILTER (WHERE array_length("replyTypeTags", 1) > 0) as cnt_reply_tags,
        COUNT("infoSourceTags") FILTER (WHERE array_length("infoSourceTags", 1) > 0) as cnt_info_tags,
        COUNT("situationTags") FILTER (WHERE array_length("situationTags", 1) > 0) as cnt_situation_tags,
        COUNT("usageLabel") FILTER (WHERE "usageLabel" IS NOT NULL) as cnt_usage_label
      FROM "Templates"
    `;
    
    console.log('\n📊 移送後の統計:');
    console.table(stats);
    
    // 6. サンプル確認（ID=134）
    const sample = await prisma.$queryRaw`
      SELECT id, title, "note", source, "replyTypeTags", "infoSourceTags", "situationTags", "usageLabel"
      FROM "Templates"
      WHERE id = 134
    `;
    
    console.log('\n📝 サンプル確認（ID=134）:');
    console.log(JSON.stringify(sample, null, 2));
    
  } catch (error) {
    console.error('❌ metadata移送エラー:', error);
  }
}

fixMetadataMigration()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 