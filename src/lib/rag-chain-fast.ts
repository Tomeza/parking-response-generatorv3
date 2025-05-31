/**
 * LangChain Fast RAG Chain
 * 高速化された駐車場予約システム用RAGパイプライン
 */

import { RetrievalQAChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseRetriever } from "@langchain/core/retrievers";
import { getDefaultLLM, createLLMClient } from './llm-client';
import { createFastRetriever, FastHybridRetriever } from './retriever-fast';

/**
 * 高速化用の軽量プロンプトテンプレート
 */
const FAST_PARKING_QA_PROMPT = PromptTemplate.fromTemplate(`
駐車場予約システムのサポートです。以下の情報を参考に簡潔に回答してください。

参考情報:
{context}

質問: {question}

回答（簡潔に）:
`);

/**
 * 高速RAGチェーンの設定オプション
 */
export interface FastRAGChainConfig {
  llm?: BaseChatModel;
  retriever?: BaseRetriever;
  maxTokens?: number;
  temperature?: number;
  useCache?: boolean;
  skipVectorSearch?: boolean;
  verbose?: boolean;
}

/**
 * 高速RAGチェーンクラス
 */
export class FastParkingRAGChain {
  private chain: RetrievalQAChain;
  private config: Required<FastRAGChainConfig>;

  constructor(config: FastRAGChainConfig = {}) {
    // 高速化のためのデフォルト設定
    const fastLLM = config.llm || createLLMClient({
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307', // 最速モデル
      temperature: config.temperature ?? 0.3, // 低温度で高速化
      maxTokens: config.maxTokens ?? 300 // トークン数制限
    });

    const fastRetriever = config.retriever || createFastRetriever({
      maxResults: 3, // 結果数を制限
      skipVectorSearch: config.skipVectorSearch ?? false,
      useCache: config.useCache ?? true
    });

    this.config = {
      llm: fastLLM,
      retriever: fastRetriever,
      maxTokens: config.maxTokens ?? 300,
      temperature: config.temperature ?? 0.3,
      useCache: config.useCache ?? true,
      skipVectorSearch: config.skipVectorSearch ?? false,
      verbose: config.verbose ?? false
    };

    this.chain = RetrievalQAChain.fromLLM(this.config.llm, this.config.retriever, {
      prompt: FAST_PARKING_QA_PROMPT,
      returnSourceDocuments: false, // ソースドキュメントを返さない（高速化）
      verbose: this.config.verbose
    });
  }

  /**
   * 高速質問応答
   */
  async ask(question: string): Promise<{
    text: string;
    processingTime: number;
    fromCache?: boolean;
  }> {
    const startTime = Date.now();

    try {
      const result = await this.chain.call({
        query: question
      });

      const processingTime = Date.now() - startTime;

      return {
        text: result.text,
        processingTime,
        fromCache: false
      };

    } catch (error) {
      console.error('Fast RAG Chain error:', error);
      throw new Error(`回答の生成中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 超高速モード（ベクトル検索スキップ）
   */
  async askUltraFast(question: string): Promise<{
    text: string;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      // ベクトル検索をスキップした専用リトリーバーを使用
      const ultraFastRetriever = createFastRetriever({
        maxResults: 2,
        skipVectorSearch: true,
        useCache: true
      });

      const ultraFastChain = RetrievalQAChain.fromLLM(this.config.llm, ultraFastRetriever, {
        prompt: FAST_PARKING_QA_PROMPT,
        returnSourceDocuments: false,
        verbose: false
      });

      const result = await ultraFastChain.call({
        query: question
      });

      const processingTime = Date.now() - startTime;

      return {
        text: result.text,
        processingTime
      };

    } catch (error) {
      console.error('Ultra Fast RAG Chain error:', error);
      throw new Error(`回答の生成中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * バッチ処理（並列実行で高速化）
   */
  async askBatch(questions: string[], maxConcurrency: number = 3): Promise<Array<{
    question: string;
    answer: string;
    processingTime: number;
    error?: string;
  }>> {
    const results: Array<{
      question: string;
      answer: string;
      processingTime: number;
      error?: string;
    }> = [];

    // 並列処理でバッチを実行
    for (let i = 0; i < questions.length; i += maxConcurrency) {
      const batch = questions.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (question) => {
        try {
          const result = await this.ask(question);
          return {
            question,
            answer: result.text,
            processingTime: result.processingTime
          };
        } catch (error) {
          return {
            question,
            answer: '',
            processingTime: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 設定の動的変更
   */
  updateConfig(newConfig: Partial<FastRAGChainConfig>): void {
    if (newConfig.skipVectorSearch !== undefined) {
      const newRetriever = createFastRetriever({
        maxResults: 3,
        skipVectorSearch: newConfig.skipVectorSearch,
        useCache: this.config.useCache
      });
      
      this.chain = RetrievalQAChain.fromLLM(this.config.llm, newRetriever, {
        prompt: FAST_PARKING_QA_PROMPT,
        returnSourceDocuments: false,
        verbose: this.config.verbose
      });
      
      this.config.skipVectorSearch = newConfig.skipVectorSearch;
    }
  }
}

/**
 * 高速RAGチェーンのファクトリー関数
 */
export function createFastRAGChain(options: {
  mode?: 'fast' | 'ultra-fast' | 'balanced';
  maxTokens?: number;
  useCache?: boolean;
} = {}): FastParkingRAGChain {
  const { mode = 'fast', maxTokens = 300, useCache = true } = options;

  const config: FastRAGChainConfig = {
    maxTokens,
    useCache,
    verbose: process.env.NODE_ENV === 'development'
  };

  switch (mode) {
    case 'ultra-fast':
      config.skipVectorSearch = true;
      config.maxTokens = 200;
      config.temperature = 0.1;
      break;
    case 'balanced':
      config.skipVectorSearch = false;
      config.maxTokens = 400;
      config.temperature = 0.5;
      break;
    case 'fast':
    default:
      config.skipVectorSearch = false;
      config.maxTokens = 300;
      config.temperature = 0.3;
      break;
  }

  return new FastParkingRAGChain(config);
}

/**
 * デフォルトの高速RAGチェーンインスタンス
 */
export const fastRAGChain = createFastRAGChain({ mode: 'fast' });

/**
 * 超高速質問応答関数
 */
export async function askQuestionFast(question: string): Promise<string> {
  try {
    const result = await fastRAGChain.ask(question);
    return result.text;
  } catch (error) {
    console.error('Fast question answering error:', error);
    return '申し訳ございませんが、回答の生成中にエラーが発生しました。';
  }
}

/**
 * 超高速質問応答関数（ベクトル検索なし）
 */
export async function askQuestionUltraFast(question: string): Promise<string> {
  try {
    const result = await fastRAGChain.askUltraFast(question);
    return result.text;
  } catch (error) {
    console.error('Ultra fast question answering error:', error);
    return '申し訳ございませんが、回答の生成中にエラーが発生しました。';
  }
} 