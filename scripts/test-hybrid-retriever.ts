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
    console.log(`\n📝 クエリ: "${query}"`);
    
    const startTime = Date.now();
    
    try {
      const documents = await retriever._getRelevantDocuments(query);
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      latencies.push(latency);
      totalQueries++;
      
      if (documents.length > 0) {
        successfulQueries++;
        console.log(`✅ 結果: ${documents.length}件 (${latency}ms)`);
        
        // 上位3件の結果を表示
        documents.slice(0, 3).forEach((doc, index) => {
          const metadata = doc.metadata;
          console.log(`  ${index + 1}. [ID:${metadata.id}] スコア:${metadata.score?.toFixed(3)}`);
          console.log(`     質問: ${metadata.question || 'N/A'}`);
          console.log(`     回答: ${(metadata.answer || '').substring(0, 100)}...`);
        });
      } else {
        console.log(`❌ 結果なし (${latency}ms)`);
      }
      
    } catch (error) {
      console.error(`💥 エラー: ${error}`);
      totalQueries++;
    }
  }

  // 統計情報
  console.log('\n📊 テスト結果統計');
  console.log(`総クエリ数: ${totalQueries}`);
  console.log(`成功クエリ数: ${successfulQueries}`);
  console.log(`成功率: ${((successfulQueries / totalQueries) * 100).toFixed(1)}%`);
  
  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
    
    console.log(`平均レイテンシ: ${avgLatency.toFixed(1)}ms`);
    console.log(`p95レイテンシ: ${p95Latency}ms`);
    
    // チェックポイント確認
    console.log('\n🎯 チェックポイント確認');
    console.log(`✅ Top-5結果取得: ${successfulQueries >= totalQueries * 0.8 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ p95レイテンシ < 200ms: ${p95Latency < 200 ? 'PASS' : 'FAIL'}`);
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