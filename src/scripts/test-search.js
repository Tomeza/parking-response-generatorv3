/* eslint-disable @typescript-eslint/no-require-imports */
import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

// Assume preprocessQuery is defined elsewhere or imported
// Example placeholder (replace with actual import if needed)

/**
 * 検索機能をテストする関数
 */
async function testSearch() {
  console.log('===== 検索機能テスト開始 =====');
  
  // テストするクエリのリスト
  const testQueries = [
    '予約はどのように行えますか？',
    '予約を変更したい',
    '予約の変更方法を教えてください',
    '営業時間を教えてください',
    'キャンセルの方法',
    '料金について教えてください',
    '国際線を利用する場合の予約方法',
    '外車を駐車できますか',
    '予約確認はどうすればよいですか',
    '送迎バスの時間'
  ];
  
  // 各クエリについてテスト実行
  for (const query of testQueries) {
    console.log(`\n🔍 検索クエリ: "${query}"`);
    
    try {
      // 検索実行
      const startTime = Date.now();
      
      // PGroongaを使った検索（直接SQL実行）
      const preprocessedQuery = preprocessQuery(query);
      console.log(`前処理済みクエリ: "${preprocessedQuery}"`);
      
      // Removed Type Alias definition

      // Removed generic type from $queryRaw
      const results = await prisma.$queryRaw`
        SELECT 
          k.id, k.question, k.answer, k.main_category, k.sub_category, k.detail_category,
          pgroonga_score(k.tableoid, k.ctid) AS pgroonga_score,
          similarity(COALESCE(k.question, ''), ${query}) as question_sim,
          similarity(COALESCE(k.answer, ''), ${query}) as answer_sim
        FROM "Knowledge" k
        WHERE 
          k.question &@~ ${preprocessedQuery}
          OR k.answer &@~ ${preprocessedQuery}
          OR k.main_category &@~ ${preprocessedQuery}
          OR k.sub_category &@~ ${preprocessedQuery}
        ORDER BY
          pgroonga_score DESC,
          question_sim DESC,
          answer_sim DESC
        LIMIT 10
      `;
      
      const endTime = Date.now();
      
      console.log(`⏱️ 検索時間: ${endTime - startTime}ms`);
      console.log(`🔢 検索結果数: ${results.length}`); // results should be an array here
      
      // Check if results is an array before proceeding
      if (Array.isArray(results) && results.length > 0) {
        // 最初の3件の結果を表示
        console.log('🏆 検索結果上位3件:');
        // Removed type annotations from forEach parameters
        results.slice(0, 3).forEach((result, index) => {
          console.log(`\n- 結果 #${index + 1}:`);
          console.log(`  質問: ${result.question || 'N/A'}`); // Access properties directly
          console.log(`  カテゴリ: ${result.main_category || '未設定'} > ${result.sub_category || '未設定'}`);
          console.log(`  PGroongaスコア: ${result.pgroonga_score?.toFixed(4) || 'N/A'}`);
          console.log(`  質問類似度: ${result.question_sim?.toFixed(4) || 'N/A'}`);
          console.log(`  回答類似度: ${result.answer_sim?.toFixed(4) || 'N/A'}`);
        });
      } else {
        console.log('❌ 検索結果がありませんでした。');
      }
    } catch (error) { // Removed type annotation from catch parameter
      console.error('検索中にエラーが発生しました:', error instanceof Error ? error.message : error);
    }
  }
  
  // カスタムテスト：データベース全体の「予約」を含むエントリ数
  try {
    const reservationCount = await prisma.knowledge.count({
      where: {
        OR: [
          { question: { contains: '予約', mode: 'insensitive' } },
          { answer: { contains: '予約', mode: 'insensitive' } }
        ]
      }
    });
    
    console.log(`\n📊 データベース内の「予約」を含むエントリ数: ${reservationCount}`);
  } catch (error) {
    console.error('❌ データベース集計エラー:', error);
  }
  
  console.log('\n===== 検索機能テスト終了 =====');
}

/**
 * 検索クエリを前処理する関数
 */
function preprocessQuery(query) {
  // 不要な助詞や記号を削除
  const normalized = query.replace(/[はがのにへでとやもをのような、。．！？!?.\s]+/g, ' ').trim();
  
  // 単語に分割して重要なキーワードを抽出
  const words = normalized.split(' ').filter(w => w.length > 1);
  
  // 「予約」「営業時間」などの重要キーワードを抽出
  const keywords = [];
  for (const word of words) {
    if (word.includes('予約')) keywords.push('予約');
    if (word.includes('営業')) keywords.push('営業');
    if (word.includes('時間')) keywords.push('時間');
    if (word.includes('国際')) keywords.push('国際');
    if (word.includes('外車')) keywords.push('外車');
    if (word.includes('キャンセル')) keywords.push('キャンセル');
    if (word.includes('料金')) keywords.push('料金');
    if (word.includes('支払')) keywords.push('支払');
    if (word.includes('変更')) keywords.push('変更');
    if (word.includes('修正')) keywords.push('修正');
    if (word.includes('更新')) keywords.push('更新');
    if (word.includes('送迎')) keywords.push('送迎');
    if (word.includes('車種')) keywords.push('車種');
  }
  
  // 文字列から漢字、ひらがな、カタカナの部分を抽出
  const japanesePattern = /[一-龠]+|[ぁ-ゔ]+|[ァ-ヴー]+/g;
  const japaneseMatches = normalized.match(japanesePattern) || [];
  
  // ユニークなキーワードを返す
  return [...new Set([...keywords, ...words, ...japaneseMatches])].join(' ');
}

// 検索テスト実行
testSearch()
  .catch(error => {
    console.error('スクリプト実行中に致命的なエラーが発生しました:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 