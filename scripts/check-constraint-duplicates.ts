import { prisma } from '../src/lib/db';

async function checkConstraintDuplicates() {
  console.log('🔍 制約キーでの重複チェックを開始...');
  
  try {
    // 制約キーでの重複チェック
    const duplicates = await prisma.$queryRaw`
      SELECT category, intent, tone, title, version, COUNT(*) as count, array_agg(id) as ids
      FROM "Templates"
      GROUP BY category, intent, tone, title, version
      HAVING COUNT(*) > 1
    `;
    
    if (Array.isArray(duplicates) && duplicates.length > 0) {
      console.log('❌ 重複が見つかりました:');
      console.table(duplicates);
      return false;
    } else {
      console.log('✅ 制約キーでの重複は見つかりませんでした');
      return true;
    }
  } catch (error) {
    console.error('❌ 重複チェックエラー:', error);
    return false;
  }
}

checkConstraintDuplicates()
  .then((isValid) => {
    if (isValid) {
      console.log('✅ 制約キーでの重複チェック完了 - 制約追加可能');
    } else {
      console.log('❌ 制約キーでの重複あり - 制約追加不可');
    }
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 