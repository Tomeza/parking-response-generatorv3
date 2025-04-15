import { PrismaClient } from '@prisma/client';

// アルゴリズム実装例に基づいた優先度設定とキーワード強化
const KNOWLEDGE_UPDATES = [
  {
    id: 87, 
    question: '国際線 インターナショナル フライト 海外線 海外便 国際便 国際航空便 海外航空便 インターナショナル便 外国便 空港 海外旅行 外国旅行 海外出張 国際旅行 国際出張 国際ターミナル 国内線不可 利用 利用可能 利用不可 できる できるか できない 不可 使える 使えない 可能 不可能 受付 受付不可 対象 対象外 受け付け 利用制限 制限 制約 受付可能 利用可能範囲 利用条件 適用範囲 対象 対象外 駐車場 パーキング 料金 国際線の利用は可能ですか？ 国際線の利用は可能でしょうか？ 国際線は利用できますか？ 国際線の利用はできますか？ 国際便は使えますか？ 国際便の利用は可能ですか？ インターナショナル便は利用可能ですか？ インターナショナル便は使えますか？ 海外便は利用できますか？ 国際線の場合も利用できますか？ 国際線は使用できますか？ 国際線は対象ですか？ 国際線も対象になりますか？ 国際線は駐車できますか？ 国際線利用時の駐車は可能ですか？ 国際線利用は駐車場を使えますか？ 国際線でも利用可能ですか？ 国際線は利用可能ですか？ 国際線は駐車場を使えますか？',
    answer: '当駐車場は国内線ご利用のお客様専用となっております。国際線をご利用のお客様はご利用いただけません。国際線、インターナショナル便、海外便をご利用の場合は、空港の公共駐車場をご利用ください。当駐車場では国際線の方のご予約はお受けできません。',
    priority: 10,
    usage: '✖️'
  },
  {
    id: 88,
    question: '外車 高級車 外国車 輸入車 駐車 可能 停められる ベンツ メルセデス Mercedes BMW アウディ Audi レクサス Lexus ボルボ Volvo フェラーリ Ferrari ポルシェ Porsche ランボルギーニ Lamborghini マセラティ Maserati ロールスロイス Rolls-Royce バイク オートバイ サイズ 制限 車種 保険 保険対象 対象外 利用可能 利用不可 外車は利用できますか？ 外車で停められますか？ 外車で駐車できますか？ 外車の駐車は可能ですか？ 高級車は停められますか？ レクサスは駐車できますか？ BMWは利用可能ですか？ 輸入車は駐車できますか？ ベンツは停められますか？ 輸入車の駐車は可能ですか？ 外国車は利用できますか？ 高級外車は停められますか？ メルセデスベンツを停めることはできますか？',
    priority: 9,
    usage: '✖️'
  },
  {
    id: 168,
    question: '予約 方法 オンライン予約 ウェブ予約 インターネット予約 予約方法 オンラインで予約 ウェブサイトで予約 インターネットで予約 予約の仕方 オンライン 予約手順 ネット予約 予約サイト webから予約 web予約 予約する方法 予約のやり方 どうやって予約する 予約手続き 予約申込方法 予約する手順 予約はどうすればいい 予約システムの使い方 ネットで予約 オンラインで予約する方法 オンラインで予約するには どのように予約すればいいですか ネットで予約する方法 インターネットでの予約方法 WEBでの予約手順 予約の手続き方法 予約システム 予約ページの使い方 予約方法を教えてください 予約の仕方を教えてください 予約の手順を教えてください どうやって予約すればいいですか オンラインで予約する方法を教えてください ネット予約のやり方を教えてください ウェブサイトでの予約方法を教えてください インターネットで予約する手順を教えてください 予約はどうすればできますか 予約の方法について知りたいです 予約の仕組みを教えてください 予約システムの使い方を教えてください インターネット予約手順 ウェブ予約の方法 予約申し込み方法 オンライン予約方法 ウェブ予約システム 予約サイトの使い方 インターネットからの予約方法 予約フォームの使い方 webからの予約方法 予約する手続き 予約するにはどうすればいいですか 予約申し込み手続き 予約方法がわかりません 予約のやり方教えて 予約したいのですが方法を教えてください 予約の仕方がわかりません 予約申し込みはどうすればいいですか 予約手続きについて教えてください',
    priority: 3,
    usage: '◯'
  }
];

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('知識ベーススコアリング改善のキーワード追加を開始...');
    
    // 各ナレッジエントリを更新
    for (const update of KNOWLEDGE_UPDATES) {
      // 現在のエントリ取得
      const currentEntry = await prisma.knowledge.findUnique({
        where: { id: update.id }
      });
      
      console.log(`ID=${update.id} の更新前:`, { 
        id: currentEntry?.id, 
        main_category: currentEntry?.main_category,
        sub_category: currentEntry?.sub_category,
        question_length: currentEntry?.question?.length,
        is_template: currentEntry?.is_template 
      });
      
      // エントリを更新
      const updatedEntry = await prisma.knowledge.update({
        where: { id: update.id },
        data: {
          question: update.question,
          answer: update.answer || currentEntry?.answer,
          is_template: true // テンプレートフラグを有効化
        }
      });
      
      console.log(`ID=${update.id} の更新後:`, { 
        id: updatedEntry.id, 
        main_category: updatedEntry.main_category,
        sub_category: updatedEntry.sub_category,
        question_length: updatedEntry.question?.length,
        is_template: updatedEntry.is_template 
      });
      
      console.log(`ID=${update.id}, 優先度=${update.priority}, 使用可否=${update.usage} の更新が完了しました`);
      console.log('---');
    }
    
    console.log('知識ベーススコアリング改善の更新が完了しました');
    
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