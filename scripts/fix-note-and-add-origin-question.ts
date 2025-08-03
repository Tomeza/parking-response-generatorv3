import { prisma } from '../src/lib/db';

async function fixNoteAndAddOriginQuestion() {
  console.log('🔄 note巻き戻しとoriginQuestion追加を開始...');
  
  try {
    // 1. 問題のあるnoteを確認
    const problematicNotes = await prisma.$queryRaw`
      SELECT id, title, note, metadata->>'note' AS meta_note, metadata->>'original_question' AS oq
      FROM "Templates"
      WHERE note = metadata->>'original_question' AND metadata ? 'note'
    `;
    
    console.log('📊 問題のあるnote確認:');
    console.table(problematicNotes);
    
    // 2. noteを元に戻す
    const noteRevertCount = await prisma.$executeRaw`
      UPDATE "Templates"
      SET note = metadata->>'note'
      WHERE note = metadata->>'original_question' AND metadata ? 'note'
    `;
    console.log(`📝 note巻き戻し: ${noteRevertCount}件`);
    
    // 3. originQuestionカラムを追加
    await prisma.$executeRaw`
      ALTER TABLE "Templates" ADD COLUMN IF NOT EXISTS "originQuestion" text
    `;
    console.log('✅ originQuestionカラムを追加');
    
    // 4. original_questionをoriginQuestionに移送
    const originQuestionCount = await prisma.$executeRaw`
      UPDATE "Templates"
      SET "originQuestion" = NULLIF(metadata->>'original_question','')
      WHERE "originQuestion" IS NULL AND metadata ? 'original_question'
    `;
    console.log(`📝 original_question → originQuestion: ${originQuestionCount}件移送`);
    
    // 5. 確認
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT("note") FILTER (WHERE "note" IS NOT NULL) as cnt_note,
        COUNT("originQuestion") FILTER (WHERE "originQuestion" IS NOT NULL) as cnt_origin_question
      FROM "Templates"
    `;
    
    console.log('\n📊 修正後の統計:');
    console.table(stats);
    
    // 6. サンプル確認（ID=134）
    const sample = await prisma.$queryRaw`
      SELECT id, title, note, "originQuestion"
      FROM "Templates"
      WHERE id = 134
    `;
    
    console.log('\n📝 サンプル確認（ID=134）:');
    console.log(JSON.stringify(sample, null, 2));
    
    return true;
    
  } catch (error) {
    console.error('❌ note修正エラー:', error);
    return false;
  }
}

fixNoteAndAddOriginQuestion()
  .then((success) => {
    if (success) {
      console.log('✅ note修正とoriginQuestion追加が完了しました');
    } else {
      console.log('❌ note修正に失敗しました');
    }
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 