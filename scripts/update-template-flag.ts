import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // ID=62のエントリの情報を表示
    const entry = await prisma.knowledge.findUnique({
      where: {
        id: 62
      }
    });
    
    console.log('更新前の情報:');
    console.log(entry);
    
    // is_template フラグを false に更新
    const updatedEntry = await prisma.knowledge.update({
      where: {
        id: 62
      },
      data: {
        is_template: false
      }
    });
    
    console.log('更新後の情報:');
    console.log(updatedEntry);
    
    console.log('is_template フラグの更新が完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 