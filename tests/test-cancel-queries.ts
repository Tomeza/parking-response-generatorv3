// CommonJS形式でモジュールを読み込み
const { searchKnowledge } = require('../src/lib/search');

// 型定義
interface SearchResult {
  id: number;
  question?: string;
  answer: string;
  score?: number;
  main_category?: string;
  sub_category?: string;
  note?: string;
}

async function testCancelQueries() {
  const queries = [
    "キャンセル料はいくらですか？",
    "キャンセル料の支払い方法を教えてください",
    "部分的なキャンセルはできますか？",
    "天候不良でキャンセルする場合はどうなりますか？",
    "病気でキャンセルする場合は？",
    "予約のキャンセル方法を教えてください",
    "キャンセル料はかかりますか？",
    "キャンセルした場合の返金について教えてください",
    "キャンセルの期限はありますか？"
  ];

  console.log("===== キャンセル関連クエリのテスト =====\n");

  for (const query of queries) {
    try {
      console.log(`\n===================================`);
      console.log(`クエリ: "${query}" の検索結果`);
      console.log(`===================================`);
      
      const results = await searchKnowledge(query);
      
      console.log(`検索結果数: ${results.length}`);
      
      if (results.length > 0) {
        console.log("検索結果:");
        results.slice(0, 2).forEach((result: SearchResult) => {
          console.log(`ID: ${result.id}`);
          console.log(`質問: ${result.question}`);
          console.log(`回答: ${result.answer}`);
          console.log(`スコア: ${result.score || 0}`);
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

// 実行
testCancelQueries(); 