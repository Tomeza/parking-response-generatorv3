const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addKnowledge() {
  try {
    console.log('====== 不足しているナレッジを追加します ======');
    
    // 追加するナレッジデータ
    const knowledgeEntries = [
      // 予約変更に関するナレッジ
      {
        main_category: '予約関連',
        sub_category: '変更方法',
        question: '予約を変更したいのですが、どのようにすればよいですか？',
        answer: 'ご予約の変更は、マイページから行うことができます。「予約確認・変更」メニューにアクセスし、変更したい予約を選択して、内容を修正してください。なお、ご利用日の前日17時以降の変更はお電話での対応となります。'
      },
      {
        main_category: '予約関連',
        sub_category: '変更方法',
        question: '予約の変更方法を教えてください',
        answer: 'ご予約の変更は以下の方法で承っております。\n1. オンライン：マイページ「予約確認・変更」から変更可能です（ご利用日前日17時まで）\n2. お電話：ご利用日前日17時以降の変更は、お客様センター(0120-XXX-XXX)までご連絡ください。\n※車種・利用期間によっては追加料金が発生する場合がございます。'
      },
      {
        main_category: '予約関連',
        sub_category: '変更方法',
        question: '予約の日程を変更したい',
        answer: '日程変更は、ご利用日の前日17時までであればマイページから24時間いつでも変更可能です。「予約確認・変更」メニューから該当予約を選択し、新しい日程をご指定ください。前日17時以降の変更は、お客様センターへのお電話での受付となります。なお、空き状況によってはご希望に添えない場合もございます。'
      },
      {
        main_category: '料金関連',
        sub_category: '変更料金',
        question: '予約の変更に料金はかかりますか？',
        answer: '予約変更の料金については、変更内容によって異なります。\n・日時の変更のみ：無料（ただし料金プランが変わる場合は差額が発生）\n・車種の変更：車種によっては差額料金が発生\n・利用期間の延長：追加日数分の料金が発生\nなお、ご利用日当日の変更については、状況により別途変更手数料が発生する場合がございます。'
      },
      
      // キャンセル方法に関するナレッジ
      {
        main_category: '予約関連',
        sub_category: 'キャンセル',
        question: 'キャンセルの方法を教えてください',
        answer: 'ご予約のキャンセルは以下の方法で承っております。\n1. オンライン：マイページ「予約確認・変更」からキャンセル手続きが可能です（ご利用日前日17時まで）\n2. お電話：ご利用日前日17時以降のキャンセルは、お客様センター(0120-XXX-XXX)までご連絡ください。\n※キャンセル時期によってはキャンセル料が発生いたします。詳細は「キャンセルポリシー」をご確認ください。'
      },
      {
        main_category: '料金関連',
        sub_category: 'キャンセル料',
        question: 'キャンセル料は発生しますか？',
        answer: 'キャンセル料は以下のタイミングで発生いたします。\n・ご利用日の7日前まで：無料\n・ご利用日の6日前〜2日前：予約料金の30%\n・ご利用日の前日：予約料金の50%\n・ご利用当日・無連絡不使用：予約料金の100%\nなお、台風などの自然災害やフライトキャンセルなど、やむを得ない事情の場合は、証明書類のご提示により減免措置を検討させていただきます。'
      },
      
      // 外車に関するナレッジ
      {
        main_category: '車両関連',
        sub_category: '車種制限',
        question: '外車を駐車できますか？',
        answer: '外車（輸入車）の駐車も可能ですが、一部対応できない車種がございます。特に大型の輸入車や、高級車（レクサス、BMW、ベンツなど）については、車両保険の対象外となる場合がございますので、予約前にお電話にてご確認ください。また、大型のSUVなど車高の高い車種は、立体駐車場の一部エリアに駐車できない場合がございます。'
      },
      {
        main_category: '車両関連',
        sub_category: '車種制限',
        question: 'BMWやベンツなどの高級車でも利用できますか？',
        answer: 'BMWやベンツなどの高級輸入車については基本的にご利用いただけますが、保険の関係上、車両価格や年式によっては事前確認が必要な場合がございます。3000万円以上の高級車や特殊車両については、予約時にお電話でご相談ください。万が一の事故・トラブル時の補償範囲に制限がある旨をご理解いただいた上で、ご利用をお願いしております。'
      },
      
      // 予約確認に関するナレッジ
      {
        main_category: '利用の流れ',
        sub_category: '予約確認',
        question: '予約確認はどうすればよいですか？',
        answer: 'ご予約の確認は、以下の方法で行うことができます。\n1. マイページにログイン：「予約確認・変更」メニューから現在のご予約状況をご確認いただけます。\n2. 予約確認メール：ご予約完了時に自動送信される予約確認メールをご確認ください。\n3. お電話での確認：お客様センター(0120-XXX-XXX)にお電話いただければ、予約状況をお調べいたします。\nご予約番号とお名前をお手元にご用意の上、ご確認ください。'
      },
      
      // 国際線利用に関するナレッジ
      {
        main_category: '記入情報',
        sub_category: 'フライト情報',
        question: '国際線を利用する場合の予約方法を教えてください',
        answer: '国際線をご利用の場合も、通常の予約手続きと同様にオンラインから予約可能です。予約時に以下の点にご注意ください。\n1. フライト情報欄に国際線の便名と時刻を正確にご入力ください\n2. 国際線は出発・到着時に時間がかかる場合があるため、余裕を持った送迎時間を設定してください\n3. 帰国時の入国手続きに時間がかかる場合があるため、到着時間から送迎バスの時間まで最低60分以上の余裕を持たせることをお勧めします\n4. 税関申告等で大幅に遅れる場合は、到着ロビーからお電話でご連絡ください'
      }
    ];
    
    // データベースに追加
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const entry of knowledgeEntries) {
      // 同じ質問がすでに存在するか確認
      const existing = await prisma.knowledge.findFirst({
        where: {
          question: entry.question
        }
      });
      
      if (existing) {
        console.log(`スキップ: "${entry.question.substring(0, 30)}..."（既存）`);
        skippedCount++;
      } else {
        // 新しいナレッジを追加
        const newKnowledge = await prisma.knowledge.create({
          data: entry
        });
        
        console.log(`追加: ID=${newKnowledge.id}, "${entry.question.substring(0, 30)}..."`);
        addedCount++;
      }
    }
    
    console.log(`\n====== 結果 ======`);
    console.log(`追加されたナレッジ: ${addedCount}件`);
    console.log(`スキップされたナレッジ: ${skippedCount}件`);
    
    // 更新後のカテゴリを表示
    const updatedCategories = await prisma.$queryRaw`
      SELECT DISTINCT main_category, sub_category 
      FROM "Knowledge" 
      WHERE main_category = '予約関連' OR sub_category = '変更方法' OR sub_category = 'キャンセル'
      ORDER BY main_category, sub_category
    `;
    
    console.log('\n更新後の関連カテゴリ:');
    console.table(updatedCategories);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addKnowledge(); 