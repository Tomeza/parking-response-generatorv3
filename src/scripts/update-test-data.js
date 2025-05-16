/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * テスト用のデータを追加するスクリプト
 */
async function updateTestData() {
  console.log('🔄 テスト用データの追加を開始します...');

  try {
    // 追加するテストデータ
    const testData = [
      {
        question: '予約はどのように行えますか？',
        answer: '予約は公式Webサイトからオンラインで行うことができます。必要な情報（氏名、電話番号、車のナンバー、利用日時など）を入力して送信してください。予約完了後、確認メールが送信されます。',
        main_category: '予約関連',
        sub_category: '予約方法',
        detail_category: 'オンライン予約'
      },
      {
        question: '予約の変更方法を教えてください',
        answer: '予約の変更は、予約確認メールに記載されている予約番号をお手元にご用意の上、「予約変更フォーム」からお手続きください。予約日の3日前までであれば無料で変更可能です。それ以降は変更手数料が発生する場合があります。',
        main_category: '予約関連',
        sub_category: '予約変更',
        detail_category: '変更手続き'
      },
      {
        question: '料金について教えてください',
        answer: '料金は駐車時間と車種によって異なります。一般車両は1日あたり3,000円から、大型車両は4,500円からとなっています。長期割引や早期予約割引もご用意しております。詳細な料金表は公式Webサイトでご確認いただけます。',
        main_category: '料金案内',
        sub_category: '基本料金',
        detail_category: '料金体系'
      },
      {
        question: '国際線を利用する場合の予約方法',
        answer: '国際線をご利用の場合も、通常の予約方法と同じです。ただし、フライトの遅延等に備えて、余裕を持った駐車時間の設定をおすすめします。国際線専用の長期割引プランもございますので、ご検討ください。',
        main_category: '予約関連',
        sub_category: '国際線利用',
        detail_category: '国際線対応'
      },
      {
        question: '予約確認はどうすればよいですか',
        answer: '予約確認は「予約確認フォーム」から予約番号と登録したメールアドレスを入力することでいつでも確認可能です。また、予約完了時に送信される確認メールにも予約内容が記載されています。',
        main_category: '予約関連',
        sub_category: '予約確認',
        detail_category: '確認方法'
      },
      {
        question: '送迎バスの時間',
        answer: '送迎バスは空港と駐車場間を1時間おきに運行しています。朝5時から夜22時までの間でご利用いただけます。詳細な時刻表はWebサイトまたは予約確認メールでご確認ください。繁忙期は臨時便も運行しています。',
        main_category: '利用サービス',
        sub_category: '送迎バス',
        detail_category: '運行時間'
      },
      {
        question: 'キャンセルの方法',
        answer: 'キャンセルは「予約キャンセルフォーム」から予約番号と登録したメールアドレスを入力して手続きできます。利用開始日の7日前までは無料でキャンセル可能ですが、それ以降はキャンセル料が発生します。',
        main_category: '予約関連',
        sub_category: 'キャンセル',
        detail_category: 'キャンセル手続き'
      }
    ];
    
    // データの存在チェックと追加
    console.log('📝 既存のデータをチェック中...');
    
    for (const data of testData) {
      // 同じ質問が既に存在するか確認
      const existing = await prisma.knowledge.findFirst({
        where: {
          question: data.question
        }
      });
      
      if (existing) {
        console.log(`📌 質問「${data.question.substring(0, 30)}...」は既に存在します。スキップします。`);
      } else {
        // 新しいデータを追加
        const newEntry = await prisma.knowledge.create({
          data: {
            question: data.question,
            answer: data.answer,
            main_category: data.main_category,
            sub_category: data.sub_category,
            detail_category: data.detail_category
          }
        });
        
        console.log(`✅ 新しい質問「${data.question.substring(0, 30)}...」を追加しました。ID: ${newEntry.id}`);
      }
    }
    
    // search_vectorの更新
    console.log('\n🔄 search_vectorを更新中...');
    
    const updateResult = await prisma.$executeRaw`
      UPDATE "Knowledge"
      SET search_vector = to_tsvector('japanese', 
        COALESCE(question, '') || ' ' || 
        COALESCE(answer, '') || ' ' || 
        COALESCE(main_category, '') || ' ' || 
        COALESCE(sub_category, '') || ' ' ||
        COALESCE(detail_category, '')
      )
      WHERE search_vector IS NULL
    `;
    
    console.log(`✅ ${updateResult}件のsearch_vectorを更新しました`);
    
    // テスト検索
    console.log('\n🔍 テスト検索を実行中...');
    
    for (const data of testData) {
      const query = data.question;
      console.log(`\n📝 テストクエリ: "${query.substring(0, 30)}..."`);
      
      // PGroonga検索
      try {
        const results = await prisma.$queryRaw`
          SELECT id, question, main_category, sub_category, 
                 pgroonga_score(tableoid, ctid) as score
          FROM "Knowledge"
          WHERE question &@~ ${query}
          LIMIT 1
        `;
        
        if (results.length > 0) {
          console.log(`✅ 検索成功: "${results[0].question.substring(0, 30)}..."`);
        } else {
          console.log(`❌ 検索結果なし`);
        }
      } catch (error) {
        console.error(`⚠️ 検索エラー:`, error.message);
      }
    }
    
    console.log('\n✅ テスト用データの追加が完了しました');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトを実行
updateTestData()
  .catch(error => {
    console.error('致命的なエラーが発生しました:', error);
    process.exit(1);
  }); 