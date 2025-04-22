/* eslint-disable @typescript-eslint/no-require-imports */
import { searchKnowledge, getSearchMetrics, clearSearchCache } from '../lib/search';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * 改良された検索機能とキャッシュをテストする関数
 */
async function testCachedSearch() {
  console.log('===== キャッシュ対応改良版検索機能テスト開始 =====');
  
  // キャッシュをクリアして開始
  clearSearchCache();
  
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
  
  // 各クエリを1回目実行（キャッシュなし）
  console.log('\n===== 1回目の検索実行（キャッシュなし） =====');
  const firstRunResults = [];
  
  for (const query of testQueries) {
    console.log(`\n🔍 検索クエリ: "${query}"`);
    
    try {
      // 検索開始時間
      const startTime = Date.now();
      
      // 検索実行
      const searchResults = await searchKnowledge(query);
      
      // 検索終了時間と処理時間
      const endTime = Date.now();
      const searchTime = endTime - startTime;
      
      console.log(`⏱️ 検索時間: ${searchTime}ms`);
      console.log(`🔢 検索結果数: ${searchResults.length}`);
      
      // 結果を保存
      firstRunResults.push({
        query,
        count: searchResults.length,
        time: searchTime,
        topResults: searchResults.slice(0, 3)
      });
      
      // 検索結果の表示
      if (searchResults.length > 0) {
        console.log('🏆 検索結果上位3件:');
        searchResults.slice(0, 3).forEach((result, index) => {
          console.log(`\n- 結果 #${index + 1}:`);
          console.log(`  ID: ${result.id}`);
          console.log(`  質問: ${result.question || 'N/A'}`);
          console.log(`  カテゴリ: ${result.main_category || '未設定'} > ${result.sub_category || '未設定'}`);
          console.log(`  スコア: ${result.score?.toFixed(4) || 'N/A'}`);
        });
      } else {
        console.log('❌ 検索結果が見つかりませんでした。');
      }
    } catch (error) {
      console.error(`❌ エラー発生 (${query}):`, error);
    }
  }
  
  // メトリクスの表示
  const firstRunMetrics = getSearchMetrics();
  console.log('\n📊 1回目の検索メトリクス:');
  console.log(` - 合計検索数: ${firstRunMetrics.totalSearches}`);
  console.log(` - キャッシュヒット数: ${firstRunMetrics.cacheHits}`);
  console.log(` - キャッシュミス数: ${firstRunMetrics.cacheMisses}`);
  console.log(` - 平均検索時間: ${firstRunMetrics.averageSearchTime.toFixed(2)}ms`);
  
  // 各クエリを2回目実行（キャッシュあり）
  console.log('\n===== 2回目の検索実行（キャッシュあり） =====');
  const secondRunResults = [];
  
  for (const query of testQueries) {
    console.log(`\n🔍 検索クエリ (再実行): "${query}"`);
    
    try {
      // 検索開始時間
      const startTime = Date.now();
      
      // 検索実行
      const searchResults = await searchKnowledge(query);
      
      // 検索終了時間と処理時間
      const endTime = Date.now();
      const searchTime = endTime - startTime;
      
      console.log(`⏱️ 検索時間: ${searchTime}ms`);
      console.log(`🔢 検索結果数: ${searchResults.length}`);
      
      // 結果を保存
      secondRunResults.push({
        query,
        count: searchResults.length,
        time: searchTime,
        topResults: searchResults.slice(0, 3)
      });
      
      // 検索結果の表示
      if (searchResults.length > 0) {
        console.log('🏆 検索結果上位3件:');
        searchResults.slice(0, 3).forEach((result, index) => {
          console.log(`\n- 結果 #${index + 1}:`);
          console.log(`  ID: ${result.id}`);
          console.log(`  質問: ${result.question || 'N/A'}`);
          console.log(`  カテゴリ: ${result.main_category || '未設定'} > ${result.sub_category || '未設定'}`);
          console.log(`  スコア: ${result.score?.toFixed(4) || 'N/A'}`);
        });
      } else {
        console.log('❌ 検索結果が見つかりませんでした。');
      }
    } catch (error) {
      console.error(`❌ エラー発生 (${query}):`, error);
    }
  }
  
  // 2回目のメトリクスの表示
  const secondRunMetrics = getSearchMetrics();
  console.log('\n📊 2回目の検索メトリクス:');
  console.log(` - 合計検索数: ${secondRunMetrics.totalSearches}`);
  console.log(` - キャッシュヒット数: ${secondRunMetrics.cacheHits}`);
  console.log(` - キャッシュミス数: ${secondRunMetrics.cacheMisses}`);
  console.log(` - 平均検索時間: ${secondRunMetrics.averageSearchTime.toFixed(2)}ms`);
  
  // キャッシュヒット率の計算
  const cacheHitRate = (secondRunMetrics.cacheHits / secondRunMetrics.totalSearches * 100).toFixed(2);
  console.log(`\n📈 現在のキャッシュヒット率: ${cacheHitRate}%`);
  
  // 1回目と2回目の性能比較
  console.log('\n📊 性能比較 (1回目 vs 2回目):');
  
  // 各クエリの検索時間比較
  for (let i = 0; i < testQueries.length; i++) {
    const firstRun = firstRunResults[i];
    const secondRun = secondRunResults[i];
    
    if (firstRun && secondRun) {
      const speedup = firstRun.time > 0 ? (firstRun.time / Math.max(1, secondRun.time)).toFixed(2) : 'N/A';
      console.log(`"${firstRun.query}": ${firstRun.time}ms → ${secondRun.time}ms (${speedup}倍速)`);
    }
  }
  
  // ランダムなクエリでキャッシュヒットとミスをテスト
  console.log('\n===== ランダムクエリでのキャッシュテスト =====');
  
  // ランダムなクエリ生成
  const randomQueries = [
    // 2回目検索と同じクエリ（キャッシュヒット）
    testQueries[0],
    testQueries[3],
    // 新しいクエリ（キャッシュミス）
    '車種制限はありますか？',
    '駐車料金の支払い方法',
    '営業時間は何時から何時まで？'
  ];
  
  for (const query of randomQueries) {
    console.log(`\n🔍 ランダムクエリ: "${query}"`);
    
    try {
      // 検索開始時間
      const startTime = Date.now();
      
      // 検索実行
      const searchResults = await searchKnowledge(query);
      
      // 検索終了時間と処理時間
      const endTime = Date.now();
      const searchTime = endTime - startTime;
      
      // キャッシュヒットしたかどうかの判定 (10ms以下ならヒットと判断)
      const isHit = searchTime <= 10;
      
      console.log(`⏱️ 検索時間: ${searchTime}ms (${isHit ? '✅ キャッシュヒット' : '❌ キャッシュミス'})`);
      console.log(`🔢 検索結果数: ${searchResults.length}`);
      
      if (searchResults.length > 0) {
        console.log(`- トップ結果: ${searchResults[0].question || 'N/A'} (スコア: ${searchResults[0].score?.toFixed(4) || 'N/A'})`);
      }
    } catch (error) {
      console.error(`❌ エラー発生 (${query}):`, error);
    }
  }
  
  // キャッシュクリアのテスト
  console.log('\n===== キャッシュクリアのテスト =====');
  clearSearchCache();
  console.log('✅ キャッシュがクリアされました');
  
  // クリア後のメトリクスはリセットされていないことを確認
  const afterClearMetrics = getSearchMetrics();
  console.log('\n📊 キャッシュクリア後のメトリクス:');
  console.log(` - 合計検索数: ${afterClearMetrics.totalSearches}`);
  console.log(` - キャッシュヒット数: ${afterClearMetrics.cacheHits}`);
  console.log(` - キャッシュミス数: ${afterClearMetrics.cacheMisses}`);
  
  // キャッシュクリア後の検索を確認
  console.log('\n🔍 キャッシュクリア後の検索:');
  try {
    const startTime = Date.now();
    const searchResults = await searchKnowledge(testQueries[0]);
    const searchTime = Date.now() - startTime;
    
    console.log(`⏱️ 検索時間: ${searchTime}ms (キャッシュミスのはず)`);
    console.log(`🔢 検索結果数: ${searchResults.length}`);
  } catch (error) {
    console.error('❌ エラー発生:', error);
  }
  
  console.log('\n===== キャッシュ対応改良版検索機能テスト終了 =====');
}

// メイン実行
testCachedSearch()
  .catch(error => {
    console.error('スクリプト実行中に致命的なエラーが発生しました:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 