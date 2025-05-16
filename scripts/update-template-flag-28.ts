import { PrismaClient } from '@prisma/client';

/**
 * ID=28のis_templateフラグをfalseに変更するスクリプト
 */
async function main() {
  const prisma = new PrismaClient();
  
  try {
    // ID=28のエントリーを取得
    const entry = await prisma.knowledge.findUnique({
      where: { id: 28 }
    });
    
    if (!entry) {
      console.log('ID=28のエントリーが見つかりませんでした');
      return;
    }
    
    console.log('更新前のエントリー:', {
      id: entry.id,
      main_category: entry.main_category,
      sub_category: entry.sub_category,
      is_template: entry.is_template
    });
    
    // is_templateフラグをfalseに更新
    const updatedEntry = await prisma.knowledge.update({
      where: { id: 28 },
      data: { is_template: false }
    });
    
    console.log('更新後のエントリー:', {
      id: updatedEntry.id,
      main_category: updatedEntry.main_category,
      sub_category: updatedEntry.sub_category,
      is_template: updatedEntry.is_template
    });
    
    console.log('ID=28のis_templateフラグをfalseに更新しました');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  }); 