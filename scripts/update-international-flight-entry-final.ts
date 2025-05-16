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
      answer: entryBefore?.answer,
      is_template: entryBefore?.is_template 
    });
    
    // さらに強化されたキーワードと質問文を作成
    const enhancedQuestion = "国際線 インターナショナル 海外線 海外便 フライト 国際便 空港 利用 可能 できる 使える 不可 不可能 できない 利用不可 使用不可 利用制限 制限 制約 受け付け 受付可能 受付不可 利用可能範囲 利用条件 適用範囲 対象 対象外 駐車場 パーキング 国際線の利用は可能ですか？ 国際線の利用は可能でしょうか？ 国際線は利用できますか？ 国際線の利用はできますか？ 国際便は使えますか？ 国際便の利用は可能ですか？ インターナショナル便は利用可能ですか？ インターナショナル便は使えますか？ 海外便は利用できますか？ 国際線の場合も利用できますか？ 国際線は使用できますか？ 国際線は対象ですか？ 国際線も対象になりますか？ 国際線は駐車できますか？ 国際線利用時の駐車は可能ですか？ 国際線利用は駐車場を使えますか？ 国際線でも利用可能ですか？ 国際線は利用可能ですか？";
    
    // より詳細な回答文を作成
    const enhancedAnswer = "当駐車場は国内線ご利用のお客様専用となっております。国際線をご利用のお客様はご利用いただけません。国際線、インターナショナル便、海外便をご利用の場合は、空港の公共駐車場をご利用ください。当駐車場では国際線の方のご予約はお受けできません。";
    
    // ID=87のエントリの質問文と回答文を更新
    const updatedEntry = await prisma.knowledge.update({
      where: {
        id: 87
      },
      data: {
        question: enhancedQuestion,
        answer: enhancedAnswer,
        is_template: true // 優先度を確実に高くする
      }
    });
    
    console.log("更新後:", { 
      id: updatedEntry.id, 
      main_category: updatedEntry.main_category,
      sub_category: updatedEntry.sub_category,
      question: updatedEntry.question ? updatedEntry.question.substring(0, 100) + '...' : 'なし',
      answer: updatedEntry.answer,
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