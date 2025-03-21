const { searchKnowledge } = require('../lib/search');
const { Knowledge } = require('@prisma/client');

async function runSearchTests() {
  try {
    // テスト用の検索クエリ
    const queries = [
      '予約方法',
      '駐車場',
      '予約 方法',
      'オンライン',
      '料金'
    ];

    for (const query of queries) {
      console.log(`\n===== 検索クエリ: "${query}" =====`);
      const results = await searchKnowledge(query);
      
      if (results && results.length > 0) {
        console.log(`${results.length}件の結果が見つかりました:`);
        results.forEach((result: any, index: number) => {
          console.log(`\n結果 ${index + 1}:`);
          console.log(`ID: ${result.id}`);
          console.log(`カテゴリ: ${result.main_category} > ${result.sub_category} > ${result.detail_category}`);
          console.log(`質問: ${result.question}`);
          console.log(`回答: ${result.answer.substring(0, 100)}...`);
          console.log(`関連性スコア: ${result.relevance}`);
        });
      } else {
        console.log('結果が見つかりませんでした。');
      }
    }
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

runSearchTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }); 