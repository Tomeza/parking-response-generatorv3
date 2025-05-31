/**
 * RetrievalQAChain のテストスクリプト
 * Step 2 のチェックポイントを確認
 */

import { ParkingRetrievalQA } from '../src/lib/retrieval-qa-chain';

// テストクエリ
const testQueries = [
  '駐車場の料金はいくらですか？',
  '予約をキャンセルしたいのですが、どうすればいいですか？',
  '営業時間を教えてください',
  '大型車は駐車できますか？',
  '深夜料金について詳しく教えてください'
];

async function testRetrievalQA() {
  console.log('🤖 RetrievalQAChain テスト開始\n');

  const qa = new ParkingRetrievalQA({
    modelName: "gpt-3.5-turbo",
    temperature: 0.1,
    maxTokens: 1000,
    retrieverConfig: {
      topK: 5,
      efSearchValue: 30,
      isDev: true
    },
    isDev: true
  });

  // ヘルスチェック
  console.log('🏥 システムヘルスチェック');
  try {
    const healthStatus = await qa.healthCheck();
    console.log(`Status: ${healthStatus.status}`);
    console.log(`Retriever: ${healthStatus.retrieverStatus}`);
    console.log(`LLM: ${healthStatus.llmStatus}`);
    console.log(`Latency: ${healthStatus.latency}ms\n`);
    
    if (healthStatus.status !== 'healthy') {
      console.error('❌ システムが正常に動作していません');
      return;
    }
  } catch (error) {
    console.error('❌ ヘルスチェック失敗:', error);
    return;
  }

  let totalQueries = 0;
  let successfulQueries = 0;
  const latencies: number[] = [];

  for (const query of testQueries) {
    console.log(`\n📝 質問: "${query}"`);
    
    try {
      const result = await qa.answerQuestion(query);
      
      latencies.push(result.metadata.totalLatency);
      totalQueries++;
      
      if (result.answer && result.answer.length > 0) {
        successfulQueries++;
        console.log(`✅ 回答生成成功 (${result.metadata.totalLatency}ms)`);
        
        // 回答を表示
        console.log(`\n💬 回答:`);
        console.log(result.answer);
        
        // ソースドキュメントを表示
        console.log(`\n📚 参考情報 (${result.sourceDocuments.length}件):`);
        result.sourceDocuments.slice(0, 3).forEach((doc, index) => {
          console.log(`  ${index + 1}. [ID:${doc.id}] スコア:${doc.score.toFixed(3)}`);
          console.log(`     カテゴリ: ${doc.category}`);
          console.log(`     質問: ${doc.question || 'N/A'}`);
          console.log(`     回答: ${doc.answer.substring(0, 100)}...`);
        });
      } else {
        console.log(`❌ 回答生成失敗 (${result.metadata.totalLatency}ms)`);
      }
      
    } catch (error) {
      console.error(`💥 エラー: ${error}`);
      totalQueries++;
    }
  }

  // 統計情報
  console.log('\n📊 テスト結果統計');
  console.log(`総質問数: ${totalQueries}`);
  console.log(`成功質問数: ${successfulQueries}`);
  console.log(`成功率: ${((successfulQueries / totalQueries) * 100).toFixed(1)}%`);
  
  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
    
    console.log(`平均レイテンシ: ${avgLatency.toFixed(1)}ms`);
    console.log(`p95レイテンシ: ${p95Latency}ms`);
    
    // チェックポイント確認
    console.log('\n🎯 Step 2 チェックポイント確認');
    console.log(`✅ QA回答生成: ${successfulQueries >= totalQueries * 0.8 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ ソースドキュメント取得: ${successfulQueries > 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ エンドツーエンド動作: ${successfulQueries === totalQueries ? 'PASS' : 'FAIL'}`);
  }

  // バッチ処理テスト
  console.log('\n🔄 バッチ処理テスト');
  try {
    const batchQueries = [
      '料金について',
      '営業時間は？',
      '予約方法を教えて'
    ];
    
    const batchStartTime = Date.now();
    const batchResults = await qa.answerQuestions(batchQueries);
    const batchLatency = Date.now() - batchStartTime;
    
    console.log(`バッチ処理完了: ${batchResults.length}件 (${batchLatency}ms)`);
    console.log(`平均処理時間: ${(batchLatency / batchResults.length).toFixed(1)}ms/件`);
    
    const batchSuccessCount = batchResults.filter(r => r.answer && r.answer.length > 0).length;
    console.log(`バッチ成功率: ${((batchSuccessCount / batchResults.length) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('バッチ処理エラー:', error);
  }
}

// 実行
if (require.main === module) {
  testRetrievalQA()
    .then(() => {
      console.log('\n🏁 RetrievalQAChain テスト完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('テスト実行エラー:', error);
      process.exit(1);
    });
} 