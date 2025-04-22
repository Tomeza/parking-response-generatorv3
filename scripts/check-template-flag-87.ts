import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // ID=87のエントリを取得して状態を表示
    const entry = await prisma.knowledge.findUnique({
      where: {
        id: 87
      },
      select: { 
        id: true, 
        main_category: true,
        sub_category: true,
        question: true,
        is_template: true 
      }
    });
    
    if (entry) {
      console.log("ID=87の状態:", { 
        id: entry.id, 
        main_category: entry.main_category,
        sub_category: entry.sub_category,
        is_template: entry.is_template 
      });
      
      if (entry.question) {
        console.log(`質問: ${entry.question}`);
      } else {
        console.log('質問: なし');
      }
    } else {
      console.log("ID=87のエントリが見つかりません");
    }
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 