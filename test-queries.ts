import { searchKnowledge } from './src/lib/search.js';
import { Knowledge } from '@prisma/client';

// 型定義の追加
interface SearchResult extends Knowledge {
  rank?: number;
  ts_score?: number;
  sim_score?: number;
  tag_score?: number;
  category_score?: number;
  final_score?: number;
  relevance?: number;
}

interface SearchResponse {
  results: SearchResult[];
  allResults: SearchResult[];
  keyTerms: string[];
  synonymExpanded: string[];
  dates?: Date[];
  busyPeriods?: any[];
  hasBusyPeriod: boolean;
}

interface TestQuery {
  query: string;
  expectedCategories: string[];
  description: string;
}

// テストクエリセット
// 各クエリに対して、期待される結果（どのカテゴリの情報がヒットするべきか）を定義
const testQueries = [
  // 予約関連のクエリ
  {
    query: '駐車場の予約方法について教えてください',
    expectedCategories: ['予約', '駐車場'],
    description: '予約方法に関する基本的なクエリ'
  },
  {
    query: '予約はどうやってするの？',
    expectedCategories: ['予約'],
    description: 'シンプルな予約方法のクエリ'
  },
  {
    query: '予約の変更はできますか',
    expectedCategories: ['予約'],
    description: '予約変更に関するクエリ'
  },
  {
    query: '申し込み方法を教えてください',
    expectedCategories: ['予約'],
    description: '「申し込み」という同義語を使ったクエリ'
  },
  
  // 料金関連のクエリ
  {
    query: '料金について知りたい',
    expectedCategories: ['料金'],
    description: '料金に関する基本的なクエリ'
  },
  {
    query: '料金はいくらですか',
    expectedCategories: ['料金'],
    description: '料金額に関するクエリ'
  },
  {
    query: '駐車場の値段はいくら？',
    expectedCategories: ['料金', '駐車場'],
    description: '「値段」という同義語を使ったクエリ'
  },
  {
    query: '費用はどれくらいかかりますか',
    expectedCategories: ['料金'],
    description: '「費用」という同義語を使ったクエリ'
  },
  
  // 支払い関連のクエリ
  {
    query: '支払い方法は何がありますか',
    expectedCategories: ['支払い'],
    description: '支払い方法に関する基本的なクエリ'
  },
  {
    query: '支払いはどうすればいいですか',
    expectedCategories: ['支払い'],
    description: '支払い手順に関するクエリ'
  },
  {
    query: 'クレジットカードは使えますか',
    expectedCategories: ['支払い'],
    description: '支払い手段に関する具体的なクエリ'
  },
  {
    query: '精算方法について教えてください',
    expectedCategories: ['支払い'],
    description: '「精算」という同義語を使ったクエリ'
  },
  
  // キャンセル関連のクエリ
  {
    query: 'キャンセル方法を教えてください',
    expectedCategories: ['キャンセル', '予約'],
    description: 'キャンセル方法に関する基本的なクエリ'
  },
  {
    query: 'キャンセルしたい場合はどうすればいいですか',
    expectedCategories: ['キャンセル', '予約'],
    description: 'キャンセル手順に関するクエリ'
  },
  {
    query: '予約を取り消したいです',
    expectedCategories: ['キャンセル', '予約'],
    description: '「取り消し」という同義語を使ったクエリ'
  },
  
  // 営業時間関連のクエリ
  {
    query: '営業時間はいつですか',
    expectedCategories: [],
    description: '営業時間に関する基本的なクエリ（現在タグなし）'
  },
  {
    query: '営業時間を教えてください',
    expectedCategories: [],
    description: '営業時間に関する別の表現のクエリ（現在タグなし）'
  },
  
  // 領収書関連のクエリ
  {
    query: '領収書はもらえますか',
    expectedCategories: ['料金'],
    description: '領収書に関する基本的なクエリ（現在専用タグなし）'
  },
  {
    query: '領収書発行について教えてください',
    expectedCategories: ['料金'],
    description: '領収書発行に関するクエリ（現在専用タグなし）'
  },
  
  // 複合クエリ
  {
    query: '駐車場の料金とキャンセル方法について教えてください',
    expectedCategories: ['料金', '駐車場', 'キャンセル'],
    description: '複数カテゴリに関する複合クエリ'
  },
  {
    query: '予約の変更と支払い方法について',
    expectedCategories: ['予約', '支払い'],
    description: '予約変更と支払いに関する複合クエリ'
  }
];

// テスト実行関数
async function runQueryTests() {
  console.log('検索機能テスト開始...\n');
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const test of testQueries) {
    console.log(`\n===================================`);
    console.log(`テストクエリ: "${test.query}"`);
    console.log(`説明: ${test.description}`);
    console.log(`期待されるカテゴリ: ${test.expectedCategories.join(', ') || 'なし'}`);
    console.log(`===================================`);
    
    try {
      const result: SearchResponse | null = await searchKnowledge(test.query);
      
      console.log(`検索結果数: ${result?.results?.length || 0}`);
      
      if (result?.results && result.results.length > 0) {
        console.log(`最初の結果:`);
        console.log(`- カテゴリ: ${result.results[0].main_category || 'なし'}`);
        console.log(`- サブカテゴリ: ${result.results[0].sub_category || 'なし'}`);
        console.log(`- 質問: ${result.results[0].question || 'なし'}`);
      } else {
        console.log('検索結果なし');
      }
      
      console.log(`抽出キーワード: ${result?.keyTerms?.join(', ') || 'なし'}`);
      console.log(`同義語展開: ${result?.synonymExpanded?.join(', ') || 'なし'}`);
      
      // 期待されるカテゴリが結果に含まれているかチェック
      let testPassed = true;
      const foundCategories: string[] = [];
      
      if (result?.results && result.results.length > 0) {
        result.results.forEach(item => {
          const categories: string[] = [];
          if (item.main_category) categories.push(item.main_category);
          if (item.sub_category) categories.push(item.sub_category);
          
          test.expectedCategories.forEach(expected => {
            if (categories.some(cat => cat.includes(expected))) {
              if (!foundCategories.includes(expected)) {
                foundCategories.push(expected);
              }
            }
          });
        });
      }
      
      // 期待されるカテゴリがすべて見つかったかチェック
      const missingCategories = test.expectedCategories.filter(cat => !foundCategories.includes(cat));
      
      if (missingCategories.length > 0) {
        testPassed = false;
        console.log(`\n❌ テスト失敗: 以下のカテゴリが結果に含まれていません: ${missingCategories.join(', ')}`);
      } else if (test.expectedCategories.length > 0 && (!result?.results || result.results.length === 0)) {
        testPassed = false;
        console.log(`\n❌ テスト失敗: 検索結果がありません`);
      } else if (test.expectedCategories.length === 0 && result?.results && result.results.length > 0) {
        // 期待されるカテゴリがない場合は結果も0件であるべき
        testPassed = false;
        console.log(`\n❌ テスト失敗: 期待されるカテゴリがないのに検索結果があります`);
      } else {
        console.log(`\n✅ テスト成功: 期待されるカテゴリが結果に含まれています`);
      }
      
      if (testPassed) {
        passedTests++;
      } else {
        failedTests++;
      }
      
    } catch (error) {
      console.error(`エラー: ${error}`);
      failedTests++;
    }
  }
  
  console.log(`\n===================================`);
  console.log(`テスト結果サマリー:`);
  console.log(`- 合計テスト数: ${testQueries.length}`);
  console.log(`- 成功: ${passedTests}`);
  console.log(`- 失敗: ${failedTests}`);
  console.log(`- 成功率: ${Math.round((passedTests / testQueries.length) * 100)}%`);
  console.log(`===================================`);
}

// テスト実行
runQueryTests(); 