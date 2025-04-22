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
      question: entryBefore?.question,
      is_template: entryBefore?.is_template 
    });
    
    // キーワードを追加した新しい質問文を作成
    const enhancedQuestion = "国際線 インターナショナル 海外線 海外便 フライト 国際便 空港 利用 可能 できる 使える 可否 受け付け 受付可能 利用可能範囲 利用条件 適用範囲 対象 駐車場 パーキング 国際線の利用は可能ですか？ 国際線は利用できますか？ 国際線の利用はできますか？ 国際便は使えますか？ 国際便の利用は可能ですか？ インターナショナル便は使えますか？ 海外便は利用できますか？ 国際線の場合も利用できますか？";
    
    // ID=87のエントリの質問文を更新
    const updatedEntry = await prisma.knowledge.update({
      where: {
        id: 87
      },
      data: {
        question: enhancedQuestion,
        is_template: true // 優先度を上げるためにテンプレートフラグを有効化
      }
    });
    
    console.log("更新後:", { 
      id: updatedEntry.id, 
      main_category: updatedEntry.main_category,
      sub_category: updatedEntry.sub_category,
      question: updatedEntry.question,
      is_template: updatedEntry.is_template 
    });
    
    console.log("ID=87の国際線エントリを正常に更新しました");
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