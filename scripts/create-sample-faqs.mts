import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// サンプルFAQデータ
const sampleFaqs = [
  // 既存の基本的なFAQ
  {
    question: "駐車場の予約方法を教えてください",
    answer: "駐車場の予約は、以下の手順で行えます：\n1. ウェブサイトにアクセス\n2. 希望の駐車場を検索\n3. 利用日時を選択\n4. 予約内容を確認\n5. お支払い情報を入力\n6. 予約完了メールを確認\n\n24時間前までのご予約をお願いしています。",
    category: "basic"
  },
  {
    question: "キャンセルはいつまでできますか？",
    answer: "キャンセルは利用開始時間の6時間前まで可能です。それ以降のキャンセルは全額のキャンセル料が発生します。キャンセルは予約確認メールに記載されているリンクから、またはマイページから行えます。",
    category: "basic"
  },
  {
    question: "支払い方法は何がありますか？",
    answer: "以下の支払い方法をご利用いただけます：\n・クレジットカード（VISA、Mastercard、JCB、American Express）\n・PayPay\n・LINE Pay\n・d払い\n\nなお、現金でのお支払いは受け付けておりません。",
    category: "basic"
  },
  {
    question: "予約の変更は可能ですか？",
    answer: "予約の変更は、利用開始時間の12時間前まで可能です。変更は予約確認メールのリンクまたはマイページから行えます。ただし、空き状況によっては希望の時間に変更できない場合がございます。",
    category: "basic"
  },
  {
    question: "領収書は発行できますか？",
    answer: "はい、領収書の発行が可能です。予約完了後、マイページの「領収書発行」ボタンから、PDFまたは紙での領収書を発行できます。宛名や但し書きの変更も可能です。",
    category: "basic"
  },
  // 複雑なケース
  {
    question: "予約した駐車場に入れない場合はどうすればいいですか？",
    answer: "駐車場に入れない場合は、以下の手順で対応をお願いします：\n\n1. まず、駐車場入口に記載の緊急連絡先（24時間対応）にご連絡ください\n2. オペレーターに予約番号と状況をお伝えください\n3. 係員が現地で対応、または代替駐車場をご案内します\n\n※システム障害の場合は、後日、利用料金を全額返金いたします。\n※お客様都合（車両サイズ超過など）の場合は、返金対象外となります。\n\n予約時に必ず車両サイズ制限をご確認ください。",
    category: "complex"
  },
  {
    question: "台風や大雨の場合のキャンセルについて教えてください",
    answer: "気象警報発令時の対応は以下の通りです：\n\n【警報発令時の無料キャンセル条件】\n・利用予定時間帯に、利用駐車場エリアで警報（大雨、暴風、特別警報等）が発令されている場合\n・利用予定時間帯に、利用駐車場エリアで避難指示が発令されている場合\n\n【手続き方法】\n1. マイページまたは予約確認メールからキャンセル手続き\n2. キャンセルフォームの「理由選択」で「警報発令」を選択\n3. 該当警報の発令状況を確認後、自動的にキャンセル料金が無料となります\n\n※警報解除後のキャンセルは通常のキャンセル規定が適用されます。",
    category: "complex"
  },
  {
    question: "予約した時間に遅れそうな場合はどうすればいいですか？",
    answer: "予約時間に遅れる場合の対応は以下の通りです：\n\n【30分以内の遅延の場合】\n・マイページから遅延申請が可能です\n・追加料金なしで利用時間を30分延長できます\n\n【30分以上の遅延が見込まれる場合】\n1. カスタマーサポートに電話連絡（予約番号をお伝えください）\n2. 空き状況により、予約時間の変更を案内\n3. 変更できない場合は、通常のキャンセル規定が適用\n\n※事前連絡なく30分以上の遅延の場合、予約は自動キャンセルとなり、キャンセル料金が発生します。",
    category: "complex"
  },
  {
    question: "月極駐車場への切り替えは可能ですか？",
    answer: "はい、以下の条件で時間貸し駐車場から月極駐車場への切り替えが可能です：\n\n【切り替え条件】\n・同一駐車場で3ヶ月以上の継続利用実績\n・月極の空き区画があること\n・身分証明書と車検証の提出\n・保証金の支払い（1ヶ月分の月極料金）\n\n【切り替えメリット】\n・基本料金から15%割引\n・予約不要で確実に駐車可能\n・請求書払い対応可能\n\n【申込手順】\n1. マイページから月極切り替え申請\n2. 審査（約3営業日）\n3. 契約書類の郵送\n4. 契約書返送と保証金のお支払い\n5. 月極利用開始\n\n※法人契約の場合は、別途ご相談ください。",
    category: "complex"
  },
  {
    question: "電気自動車の充電設備がある駐車場を探したいのですが",
    answer: "電気自動車（EV）充電設備付き駐車場は以下の方法で検索・予約できます：\n\n【検索方法】\n1. 通常の駐車場検索画面で「詳細条件」をクリック\n2. 「設備・オプション」から「EV充電」にチェック\n\n【充電設備の種類】\n・普通充電（200V）：全てのEV対応\n・急速充電：CHAdeMO規格対応車のみ\n\n【料金体系】\n・基本駐車料金＋充電料金（30分単位）\n・普通充電：15分100円\n・急速充電：15分300円\n\n【ご利用時の注意点】\n・充電スペースは予約制\n・充電ケーブルは標準装備\n・他の車両の充電完了後30分以上の放置は追加料金\n・充電トラブル時は24時間サポート対応\n\n※車種により利用できない充電設備もございます。予約時に必ず対応車種をご確認ください。",
    category: "complex"
  }
];

async function createSampleFaqs() {
  try {
    console.log('Creating sample FAQ data...');

    // RAWデータの作成
    for (const faq of sampleFaqs) {
      await prisma.faqRaw.create({
        data: {
          question: faq.question,
          answer: faq.answer
        }
      });
    }

    console.log(`Created ${sampleFaqs.length} raw FAQ entries`);

    // 作成されたデータの確認
    const createdFaqs = await prisma.faqRaw.findMany({
      orderBy: { id: 'asc' }
    });

    console.log('\nCreated FAQ entries:');
    createdFaqs.forEach(faq => {
      console.log(`\nID: ${faq.id}`);
      console.log(`Question: ${faq.question}`);
      console.log(`Answer: ${faq.answer}`);
    });

  } catch (error) {
    console.error('Error creating sample FAQs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createSampleFaqs()
    .catch(console.error);
}

export { createSampleFaqs }; 