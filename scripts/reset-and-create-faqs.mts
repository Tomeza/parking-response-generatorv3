import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// 実運用QAベースのサンプルFAQデータ
const sampleFaqs = [
  // 送迎サービス関連
  {
    question: "5名を超えて送迎を利用したい場合は？",
    answer: `送迎車の定員は最大5名（お子様含む）です。安全基準上、抱っこを含め6名以上での乗車はできません。
6名以上でご利用の場合、2台配車（2台分のご予約）または「ひとり送迎プラン」をご検討ください。`,
    category: "送迎/定員"
  },
  {
    question: "国際線への送迎は可能ですか？",
    answer: `送迎サービスは国内線のみ対応しております。国際線をご利用の場合、空港連絡バスや公共交通機関をご利用ください。`,
    category: "送迎/路線制限"
  },
  {
    question: "外車や大型車も送迎対応していますか？",
    answer: `外車、全長5m超の大型車、特殊車両は送迎対象外です。国産乗用車・ワンボックスのみとなります。該当の場合は事前にご相談ください。`,
    category: "送迎/車種制限"
  },
  // 予約・支払い
  {
    question: "予約方法は？いつまで予約可能？",
    answer: `Webサイトの予約フォームより、ご利用希望日の前日23:59までにご予約ください。電話やLINEでのご予約は受け付けておりません。`,
    category: "予約"
  },
  {
    question: "予約期間中に一部満車日がある場合の対応は？",
    answer: `ご予約は全日程に空きがある場合のみ成立します。一部日程のみ満車の場合、他の日付で再度ご確認ください。`,
    category: "予約/空き状況"
  },
  // 支払い・領収書
  {
    question: "領収書や明細は発行できますか？",
    answer: `予約完了後、マイページよりPDF形式の領収書を発行できます。宛名・但し書きの変更も可能です。紙での郵送をご希望の場合はお問い合わせください。`,
    category: "支払い/領収書"
  },
  // トラブル・例外対応
  {
    question: "予約した駐車場に入れない場合の連絡先は？",
    answer: `駐車場入口の看板に記載の24時間緊急ダイヤルへご連絡ください。状況確認後、係員が対応または代替スペースをご案内します。`,
    category: "トラブル/入庫不可"
  },
  {
    question: "電気自動車（EV）の充電はできますか？",
    answer: `「EV充電設備あり」の駐車場のみ対応。検索画面で「EV充電」にチェックを入れてください。急速・普通充電の種類、利用料金は各駐車場案内でご確認ください。`,
    category: "設備/EV"
  },
  // 変更・キャンセル・ルール
  {
    question: "キャンセル・変更はいつまで可能？",
    answer: `予約のキャンセルは利用開始6時間前まで、変更は12時間前までWebサイトのマイページから可能です。それ以降は規定のキャンセル料が発生します。`,
    category: "予約/キャンセル"
  },
  {
    question: "幼児は定員に含まれますか？",
    answer: `はい、抱っこやチャイルドシート利用時も「1名」としてカウントします。定員超過は安全上できません。`,
    category: "送迎/定員"
  }
];

async function resetAndCreateFaqs() {
  try {
    console.log('Resetting FAQ data...');

    // 既存データの削除
    await prisma.faqRaw.deleteMany({});
    console.log('Existing FAQ data cleared');

    // 新しいデータの作成
    for (const faq of sampleFaqs) {
      await prisma.faqRaw.create({
        data: {
          question: faq.question,
          answer: faq.answer,
          category: faq.category
        }
      });
    }

    console.log(`Created ${sampleFaqs.length} new FAQ entries`);

    // 作成されたデータの確認
    const createdFaqs = await prisma.faqRaw.findMany({
      orderBy: { id: 'asc' }
    });

    console.log('\nCreated FAQ entries:');
    createdFaqs.forEach(faq => {
      console.log(`\nID: ${faq.id}`);
      console.log(`Category: ${faq.category}`);
      console.log(`Question: ${faq.question}`);
      console.log(`Answer: ${faq.answer}`);
    });

  } catch (error) {
    console.error('Error resetting and creating FAQs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  resetAndCreateFaqs()
    .catch(console.error);
}

export { resetAndCreateFaqs }; 