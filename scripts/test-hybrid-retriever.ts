/**
 * HybridRetriever のテストスクリプト
 * Step 1 のチェックポイントを確認
 */

import { HybridRetriever } from '../src/lib/hybrid-retriever';

// テストクエリ
const testQueries = [
  '駐車場の料金はいくらですか',
  '予約をキャンセルしたい',
  '営業時間を教えて',
  '大型車は駐車できますか',
  '深夜料金について',
  '予約変更の方法',
  '外車の駐車',
  '支払い方法',
  '駐車場の場所',
  '利用時間の制限'
];

async function testHybridRetriever() {
  console.log('🔍 HybridRetriever テスト開始\n');

  const retriever = new HybridRetriever({
    topK: 5,
    isDev: true
  });

  let totalQueries = 0;
  let successfulQueries = 0;
  const latencies: number[] = [];

  for (const query of testQueries) {
    for (let i = 0; i < 2; i++) {
      console.log(`\n📝 クエリ: "${query}" (${i === 0 ? '初回' : '2回目'})`);
      
      const startTime = Date.now();
      
      try {
        const documents = await retriever._getRelevantDocuments(query);
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        if (i === 1) {
          latencies.push(latency);
        }
        totalQueries++;
        
        if (documents.length > 0) {
          if (i === 1) successfulQueries++;
          
          console.log(`✅ 結果: ${documents.length}件 (${latency}ms)`);
          
          if (i === 0) {
            documents.slice(0, 3).forEach((doc, index) => {
              const metadata = doc.metadata;
              console.log(`  ${index + 1}. [ID:${metadata.id}] スコア:${metadata.score?.toFixed(3)}`);
              console.log(`     質問: ${metadata.question || 'N/A'}`);
              console.log(`     回答: ${(metadata.answer || '').substring(0, 100)}...`);
            });
          }
        } else {
          console.log(`❌ 結果なし (${latency}ms)`);
        }
        
      } catch (error) {
        console.error(`💥 エラー: ${error}`);
        totalQueries++;
      }
    }
  }

  // 統計情報
  console.log('\n📊 テスト結果統計 (2回目の実行結果に基づく)');
  console.log(`総クエリ試行回数: ${totalQueries}`);
  console.log(`成功クエリ数 (2回目): ${successfulQueries}`);
  console.log(`成功率 (2回目): ${((successfulQueries / (totalQueries / 2)) * 100).toFixed(1)}%`);
  
  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
    
    console.log(`平均レイテンシ (2回目): ${avgLatency.toFixed(1)}ms`);
    console.log(`p95レイテンシ (2回目): ${p95Latency}ms`);
    
    // チェックポイント確認
    console.log('\n🎯 チェックポイント確認 (2回目の実行結果に基づく)');
    console.log(`✅ Top-5結果取得: ${successfulQueries >= (testQueries.length * 0.8) ? 'PASS' : 'FAIL'}`);
    console.log(`✅ p95レイテンシ < 200ms (キャッシュヒット時): ${p95Latency < 200 ? 'PASS' : 'FAIL'}`);
  }
}

// 実行
if (require.main === module) {
  testHybridRetriever()
    .then(() => {
      console.log('\n🏁 テスト完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('テスト実行エラー:', error);
      process.exit(1);
    });
} 