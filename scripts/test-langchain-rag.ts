#!/usr/bin/env ts-node

/**
 * LangChain RAG Pipeline Test Script
 * RAGパイプラインの動作確認とパフォーマンステスト
 */

import dotenv from 'dotenv';
import { ParkingRAGChain, askQuestion } from '../src/lib/rag-chain';
import { HybridRetriever } from '../src/lib/retriever';
import { createLLMClient } from '../src/lib/llm-client';

// 環境変数を読み込み（複数のファイルを試す）
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

console.log('🔧 環境変数デバッグ:');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '設定済み' : '未設定');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '設定済み' : '未設定');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '設定済み' : '未設定');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '設定済み' : '未設定');
console.log('');

/**
 * テスト用の質問セット
 */
const TEST_QUESTIONS = [
  '駐車場の料金はいくらですか？',
  'キャンセルはできますか？',
  '営業時間を教えてください',
  '大型車は駐車できますか？',
  '予約の変更方法を教えて',
  '支払い方法は何がありますか？',
  '深夜料金について教えて',
  '車高制限はありますか？'
];

/**
 * 基本的なRAGテスト
 */
async function testBasicRAG() {
  console.log('🚀 基本的なRAGテストを開始します...\n');

  try {
    // 簡易テスト
    console.log('📝 簡易質問応答テスト:');
    const simpleAnswer = await askQuestion('駐車場の料金について教えてください');
    console.log('質問: 駐車場の料金について教えてください');
    console.log('回答:', simpleAnswer);
    console.log('✅ 簡易テスト完了\n');

    // 詳細テスト
    console.log('📊 詳細RAGチェーンテスト:');
    const ragChain = new ParkingRAGChain({
      verbose: true,
      returnSourceDocuments: true
    });

    const detailedResult = await ragChain.ask('キャンセル料金はかかりますか？');
    
    console.log('質問: キャンセル料金はかかりますか？');
    console.log('回答:', detailedResult.text);
    console.log('メタデータ:', detailedResult.metadata);
    console.log('ソース数:', detailedResult.sourceDocuments?.length || 0);
    
    if (detailedResult.sourceDocuments && detailedResult.sourceDocuments.length > 0) {
      console.log('\n📚 参照されたソース:');
      detailedResult.sourceDocuments.slice(0, 3).forEach((doc, index) => {
        console.log(`${index + 1}. ID:${doc.metadata.id} - ${doc.metadata.question || 'タイトル不明'}`);
      });
    }

    console.log('✅ 詳細テスト完了\n');

  } catch (error) {
    console.error('❌ 基本RAGテストでエラーが発生しました:', error);
  }
}

/**
 * バッチテスト
 */
async function testBatchQuestions() {
  console.log('🔄 バッチ質問テストを開始します...\n');

  try {
    const ragChain = new ParkingRAGChain({
      verbose: false,
      returnSourceDocuments: false
    });

    console.time('BatchProcessing');
    const results = await ragChain.askBatch(TEST_QUESTIONS.slice(0, 4)); // 最初の4問をテスト
    console.timeEnd('BatchProcessing');

    console.log('📊 バッチ処理結果:');
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.question}`);
      if (result.error) {
        console.log('   ❌ エラー:', result.error);
      } else {
        console.log('   ✅ 回答:', result.answer.substring(0, 100) + '...');
        console.log('   ⏱️  処理時間:', result.metadata?.processingTime + 'ms');
      }
    });

    console.log('\n✅ バッチテスト完了');

  } catch (error) {
    console.error('❌ バッチテストでエラーが発生しました:', error);
  }
}

/**
 * 異なるLLMプロバイダーのテスト
 */
async function testDifferentLLMs() {
  console.log('\n🤖 異なるLLMプロバイダーのテストを開始します...\n');

  const testQuestion = '駐車場の営業時間は？';

  try {
    // Anthropic Claude
    console.log('🔵 Anthropic Claude テスト:');
    const claudeLLM = createLLMClient({
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307'
    });
    
    const claudeRAG = new ParkingRAGChain({
      llm: claudeLLM,
      verbose: false
    });

    console.time('Claude');
    const claudeResult = await claudeRAG.ask(testQuestion);
    console.timeEnd('Claude');
    
    console.log('回答:', claudeResult.text.substring(0, 150) + '...');
    console.log('処理時間:', claudeResult.metadata?.processingTime + 'ms\n');

    // OpenAI GPT (環境変数が設定されている場合のみ)
    if (process.env.OPENAI_API_KEY) {
      console.log('🟢 OpenAI GPT テスト:');
      const openaiLLM = createLLMClient({
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      });
      
      const openaiRAG = new ParkingRAGChain({
        llm: openaiLLM,
        verbose: false
      });

      console.time('OpenAI');
      const openaiResult = await openaiRAG.ask(testQuestion);
      console.timeEnd('OpenAI');
      
      console.log('回答:', openaiResult.text.substring(0, 150) + '...');
      console.log('処理時間:', openaiResult.metadata?.processingTime + 'ms\n');
    } else {
      console.log('⚠️  OpenAI API Keyが設定されていないため、OpenAIテストをスキップします\n');
    }

    console.log('✅ LLMプロバイダーテスト完了');

  } catch (error) {
    console.error('❌ LLMプロバイダーテストでエラーが発生しました:', error);
  }
}

/**
 * リトリーバー設定のテスト
 */
async function testRetrieverConfigs() {
  console.log('\n🔍 リトリーバー設定テストを開始します...\n');

  const testQuestion = '大型車の駐車について';

  try {
    // PGroongaのみ
    console.log('📝 PGroongaのみテスト:');
    const pgroongaRetriever = new HybridRetriever({
      pgroongaOnly: true,
      maxResults: 5,
      useMCP: false,
      isDev: true
    });

    const pgroongaRAG = new ParkingRAGChain({
      retriever: pgroongaRetriever,
      verbose: false
    });

    console.time('PGroonga');
    const pgroongaResult = await pgroongaRAG.ask(testQuestion);
    console.timeEnd('PGroonga');
    
    console.log('取得件数:', pgroongaResult.metadata?.retrievedCount);
    console.log('回答:', pgroongaResult.text.substring(0, 100) + '...\n');

    // ハイブリッド検索
    console.log('🔄 ハイブリッド検索テスト:');
    const hybridRetriever = new HybridRetriever({
      pgroongaOnly: false,
      maxResults: 10,
      useMCP: false, // MCPは後で有効化
      isDev: true
    });

    const hybridRAG = new ParkingRAGChain({
      retriever: hybridRetriever,
      verbose: false
    });

    console.time('Hybrid');
    const hybridResult = await hybridRAG.ask(testQuestion);
    console.timeEnd('Hybrid');
    
    console.log('取得件数:', hybridResult.metadata?.retrievedCount);
    console.log('回答:', hybridResult.text.substring(0, 100) + '...\n');

    console.log('✅ リトリーバー設定テスト完了');

  } catch (error) {
    console.error('❌ リトリーバー設定テストでエラーが発生しました:', error);
  }
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('🎯 LangChain RAG Pipeline Test Suite\n');
  console.log('='.repeat(50));

  // 環境変数チェック
  const requiredEnvVars = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 必要な環境変数が設定されていません:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    process.exit(1);
  }

  console.log('✅ 環境変数チェック完了\n');

  try {
    await testBasicRAG();
    await testBatchQuestions();
    await testDifferentLLMs();
    await testRetrieverConfigs();

    console.log('\n🎉 全てのテストが完了しました！');
    console.log('\n📋 次のステップ:');
    console.log('1. MCPサーバーの通信問題を解決');
    console.log('2. MCP統合テストを実行');
    console.log('3. エンドツーエンド評価を実施');

  } catch (error) {
    console.error('\n❌ テスト実行中に予期しないエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main();
} 