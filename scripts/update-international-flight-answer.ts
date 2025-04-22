import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // ID=87のエントリを取得して現在の状態を表示
    const entryBefore = await prisma.knowledge.findUnique({
      where: {
        id: 87
      }
    });
    
    console.log("更新前:", { 
      id: entryBefore?.id, 
      main_category: entryBefore?.main_category,
      sub_category: entryBefore?.sub_category,
      answer: entryBefore?.answer,
      is_template: entryBefore?.is_template 
    });
    
    // より詳細な回答文を作成
    const enhancedAnswer = "当駐車場は国内線ご利用のお客様専用となっております。国際線をご利用のお客様はご利用いただけません。国際線、インターナショナル便、海外便をご利用の場合は、空港の公共駐車場をご利用ください。";
    
    // ID=87のエントリの回答文を更新
    const updatedEntry = await prisma.knowledge.update({
      where: {
        id: 87
      },
      data: {
        answer: enhancedAnswer
      }
    });
    
    console.log("更新後:", { 
      id: updatedEntry.id, 
      main_category: updatedEntry.main_category,
      sub_category: updatedEntry.sub_category,
      answer: updatedEntry.answer,
      is_template: updatedEntry.is_template 
    });
    
    console.log("ID=87の国際線エントリの回答を正常に更新しました");
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