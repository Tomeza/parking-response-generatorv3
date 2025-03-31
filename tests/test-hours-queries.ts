import { searchKnowledge } from '../src/lib/search.js';

async function testHoursQueries() {
  const queries = [
    '営業時間',
    '何時から何時まで',
    '深夜の利用',
    '営業日',
    '開店時間',
    '24時間営業ですか',
    '年中無休ですか',
    '休業日はありますか'
  ];

  console.log("===== 営業時間関連クエリのテスト =====\n");

  for (const query of queries) {
    try {
      console.log(`\n===================================`);
      console.log(`クエリ: "${query}" の検索結果`);
      console.log(`===================================`);
      
      const searchResult = await searchKnowledge(query);
      if (!searchResult) {
        console.log("検索結果がありません。");
        continue;
      }

      const results = searchResult.results;
      console.log(`検索結果数: ${results.length}`);
      
      if (results.length > 0) {
        console.log("検索結果:");
        results.slice(0, 2).forEach(result => {
          console.log(`ID: ${result.id}`);
          console.log(`質問: ${result.question}`);
          console.log(`回答: ${result.answer}`);
          console.log(`スコア: ${result.final_score ?? 'N/A'}`);
          console.log(`-------------------`);
        });
        
        if (results.length > 2) {
          console.log(`... 他 ${results.length - 2} 件の結果があります`);
        }
      } else {
        console.log("検索結果がありません。");
      }
    } catch (error) {
      console.error(`クエリ "${query}" の処理中にエラーが発生しました:`, error);
    }
  }
}

testHoursQueries(); 