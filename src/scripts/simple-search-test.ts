// 検索機能のテストスクリプト
const { PrismaClient } = require('@prisma/client');
const { searchKnowledge } = require('../lib/search');

// テスト用のクエリリスト
const TEST_QUERIES = [
  '予約方法を教えてください',
  '営業時間はいつですか',
  '料金について知りたい',
  'キャンセルはできますか',
  '支払い方法は何がありますか',
  '外車は停められますか？',
  '国際線利用時の駐車場'
];

async function runSimpleTest() {
  console.log('===== 検索機能シンプルテスト開始 =====');
  const prisma = new PrismaClient();

  try {
    // データベースに接続できるかテスト
    const knowledgeCount = await prisma.knowledge.count();
    console.log(`データベース内のナレッジ数: ${knowledgeCount}`);
    
    // テスト用にいくつかのナレッジエントリを取得
    const sampleEntries = await prisma.knowledge.findMany({
      take: 3,
      select: {
        id: true,
        question: true,
        answer: true,
        main_category: true,
        sub_category: true
      }
    });
    
    console.log('\nサンプルナレッジエントリ:');
    sampleEntries.forEach((entry, index) => {
      console.log(`\n[${index + 1}] ID: ${entry.id}`);
      console.log(`質問: ${entry.question}`);
      console.log(`カテゴリ: ${entry.main_category} > ${entry.sub_category || 'なし'}`);
      console.log(`回答: ${entry.answer?.substring(0, 100)}...`);
    });
    
    // 基本的な検索テスト
    console.log('\n基本検索テスト:');
    console.log('検索クエリ: "予約"');
    
    const reservationResults = await prisma.knowledge.findMany({
      where: {
        OR: [
          { question: { contains: '予約', mode: 'insensitive' } },
          { answer: { contains: '予約', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        question: true,
      },
      take: 5
    });
    
    console.log(`検索結果数: ${reservationResults.length}`);
    reservationResults.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.question}`);
    });
    
    // 営業時間に関するテスト
    console.log('\n営業時間に関する検索テスト:');
    const businessHoursQueries = [
      '営業時間',
      '何時から何時まで',
      '24時間営業ですか',
      '年中無休ですか',
      '休業日はありますか'
    ];
    
    for (const query of businessHoursQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      try {
        // 修正したsearchKnowledge関数を使用
        const results = await searchKnowledge(query);
        
        console.log(`検索結果数: ${results.length || 0}`);
        if (results.length > 0) {
          // 上位3件の結果を表示
          results.slice(0, 3).forEach((result, index) => {
            console.log(`\n[${index + 1}] ID: ${result.id}`);
            console.log(`質問: ${result.question || 'なし'}`);
            console.log(`カテゴリ: ${result.main_category || 'なし'} > ${result.sub_category || 'なし'}`);
            console.log(`スコア: ${result.score || 0}`);
            console.log(`回答: ${result.answer?.substring(0, 100)}...`);
          });
        } else {
          console.log('検索結果が見つかりませんでした。');
        }
      } catch (error) {
        console.error(`"${query}" の検索中にエラーが発生しました:`, error);
      }
    }

    // 非営業時間関連の一般的なクエリのテスト
    console.log('\n非営業時間関連クエリの検索テスト:');
    const generalQueries = [
      '駐車場に到着してからの流れは？',
      '料金はいくらですか',
      '定員を超える人数で利用したい場合はどうすればよいですか？',
      'キャンセル方法を教えてください',
      '支払い方法は何がありますか'
    ];
    
    for (const query of generalQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      try {
        const results = await searchKnowledge(query);
        
        console.log(`検索結果数: ${results.length || 0}`);
        if (results.length > 0) {
          // 最上位の結果のみ表示
          const topResult = results[0];
          console.log(`\n[1] ID: ${topResult.id}`);
          console.log(`質問: ${topResult.question || 'なし'}`);
          console.log(`カテゴリ: ${topResult.main_category || 'なし'} > ${topResult.sub_category || 'なし'}`);
          console.log(`スコア: ${topResult.score || 0}`);
          console.log(`回答: ${topResult.answer?.substring(0, 100)}...`);
          
          // 営業時間の回答ではないことを確認
          const isAboutBusinessHours = 
            (topResult.main_category?.includes('営業時間') || topResult.sub_category?.includes('営業時間')) ||
            (topResult.id === 113); // ID 113は営業時間の回答
          
          if (isAboutBusinessHours) {
            console.log('⚠️ 警告: 非営業時間の質問に対して営業時間の回答が返されています');
          } else {
            console.log('✅ 適切な回答が返されています（営業時間に関する回答ではありません）');
          }
        } else {
          console.log('検索結果が見つかりませんでした。');
        }
      } catch (error) {
        console.error(`"${query}" の検索中にエラーが発生しました:`, error);
      }
    }

    // 追加: 予約変更関連のクエリテスト
    console.log('\n予約変更関連クエリの検索テスト:');
    const reservationChangeQueries = [
      '予約の変更方法を教えてください',
      '予約日程を変更したいのですが、どうすればよいですか？',
      '日時変更はできますか？',
      'フライト時間が変わった場合の手続きは？',
      '利用開始後に予約を変更する場合の手続きは？'
    ];
    
    for (const query of reservationChangeQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      try {
        const results = await searchKnowledge(query);
        
        console.log(`検索結果数: ${results.length || 0}`);
        if (results.length > 0) {
          // 最上位の結果のみ表示
          const topResult = results[0];
          console.log(`\n[1] ID: ${topResult.id}`);
          console.log(`質問: ${topResult.question || 'なし'}`);
          console.log(`カテゴリ: ${topResult.main_category || 'なし'} > ${topResult.sub_category || 'なし'}`);
          console.log(`スコア: ${topResult.score || 0}`);
          console.log(`回答: ${topResult.answer?.substring(0, 100)}...`);
          
          // 予約変更関連の回答かどうかを確認
          const isReservationChange = 
            (topResult.main_category === '予約関連' && topResult.sub_category?.includes('変更')) ||
            (topResult.question && 
              (topResult.question.includes('予約変更') || 
               topResult.question.includes('日程変更') ||
               (topResult.question.includes('予約') && topResult.question.includes('変更')))) ||
            (topResult.id && [28, 29, 30, 31, 32].includes(topResult.id));
          
          if (isReservationChange) {
            console.log('✅ 適切な回答が返されています（予約変更に関連する回答です）');
          } else {
            console.log('⚠️ 警告: 予約変更の質問に対して関連性の低い回答が返されています');
          }
        } else {
          console.log('検索結果が見つかりませんでした。');
        }
      } catch (error) {
        console.error(`"${query}" の検索中にエラーが発生しました:`, error);
      }
    }

    // 追加: 荷物関連のクエリテスト
    console.log('\n荷物関連クエリの検索テスト:');
    const luggageQueries = [
      '荷物の送迎サービスはありますか？',
      '大きな荷物を運ぶ場合のルールは？',
      'スーツケースは何個まで持ち込めますか？',
      '荷物のサイズ制限はありますか？',
      'トランクに入らない大型の荷物は持ち込めますか？'
    ];
    
    for (const query of luggageQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      try {
        const results = await searchKnowledge(query);
        
        console.log(`検索結果数: ${results.length || 0}`);
        if (results.length > 0) {
          // 最上位の結果のみ表示
          const topResult = results[0];
          console.log(`\n[1] ID: ${topResult.id}`);
          console.log(`質問: ${topResult.question || 'なし'}`);
          console.log(`カテゴリ: ${topResult.main_category || 'なし'} > ${topResult.sub_category || 'なし'}`);
          console.log(`スコア: ${topResult.score || 0}`);
          console.log(`回答: ${topResult.answer?.substring(0, 100)}...`);
          
          // 荷物関連の回答かどうかを確認
          const isLuggageRelated = 
            (topResult.main_category === '送迎関連' && 
             (topResult.sub_category?.includes('荷物') || topResult.sub_category?.includes('制限'))) ||
            (topResult.question && 
              (topResult.question.includes('荷物') || 
               topResult.question.includes('スーツケース') ||
               topResult.question.includes('キャリーケース') ||
               (topResult.question.includes('大きな') && topResult.question.includes('荷物')))) ||
            (topResult.id === 48); // ID 48も荷物関連とみなす
          
          if (isLuggageRelated) {
            console.log('✅ 適切な回答が返されています（荷物関連の回答です）');
            // 特にスーツケースの個数クエリの結果をチェック
            if (query === 'スーツケースは何個まで持ち込めますか？') {
              if (topResult.id !== 48) {
                console.log(`   ⚠️ 期待されるID 48ではなく、ID ${topResult.id}が返されました`);
              } else {
                console.log(`   ✅ ID 48が正しく返されました`);
              }
              if (!topResult.answer?.includes('ゴルフバッグは1台につき2つまで')) {
                 console.log(`   ⚠️ 回答にスーツケースの個数制限に関する直接的な言及がありません`);
              }
            }
          } else {
            console.log('⚠️ 警告: 荷物関連の質問に対して関連性の低い回答が返されています');
          }
        } else {
          console.log('検索結果が見つかりませんでした。');
        }
      } catch (error) {
        console.error(`"${query}" の検索中にエラーが発生しました:`, error);
      }
    }

    // 追加: ひとり送迎プランとパターンマッチのテスト
    console.log('\nひとり送迎プラン・パターンマッチテスト:');
    const soloShuttleQueries = [
      'ひとり送迎プランについて詳しく教えてください',
      '6名で利用したい',
      '2台で7名の場合の送迎は？',
      '車椅子で一人で利用できますか？'
    ];

    for (const query of soloShuttleQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      try {
        const results = await searchKnowledge(query);
        
        console.log(`検索結果数: ${results.length || 0}`);
        if (results.length > 0) {
          // 最上位の結果のみ表示
          const topResult = results[0];
          console.log(`\n[1] ID: ${topResult.id}`);
          console.log(`質問: ${topResult.question || 'なし'}`);
          console.log(`カテゴリ: ${topResult.main_category || 'なし'} > ${topResult.sub_category || 'なし'}`);
          console.log(`スコア: ${topResult.score || 0}`);
          console.log(`回答: ${topResult.answer?.substring(0, 100)}...`);
          
          // クエリに応じた期待されるIDやカテゴリをチェック
          let expectationMet = false;
          if (query.includes('ひとり送迎プラン') || query.includes('6名')) {
            if ([170, 172, 173, 169].includes(topResult.id) || topResult.sub_category === 'ひとり送迎') {
              expectationMet = true;
              console.log('✅ 適切な回答が返されています（ひとり送迎プラン関連）');
            } else {
              console.log(`⚠️ 警告: ひとり送迎プランの質問に対して関連性の低い回答 (ID: ${topResult.id})`);
            }
          } else if (query.includes('2台') && query.includes('7名')) { // パターン想定
            if (topResult.id === 173) {
              expectationMet = true;
              console.log('✅ 適切な回答が返されています（複数台・大人数パターン）');
            } else {
              console.log(`⚠️ 警告: 複数台・大人数パターンの質問に対して関連性の低い回答 (ID: ${topResult.id})`);
            }
          } else if (query.includes('車椅子') && query.includes('一人')) { // パターン想定
            if (topResult.id === 174) {
              expectationMet = true;
              console.log('✅ 適切な回答が返されています（車椅子単独パターン）');
            } else {
              console.log(`⚠️ 警告: 車椅子単独パターンの質問に対して関連性の低い回答 (ID: ${topResult.id})`);
            }
          }
          
          if (!expectationMet) {
            // 期待通りの結果でなかった場合の追加ログ (必要であれば)
          }
        } else {
          console.log('検索結果が見つかりませんでした。');
        }
      } catch (error) {
        console.error(`"${query}" の検索中にエラーが発生しました:`, error);
      }
    }

    // API状態のシミュレーション検索テスト
    console.log('\nAPI呼び出しシミュレーションテスト:');
    try {
      const apiTestQuery = "営業時間は何時から何時までですか？";
      console.log(`検索クエリ: "${apiTestQuery}"`);
      
      // 1. 検索処理の実行
      const results = await searchKnowledge(apiTestQuery);
      
      if (results.length > 0) {
        // 2. 検索結果を取得
        const bestMatch = results[0];
        const allResults = results;
        
        // 3. 応答生成ステップの再現
        console.log('最適一致結果:');
        console.log(`ID: ${bestMatch.id}`);
        console.log(`質問: ${bestMatch.question || 'なし'}`);
        console.log(`スコア: ${bestMatch.score || 0}`);
        console.log(`カテゴリ: ${bestMatch.main_category || 'なし'} > ${bestMatch.sub_category || 'なし'}`);
        console.log(`回答: ${bestMatch.answer?.substring(0, 100)}...`);
        
        // 4. 検索結果の処理シミュレーション
        const finalResponse = addDummyTemplate(bestMatch.answer);
        console.log('\n最終レスポンス:');
        console.log(finalResponse);
        
        // 5. 応答件数
        console.log(`\n総検索結果数: ${results.length}`);
      } else {
        console.log('API検索結果が見つかりませんでした。');
      }
    } catch (error) {
      console.error('API検索シミュレーション中にエラーが発生しました:', error);
    }
    
    console.log('\n--- 満車関連テスト ---');
    const fullParkingQueries = [
        '満車の場合の対応策は？',
        '駐車場が満車だったらどうすればいいですか？',
        '空きが出た場合の通知を受け取ることはできますか？'
    ];
    for (const query of fullParkingQueries) {
        console.log(`\n[検索クエリ]: ${query}`);
    }

    // 追加: その他のクエリテスト
    console.log('\n--- 追加クエリテスト ---');
    const additionalQueries = [
        "送迎サービスのプランはどのようなものがありますか？",
        "送迎が必要ない場合の利用プランは？",
        "駐車料金はどのように計算されますか？",
        "繁忙期の利用制限について教えてください。",
        "繁忙期の予約のコツはありますか？",
        "最寄り駅からの移動手段を教えてください。"
    ];

    for (const query of additionalQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      try {
        const results = await searchKnowledge(query);

        console.log(`検索結果数: ${results.length || 0}`);
        if (results.length > 0) {
          // 最上位の結果のみ表示
          const topResult = results[0];
          console.log(`\n[1] ID: ${topResult.id}`);
          console.log(`質問: ${topResult.question || 'なし'}`);
          console.log(`カテゴリ: ${topResult.main_category || 'なし'} > ${topResult.sub_category || 'なし'}`);
          console.log(`スコア: ${topResult.score || 0}`);
          console.log(`回答: ${topResult.answer?.substring(0, 100)}...`);

          // 必要に応じて、ここに追加の検証ロジックを記述

        } else {
          console.log('検索結果が見つかりませんでした。');
        }
      } catch (error) {
        console.error(`"${query}" の検索中にエラーが発生しました:`, error);
      }
    }

  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n===== 検索機能シンプルテスト終了 =====');
  }
}

// APIのテンプレート処理をシミュレートする関数
function addDummyTemplate(text: string | null): string {
  if (!text) return "情報が見つかりませんでした。";
  
  return `お問い合わせありがとうございます。\n\n${text}\n\n何かご不明な点がございましたら、お気軽にお問い合わせください。`;
}

// メイン実行
runSimpleTest().catch(error => {
  console.error('致命的なエラー:', error);
  process.exit(1);
}); 