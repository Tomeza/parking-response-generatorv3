import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // 更新するIDのリストを定義
    const idsToUpdate = [63, 167, 164, 165];  // ID=165を追加
    
    // 更新前の状態を確認
    console.log('更新前:');
    for (const id of idsToUpdate) {
      const beforeEntry = await prisma.knowledge.findUnique({
        where: { id },
        select: { id: true, is_template: true }
      });
      console.log(`ID=${id}: is_template=${beforeEntry?.is_template}`);
    }
    
    // 複数IDのis_templateフラグをfalseに更新
    const updateResult = await prisma.knowledge.updateMany({
      where: {
        id: {
          in: idsToUpdate
        }
      },
      data: {
        is_template: false
      }
    });
    
    console.log(`更新後:`);
    for (const id of idsToUpdate) {
      const afterEntry = await prisma.knowledge.findUnique({
        where: { id },
        select: { id: true, is_template: true }
      });
      console.log(`ID=${id}: is_template=${afterEntry?.is_template}`);
    }
    
    console.log(`${updateResult.count}件のエントリを更新しました`);
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 