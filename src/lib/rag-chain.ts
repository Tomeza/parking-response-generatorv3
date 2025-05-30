/**
 * LangChain RAG Chain
 * 駐車場予約システム用のRAG（Retrieval Augmented Generation）パイプライン
 */

import { RetrievalQAChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseRetriever } from "@langchain/core/retrievers";
import { getDefaultLLM } from './llm-client';
import { defaultRetriever, HybridRetriever } from './retriever';

/**
 * 駐車場予約システム用のカスタムプロンプトテンプレート
 */
const PARKING_QA_PROMPT = PromptTemplate.fromTemplate(`
あなたは駐車場予約システムの専門的なカスタマーサポートアシスタントです。
以下の知識ベースの情報を参考にして、ユーザーの質問に正確で親切な回答を提供してください。

知識ベース:
{context}

ユーザーの質問: {question}

回答の際は以下の点に注意してください：
1. 知識ベースの情報に基づいて正確に回答する
2. 情報が不足している場合は、その旨を明確に伝える
3. 駐車場予約に関する具体的な手順や注意事項を含める
4. 丁寧で分かりやすい日本語で回答する
5. 必要に応じて関連する情報も提供する

回答:
`);

/**
 * RAGチェーンの設定オプション
 */
export interface RAGChainConfig {
  llm?: BaseChatModel;
  retriever?: BaseRetriever;
  prompt?: PromptTemplate;
  returnSourceDocuments?: boolean;
  verbose?: boolean;
}

/**
 * RAGチェーンクラス
 */
export class ParkingRAGChain {
  private chain: RetrievalQAChain;
  private config: Required<RAGChainConfig>;

  constructor(config: RAGChainConfig = {}) {
    this.config = {
      llm: config.llm || getDefaultLLM(),
      retriever: config.retriever || defaultRetriever,
      prompt: config.prompt || PARKING_QA_PROMPT,
      returnSourceDocuments: config.returnSourceDocuments ?? true,
      verbose: config.verbose ?? false
    };

    this.chain = RetrievalQAChain.fromLLM(this.config.llm, this.config.retriever, {
      prompt: this.config.prompt,
      returnSourceDocuments: this.config.returnSourceDocuments,
      verbose: this.config.verbose
    });
  }

  /**
   * 質問に対する回答を生成
   */
  async ask(question: string): Promise<{
    text: string;
    sourceDocuments?: any[];
    metadata?: {
      retrievedCount: number;
      processingTime: number;
      sources: string[];
    };
  }> {
    const startTime = Date.now();

    try {
      const result = await this.chain.call({
        query: question
      });

      const processingTime = Date.now() - startTime;

      // ソースドキュメントから情報を抽出
      const sourceDocuments = result.sourceDocuments || [];
      const sources = sourceDocuments.map((doc: any) => {
        const metadata = doc.metadata || {};
        return `ID:${metadata.id} - ${metadata.main_category || 'カテゴリ不明'}`;
      });

      return {
        text: result.text,
        sourceDocuments: this.config.returnSourceDocuments ? sourceDocuments : undefined,
        metadata: {
          retrievedCount: sourceDocuments.length,
          processingTime,
          sources
        }
      };

    } catch (error) {
      console.error('RAG Chain error:', error);
      throw new Error(`回答の生成中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * バッチ処理で複数の質問に回答
   */
  async askBatch(questions: string[]): Promise<Array<{
    question: string;
    answer: string;
    error?: string;
    metadata?: any;
  }>> {
    const results = [];

    for (const question of questions) {
      try {
        const result = await this.ask(question);
        results.push({
          question,
          answer: result.text,
          metadata: result.metadata
        });
      } catch (error) {
        results.push({
          question,
          answer: '',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * リトリーバーの設定を更新
   */
  updateRetriever(retriever: BaseRetriever): void {
    this.config.retriever = retriever;
    this.chain = RetrievalQAChain.fromLLM(this.config.llm, this.config.retriever, {
      prompt: this.config.prompt,
      returnSourceDocuments: this.config.returnSourceDocuments,
      verbose: this.config.verbose
    });
  }

  /**
   * LLMの設定を更新
   */
  updateLLM(llm: BaseChatModel): void {
    this.config.llm = llm;
    this.chain = RetrievalQAChain.fromLLM(this.config.llm, this.config.retriever, {
      prompt: this.config.prompt,
      returnSourceDocuments: this.config.returnSourceDocuments,
      verbose: this.config.verbose
    });
  }

  /**
   * MCPを有効/無効にする
   */
  toggleMCP(enabled: boolean): void {
    if (this.config.retriever instanceof HybridRetriever) {
      // 新しいリトリーバーインスタンスを作成
      const newRetriever = new HybridRetriever({
        pgroongaOnly: false,
        maxResults: 10,
        useMCP: enabled,
        isDev: process.env.NODE_ENV === 'development'
      });
      this.updateRetriever(newRetriever);
    }
  }
}

/**
 * デフォルトのRAGチェーンインスタンスを取得（遅延初期化）
 */
export function getDefaultRAGChain(): ParkingRAGChain {
  return new ParkingRAGChain({
    verbose: process.env.NODE_ENV === 'development'
  });
}

/**
 * デフォルトのRAGチェーンインスタンス（後方互換性のため）
 */
export const defaultRAGChain = getDefaultRAGChain;

/**
 * 簡易的な質問応答関数
 */
export async function askQuestion(question: string): Promise<string> {
  try {
    const ragChain = getDefaultRAGChain();
    const result = await ragChain.ask(question);
    return result.text;
  } catch (error) {
    console.error('Question answering error:', error);
    return '申し訳ございませんが、回答の生成中にエラーが発生しました。しばらく時間をおいて再度お試しください。';
  }
} 