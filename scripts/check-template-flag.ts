import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // 確認するIDのリスト
    const idsToCheck = [1, 88];
    
    console.log('テンプレートフラグ状態の確認:');
    for (const id of idsToCheck) {
      const entry = await prisma.knowledge.findUnique({
        where: { id },
        select: { 
          id: true, 
          main_category: true,
          sub_category: true,
          question: true,
          is_template: true 
        }
      });
      
      if (entry) {
        console.log(`ID=${id}, カテゴリ=${entry.main_category}/${entry.sub_category}, is_template=${entry.is_template}`);
        if (entry.question) {
          console.log(`質問: ${entry.question.substring(0, 100)}${entry.question.length > 100 ? '...' : ''}`);
        } else {
          console.log('質問: なし');
        }
        console.log('---');
      } else {
        console.log(`ID=${id}: エントリが見つかりません`);
      }
    }
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