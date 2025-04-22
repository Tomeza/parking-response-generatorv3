import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // ID=21のエントリを取得
    const entry = await prisma.knowledge.findUnique({
      where: { id: 21 }
    });
    
    if (!entry) {
      console.log('ID=21のエントリが見つかりませんでした。');
      return;
    }
    
    console.log('更新前のエントリ:');
    console.log(`ID: ${entry.id}`);
    console.log(`質問: ${entry.question}`);
    console.log(`テンプレート: ${entry.is_template}`);
    
    // テンプレートフラグをfalseに更新
    const updatedEntry = await prisma.knowledge.update({
      where: { id: 21 },
      data: { is_template: false }
    });
    
    console.log('\n更新後のエントリ:');
    console.log(`ID: ${updatedEntry.id}`);
    console.log(`質問: ${updatedEntry.question}`);
    console.log(`テンプレート: ${updatedEntry.is_template}`);
    
    console.log('\nテンプレートフラグを正常に更新しました。');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 