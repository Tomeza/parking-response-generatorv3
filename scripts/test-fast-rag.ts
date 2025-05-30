#!/usr/bin/env ts-node

/**
 * Fast RAG Performance Test Script
 * 高速化されたRAGシステムのパフォーマンステスト
 */

import dotenv from 'dotenv';
import { createFastRAGChain, askQuestionFast, askQuestionUltraFast } from '../src/lib/rag-chain-fast';
import { ParkingRAGChain } from '../src/lib/rag-chain';
import { createFastRetriever } from '../src/lib/retriever-fast';

// 環境変数を読み込み
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

/**
 * テスト用の質問セット
 */
const PERFORMANCE_TEST_QUESTIONS = [
  '駐車場の料金は？',
  'キャンセルできる？',
  '営業時間は？',
  '大型車OK？',
  '支払い方法は？',
  '深夜料金は？',
  '車高制限は？',
  '予約変更は？'
];

/**
 * パフォーマンス比較テスト
 */
async function performanceComparison() {
  console.log('🚀 パフォーマンス比較テストを開始します...\n');

  const testQuestion = '駐車場の料金について教えてください';

  // 1. 従来のRAGチェーン
  console.log('📊 従来のRAGチェーン:');
  const originalRAG = new ParkingRAGChain({ verbose: false });
  
  console.time('Original');
  const originalResult = await originalRAG.ask(testQuestion);
  console.timeEnd('Original');
  
  console.log(`処理時間: ${originalResult.metadata?.processingTime}ms`);
  console.log(`回答長: ${originalResult.text.length}文字\n`);

  // 2. 高速RAGチェーン
  console.log('⚡ 高速RAGチェーン:');
  const fastRAG = createFastRAGChain({ mode: 'fast' });
  
  console.time('Fast');
  const fastResult = await fastRAG.ask(testQuestion);
  console.timeEnd('Fast');
  
  console.log(`処理時間: ${fastResult.processingTime}ms`);
  console.log(`回答長: ${fastResult.text.length}文字\n`);

  // 3. 超高速RAGチェーン
  console.log('🚀 超高速RAGチェーン（ベクトル検索なし）:');
  const ultraFastRAG = createFastRAGChain({ mode: 'ultra-fast' });
  
  console.time('UltraFast');
  const ultraFastResult = await ultraFastRAG.askUltraFast(testQuestion);
  console.timeEnd('UltraFast');
  
  console.log(`処理時間: ${ultraFastResult.processingTime}ms`);
  console.log(`回答長: ${ultraFastResult.text.length}文字\n`);

  // 4. パフォーマンス改善率の計算
  const originalTime = originalResult.metadata?.processingTime || 0;
  const fastImprovement = ((originalTime - fastResult.processingTime) / originalTime * 100).toFixed(1);
  const ultraFastImprovement = ((originalTime - ultraFastResult.processingTime) / originalTime * 100).toFixed(1);

  console.log('📈 パフォーマンス改善率:');
  console.log(`高速版: ${fastImprovement}% 改善`);
  console.log(`超高速版: ${ultraFastImprovement}% 改善\n`);
}

/**
 * キャッシュ効果テスト
 */
async function cacheEffectTest() {
  console.log('💾 キャッシュ効果テストを開始します...\n');

  const testQuestion = '営業時間を教えて';
  const fastRAG = createFastRAGChain({ mode: 'fast', useCache: true });

  // 1回目（キャッシュなし）
  console.log('1回目（キャッシュなし）:');
  console.time('FirstCall');
  const firstResult = await fastRAG.ask(testQuestion);
  console.timeEnd('FirstCall');
  console.log(`処理時間: ${firstResult.processingTime}ms\n`);

  // 2回目（キャッシュあり）
  console.log('2回目（キャッシュあり）:');
  console.time('SecondCall');
  const secondResult = await fastRAG.ask(testQuestion);
  console.timeEnd('SecondCall');
  console.log(`処理時間: ${secondResult.processingTime}ms\n`);

  const cacheImprovement = ((firstResult.processingTime - secondResult.processingTime) / firstResult.processingTime * 100).toFixed(1);
  console.log(`💾 キャッシュによる改善: ${cacheImprovement}%\n`);
}

/**
 * バッチ処理パフォーマンステスト
 */
async function batchPerformanceTest() {
  console.log('🔄 バッチ処理パフォーマンステストを開始します...\n');

  const questions = PERFORMANCE_TEST_QUESTIONS.slice(0, 6); // 6問でテスト

  // 1. 従来の逐次処理
  console.log('📊 従来の逐次処理:');
  const originalRAG = new ParkingRAGChain({ verbose: false });
  
  console.time('SequentialBatch');
  const sequentialResults = await originalRAG.askBatch(questions);
  console.timeEnd('SequentialBatch');
  
  const sequentialTotalTime = sequentialResults.reduce((sum, r) => sum + (r.metadata?.processingTime || 0), 0);
  console.log(`総処理時間: ${sequentialTotalTime}ms`);
  console.log(`平均処理時間: ${(sequentialTotalTime / questions.length).toFixed(0)}ms/質問\n`);

  // 2. 高速並列処理
  console.log('⚡ 高速並列処理:');
  const fastRAG = createFastRAGChain({ mode: 'fast' });
  
  console.time('ParallelBatch');
  const parallelResults = await fastRAG.askBatch(questions, 3); // 3並列
  console.timeEnd('ParallelBatch');
  
  const parallelTotalTime = parallelResults.reduce((sum, r) => sum + r.processingTime, 0);
  console.log(`総処理時間: ${parallelTotalTime}ms`);
  console.log(`平均処理時間: ${(parallelTotalTime / questions.length).toFixed(0)}ms/質問\n`);

  const batchImprovement = ((sequentialTotalTime - parallelTotalTime) / sequentialTotalTime * 100).toFixed(1);
  console.log(`🚀 バッチ処理改善: ${batchImprovement}%\n`);
}

/**
 * リトリーバー単体パフォーマンステスト
 */
async function retrieverPerformanceTest() {
  console.log('🔍 リトリーバー単体パフォーマンステストを開始します...\n');

  const testQuery = '駐車場の料金について';

  // 1. PGroongaのみ（超高速）
  console.log('📝 PGroongaのみ:');
  const pgroongaRetriever = createFastRetriever({
    maxResults: 3,
    skipVectorSearch: true,
    useCache: false
  });

  console.time('PGroongaOnly');
  const pgroongaResults = await pgroongaRetriever._getRelevantDocuments(testQuery);
  console.timeEnd('PGroongaOnly');
  console.log(`取得件数: ${pgroongaResults.length}\n`);

  // 2. ハイブリッド（高速）
  console.log('🔄 ハイブリッド（高速）:');
  const hybridRetriever = createFastRetriever({
    maxResults: 3,
    skipVectorSearch: false,
    useCache: false
  });

  console.time('HybridFast');
  const hybridResults = await hybridRetriever._getRelevantDocuments(testQuery);
  console.timeEnd('HybridFast');
  console.log(`取得件数: ${hybridResults.length}\n`);

  // 3. キャッシュ効果
  console.log('💾 キャッシュ効果:');
  const cachedRetriever = createFastRetriever({
    maxResults: 3,
    skipVectorSearch: false,
    useCache: true
  });

  console.time('CachedFirst');
  await cachedRetriever._getRelevantDocuments(testQuery);
  console.timeEnd('CachedFirst');

  console.time('CachedSecond');
  await cachedRetriever._getRelevantDocuments(testQuery);
  console.timeEnd('CachedSecond');
}

/**
 * 実用的なレスポンス時間テスト
 */
async function realWorldResponseTest() {
  console.log('🌍 実用的なレスポンス時間テストを開始します...\n');

  const realQuestions = [
    '今すぐ予約できますか？',
    '料金はいくらですか？',
    'キャンセル料はかかりますか？',
    '24時間営業ですか？',
    '大型車でも大丈夫ですか？'
  ];

  console.log('目標: 1秒以内の応答\n');

  for (const question of realQuestions) {
    console.log(`質問: ${question}`);
    
    const startTime = Date.now();
    const answer = await askQuestionUltraFast(question);
    const responseTime = Date.now() - startTime;
    
    const status = responseTime <= 1000 ? '✅' : '❌';
    console.log(`${status} 応答時間: ${responseTime}ms`);
    console.log(`回答: ${answer.substring(0, 50)}...\n`);
  }
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('⚡ Fast RAG Performance Test Suite\n');
  console.log('='.repeat(50));

  // 環境変数チェック
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY が設定されていません');
    process.exit(1);
  }

  console.log('✅ 環境変数チェック完了\n');

  try {
    await performanceComparison();
    await cacheEffectTest();
    await batchPerformanceTest();
    await retrieverPerformanceTest();
    await realWorldResponseTest();

    console.log('🎉 全てのパフォーマンステストが完了しました！');
    console.log('\n📊 推奨設定:');
    console.log('- 一般的な用途: createFastRAGChain({ mode: "fast" })');
    console.log('- 超高速が必要: createFastRAGChain({ mode: "ultra-fast" })');
    console.log('- 高品質重視: createFastRAGChain({ mode: "balanced" })');

  } catch (error) {
    console.error('\n❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main();
} 