/* eslint-disable @typescript-eslint/no-require-imports */
// import { searchKnowledge, getSearchMetrics, clearSearchCache } from '../lib/search'; // metricsとcache関数は一旦コメントアウト
import { searchKnowledge } from '../lib/search'; // searchKnowledge のみインポート
import { PrismaClient, Knowledge } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// テスト結果の型定義
interface TestResultEntry {
  category: string;
  query: string;
  tags: string | null;
  time: number;
  resultCount: number;
  topResults: Array<{
    id: number;
    question: string | null;
    score: number | undefined;
    main_category: string | null;
    sub_category: string | null;
    answer?: string | null; // answerも追加
    // 必要に応じて Knowledge の他のフィールドも追加
  }>;
  error?: string; // エラー発生時のみ
}

// searchKnowledge の戻り値の型を仮定 (必要に応じて調整)
interface SearchResult {
  id: number;
  question: string | null;
  answer?: string | null; // 回答表示のために追加
  score?: number;
  main_category: string | null;
  sub_category: string | null;
  // Knowledge モデルの他のフィールドも含む可能性
}

// カテゴリサマリの型定義
interface CategorySummaryData {
    totalQueries: number;
    successRate: string;
    averageResults: string;
    averageTime: string;
}

// 検索メトリクスの型定義 (仮)
interface SearchMetrics {
    totalSearches: number | string; // 'N/A' も許容するため string も追加
    cacheHits: number | string;
    cacheMisses: number | string;
    averageSearchTime: number | string; // toFixed(2) の結果は string
}

/**
 * 検索機能の一括テストを実行する関数
 */
async function batchTestSearch() {
  console.log('===== 検索機能バッチテスト開始 =====');

  // キャッシュをクリアして開始 (一旦コメントアウト)
  /*
  try {
     clearSearchCache(); // lib/search に存在するか確認が必要
  } catch (e) {
    console.warn("clearSearchCache の呼び出しに失敗しました。続行します。", e);
  }
  */

  // テストケースを定義
  const testCases = [
    // 一般的な問い合わせ
    { category: '一般的な問い合わせ', queries: [
      '予約方法を教えてください',
      '営業時間はいつですか',
      '料金について知りたい',
      'キャンセルはできますか',
      '支払い方法は何がありますか'
    ]},
    
    // 特殊なパターン
    { category: '特殊パターン', queries: [
      '外車は停められますか？',
      '国際線利用時の駐車場',
      'レクサスは駐車できる？',
      'BMWは停められますか',
      '深夜の営業について'
    ]},
    
    // 長い文章形式のクエリ
    { category: '長文クエリ', queries: [
      '来週の金曜日から日曜日まで2泊3日で旅行に行くのですが、その間駐車場を利用することはできますか？予約は必要ですか？',
      '先日予約した駐車場の日程を変更したいのですが、どのような手続きが必要でしょうか。予約番号はABC123です。',
      '国内線の到着が深夜になる予定ですが、駐車場は24時間営業していますか？また、事前予約は必要ですか？',
      '家族で旅行予定で、レンタカーを借りる予定です。駐車場の高さ制限はありますか？また、ワンボックスカーでも問題なく停められますか？',
      '支払いはクレジットカードでできますか？また、後払いの場合は領収書は発行してもらえますか？'
    ]},
    
    // 曖昧なクエリ
    { category: '曖昧なクエリ', queries: [
      '停められますか',
      '時間は？',
      'いつ',
      '料金',
      '予約'
    ]},
    
    // タグ付きクエリ（カテゴリを指定）
    { category: 'タグ付きクエリ', queries: [
      { query: '予約方法', tags: '予約' },
      { query: '料金について', tags: '料金' },
      { query: '営業時間', tags: '営業' },
      { query: 'キャンセル方法', tags: 'キャンセル' },
      { query: '支払い', tags: '料金,支払い' }
    ]},
    
    // 課題クエリ (改善要) - Search_Improvements_2025-0422.md より
    { category: '課題クエリ (改善要)', queries: [
      '送迎が必要ない場合の利用プランは？', // 関連性の低い結果(ID 110: 車両保険)が返る課題
      '繁忙期の利用制限',                  // より直接的な回答が望ましい (現状 ID 89, 19 がヒット)
      '繁忙期の予約のコツ',                // より直接的な回答が望ましい (現状 ID 89, 19 がヒット)
      '最寄り駅からの移動手段'               // 首都高アクセス(ID 104) が上位に来る課題
    ]}
  ];

  // 結果の保存用配列 (型を明示的に指定)
  const allResults: TestResultEntry[] = [];
  let metrics: SearchMetrics | undefined = undefined; // metricsを外で宣言
  
  // 各カテゴリとクエリをテスト
  for (const testCase of testCases) {
    console.log(`\n===== カテゴリ: ${testCase.category} =====`);
    
    for (const queryItem of testCase.queries) {
      // クエリとタグを取得
      const query = typeof queryItem === 'string' ? queryItem : queryItem.query;
      const tags = typeof queryItem === 'string' ? '' : queryItem.tags;
      
      console.log(`\n🔍 検索クエリ: "${query}"${tags ? ` (タグ: ${tags})` : ''}`);
      
      try {
        // 検索開始時間
        const startTime = Date.now();
        
        // 検索実行 (戻り値の型を仮定)
        const searchResults: SearchResult[] = await searchKnowledge(query, tags);
        
        // 検索終了時間と処理時間
        const endTime = Date.now();
        const searchTime = endTime - startTime;
        
        console.log(`⏱️ 検索時間: ${searchTime}ms`);
        console.log(`🔢 検索結果数: ${searchResults.length}`);
        
        // 結果の保存
        const resultEntry: TestResultEntry = {
          category: testCase.category,
          query,
          tags: tags || null,
          time: searchTime,
          resultCount: searchResults.length,
          topResults: searchResults.slice(0, 5).map(r => ({
            id: r.id,
            question: r.question,
            score: r.score,
            main_category: r.main_category,
            sub_category: r.sub_category,
            answer: r.answer
          }))
        };
        
        allResults.push(resultEntry);
        
        // 検索結果の表示 (課題クエリは上位5件表示)
        const displayCount = testCase.category === '課題クエリ (改善要)' ? 5 : 3;
        if (searchResults.length > 0) {
          console.log(`🏆 検索結果上位${displayCount}件:`);
          searchResults.slice(0, displayCount).forEach((result, index) => {
            console.log(`\n- 結果 #${index + 1}:`);
            console.log(`  ID: ${result.id}`); // IDも表示
            console.log(`  質問: ${result.question || 'N/A'}`);
            console.log(`  カテゴリ: ${result.main_category || '未設定'} > ${result.sub_category || '未設定'}`);
            console.log(`  スコア: ${result.score?.toFixed(4) || 'N/A'}`);
            
            // カテゴリが特殊パターン or 課題クエリ の場合は回答も表示
            if (testCase.category === '特殊パターン' || testCase.category === '課題クエリ (改善要)') {
              console.log(`  回答: ${result.answer ? result.answer.substring(0, 100) + '...' : 'N/A'}`);
            }
          });
        } else {
          console.log('❌ 検索結果が見つかりませんでした。');
        }
      } catch (error) {
        console.error(`❌ エラー発生 (${query}):`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // エラーも結果に記録
        allResults.push({
          category: testCase.category,
          query,
          tags: tags || null,
          error: errorMessage, // エラーメッセージを格納
          time: 0,
          resultCount: 0,
          topResults: []
        });
      }
    }
  }
  
  // 検索メトリクスの表示 (一旦コメントアウト)
  /*
  try {
    metrics = getSearchMetrics(); // lib/search に存在するか確認が必要
    console.log('\n📊 検索メトリクス:');
    console.log(` - 合計検索数: ${metrics.totalSearches}`);
    console.log(` - キャッシュヒット数: ${metrics.cacheHits}`);
    console.log(` - キャッシュミス数: ${metrics.cacheMisses}`);
    console.log(` - 平均検索時間: ${metrics.averageSearchTime.toFixed(2)}ms`); // toFixed は string を返すので Metrics 型注意
  } catch(e) {
    console.warn("getSearchMetrics の呼び出しに失敗しました。", e);
  }
  */
  
  // 結果のサマリを計算
  const summary = {
    totalQueries: allResults.length,
    queriesWithResults: allResults.filter(r => r.resultCount > 0).length,
    averageResultCount: allResults.length > 0 ? allResults.reduce((sum, r) => sum + r.resultCount, 0) / allResults.length : 0,
    averageSearchTime: allResults.length > 0 ? allResults.reduce((sum, r) => sum + r.time, 0) / allResults.length : 0,
    categorySummary: {} as Record<string, CategorySummaryData> // 型を明示
  };
  
  // カテゴリごとの成功率を計算
  const categories = [...new Set(allResults.map(r => r.category))];
  for (const category of categories) {
    const categoryResults = allResults.filter(r => r.category === category);
    const successCount = categoryResults.filter(r => r.resultCount > 0).length;
    const categoryTotalQueries = categoryResults.length;
    
    summary.categorySummary[category] = {
      totalQueries: categoryTotalQueries,
      successRate: categoryTotalQueries > 0 ? (successCount / categoryTotalQueries * 100).toFixed(2) + '%' : 'N/A',
      averageResults: categoryTotalQueries > 0 ? (categoryResults.reduce((sum, r) => sum + r.resultCount, 0) / categoryTotalQueries).toFixed(2) : 'N/A',
      averageTime: categoryTotalQueries > 0 ? (categoryResults.reduce((sum, r) => sum + r.time, 0) / categoryTotalQueries).toFixed(2) + 'ms' : 'N/A'
    };
  }
  
  // サマリを表示
  console.log('\n📊 テスト結果サマリ:');
  console.log(` - 合計クエリ数: ${summary.totalQueries}`);
  const successPercentage = summary.totalQueries > 0 ? (summary.queriesWithResults / summary.totalQueries * 100).toFixed(2) : '0.00';
  console.log(` - 結果あり: ${summary.queriesWithResults} (${successPercentage}%)`);
  console.log(` - 平均結果数: ${summary.averageResultCount.toFixed(2)}`);
  console.log(` - 平均検索時間: ${summary.averageSearchTime.toFixed(2)}ms`);
  
  console.log('\n📊 カテゴリ別サマリ:');
  for (const [category, data] of Object.entries<CategorySummaryData>(summary.categorySummary)) {
    console.log(` - ${category}:`);
    console.log(`   - クエリ数: ${data.totalQueries}`);
    console.log(`   - 成功率: ${data.successRate}`);
    console.log(`   - 平均結果数: ${data.averageResults}`);
    console.log(`   - 平均検索時間: ${data.averageTime}`);
  }
  
  // 結果をJSONファイルに保存
  const resultDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const resultFile = path.join(resultDir, `search-test-results-${timestamp}.json`);
  
  // metrics が未定義の場合の考慮
  const metricsData: SearchMetrics = metrics || { // metrics が undefined ならデフォルト値
      totalSearches: 'N/A', cacheHits: 'N/A', cacheMisses: 'N/A', averageSearchTime: 'N/A'
  };

  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp,
    metrics: metricsData, // 未定義の場合に対応
    summary,
    results: allResults
  }, null, 2));
  
  console.log(`\n✅ テスト結果を保存しました: ${resultFile}`);
  console.log('\n===== 検索機能バッチテスト終了 =====');
}

// メイン実行
batchTestSearch()
  .catch(error => {
    console.error('スクリプト実行中に致命的なエラーが発生しました:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 