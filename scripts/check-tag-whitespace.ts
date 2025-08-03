import { prisma } from '../src/lib/db';

async function checkTagWhitespace() {
  console.log('🔍 タグの空白チェックを開始...');
  
  try {
    // 1. replyTypeTagsの空白チェック
    const replyTagsWithSpace = await prisma.$queryRaw`
      SELECT id, title, unnest("replyTypeTags") AS tag
      FROM "Templates" 
      WHERE EXISTS (
        SELECT 1 FROM unnest("replyTypeTags") x WHERE x LIKE '% %'
      )
    `;
    
    console.log('📊 replyTypeTagsの空白チェック:');
    if (Array.isArray(replyTagsWithSpace) && replyTagsWithSpace.length > 0) {
      console.table(replyTagsWithSpace);
    } else {
      console.log('✅ 空白を含む要素なし');
    }
    
    // 2. infoSourceTagsの空白チェック
    const infoTagsWithSpace = await prisma.$queryRaw`
      SELECT id, title, unnest("infoSourceTags") AS tag
      FROM "Templates" 
      WHERE EXISTS (
        SELECT 1 FROM unnest("infoSourceTags") x WHERE x LIKE '% %'
      )
    `;
    
    console.log('\n📊 infoSourceTagsの空白チェック:');
    if (Array.isArray(infoTagsWithSpace) && infoTagsWithSpace.length > 0) {
      console.table(infoTagsWithSpace);
    } else {
      console.log('✅ 空白を含む要素なし');
    }
    
    // 3. situationTagsの空白チェック
    const situationTagsWithSpace = await prisma.$queryRaw`
      SELECT id, title, unnest("situationTags") AS tag
      FROM "Templates" 
      WHERE EXISTS (
        SELECT 1 FROM unnest("situationTags") x WHERE x LIKE '% %'
      )
    `;
    
    console.log('\n📊 situationTagsの空白チェック:');
    if (Array.isArray(situationTagsWithSpace) && situationTagsWithSpace.length > 0) {
      console.table(situationTagsWithSpace);
    } else {
      console.log('✅ 空白を含む要素なし');
    }
    
    // 4. 全体の統計
    const totalWithSpace = (replyTagsWithSpace?.length || 0) + 
                          (infoTagsWithSpace?.length || 0) + 
                          (situationTagsWithSpace?.length || 0);
    
    if (totalWithSpace === 0) {
      console.log('\n✅ 全てのタグで空白を含む要素なし - 正常');
      return true;
    } else {
      console.log(`\n⚠️ 空白を含む要素が${totalWithSpace}件見つかりました`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ タグ空白チェックエラー:', error);
    return false;
  }
}

checkTagWhitespace()
  .then((success) => {
    if (success) {
      console.log('✅ タグの空白チェック完了 - 正常');
    } else {
      console.log('❌ タグの空白チェックで問題が見つかりました');
    }
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 