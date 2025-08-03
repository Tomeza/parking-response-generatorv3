import { prisma } from '../src/lib/db';

async function addPartialUniqueConstraint() {
  console.log('🔒 部分ユニーク制約の追加を開始...');
  
  try {
    // 1. 現在の承認状況を確認
    const approvedStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "is_approved" = true) as approved_count,
        COUNT(*) FILTER (WHERE status = 'approved') as status_approved_count
      FROM "Templates"
    `;
    
    console.log('📊 現在の承認状況:');
    console.table(approvedStats);
    
    // 2. 重複チェック（承認済みの組み合わせ）
    const duplicates = await prisma.$queryRaw`
      SELECT category, intent, tone, COUNT(*) as count, array_agg(id) as ids
      FROM "Templates"
      WHERE status = 'approved'
      GROUP BY category, intent, tone
      HAVING COUNT(*) > 1
    `;
    
    if (Array.isArray(duplicates) && duplicates.length > 0) {
      console.log('❌ 重複が見つかりました:');
      console.table(duplicates);
      console.log('⚠️ 重複を解決してから制約を追加してください');
      return false;
    }
    
    console.log('✅ 重複なし - 制約追加可能');
    
    // 3. 部分ユニーク制約の追加（承認済みのみ）
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_approved_unique
        ON "Templates"(category, intent, tone)
        WHERE status = 'approved'
    `;
    
    console.log('✅ 部分ユニーク制約を追加しました');
    
    // 4. 制約の確認
    const constraintCheck = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE indexname = 'uq_templates_approved_unique'
    `;
    
    console.log('📊 追加された制約:');
    console.table(constraintCheck);
    
    return true;
    
  } catch (error) {
    console.error('❌ 制約追加エラー:', error);
    return false;
  }
}

addPartialUniqueConstraint()
  .then((success) => {
    if (success) {
      console.log('✅ 部分ユニーク制約の追加が完了しました');
    } else {
      console.log('❌ 部分ユニーク制約の追加に失敗しました');
    }
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 