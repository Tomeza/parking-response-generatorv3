/**
 * RetrievalQAChain - HybridRetrieverとOpenAI LLMを統合したQAシステム
 * Step 2: LangChainのRetrievalQAChainを使用した実装
 */

import { RetrievalQAChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HybridRetriever } from './hybrid-retriever';

export interface RetrievalQAConfig {
  /** OpenAI APIキー */
  openaiApiKey?: string;
  /** 使用するモデル */
  modelName?: string;
  /** 温度設定 */
  temperature?: number;
  /** 最大トークン数 */
  maxTokens?: number;
  /** HybridRetrieverの設定 */
  retrieverConfig?: {
    topK?: number;
    efSearchValue?: number;
    isDev?: boolean;
  };
  /** デバッグモード */
  isDev?: boolean;
}

/**
 * 駐車場専用のプロンプトテンプレート
 */
const PARKING_QA_PROMPT = PromptTemplate.fromTemplate(`
あなたは駐車場サービスの専門カスタマーサポートです。以下の情報を基に、お客様の質問に丁寧で正確な回答をしてください。

【重要な回答ルール】
1. 提供された情報のみを使用して回答してください
2. 情報が不足している場合は、「詳細については直接お問い合わせください」と案内してください
3. 丁寧で親しみやすい敬語を使用してください
4. 具体的な数値や条件がある場合は正確に伝えてください
5. お客様の安全と満足を最優先に考えた回答をしてください

【参考情報】
{context}

【お客様の質問】
{question}

【回答】
`);

/**
 * RetrievalQAChainのラッパークラス
 */
export class ParkingRetrievalQA {
  private chain: RetrievalQAChain;
  private isDev: boolean;

  constructor(config: RetrievalQAConfig = {}) {
    this.isDev = config.isDev ?? false;

    // OpenAI LLMの初期化
    const llm = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      modelName: config.modelName || "gpt-3.5-turbo",
      temperature: config.temperature ?? 0.1, // 一貫性のある回答のため低めに設定
      maxTokens: config.maxTokens ?? 1000,
    });

    // HybridRetrieverの初期化
    const retriever = new HybridRetriever({
      topK: config.retrieverConfig?.topK ?? 5,
      efSearchValue: config.retrieverConfig?.efSearchValue ?? 30,
      isDev: config.retrieverConfig?.isDev ?? false,
    });

    // RetrievalQAChainの作成
    this.chain = RetrievalQAChain.fromLLM(llm, retriever, {
      prompt: PARKING_QA_PROMPT,
      returnSourceDocuments: true, // ソースドキュメントも返す
    });
  }

  /**
   * 質問に対する回答を生成
   * @param question ユーザーの質問
   * @returns 回答とソースドキュメント
   */
  async answerQuestion(question: string): Promise<{
    answer: string;
    sourceDocuments: Array<{
      id: number;
      question: string | null;
      answer: string;
      category: string;
      score: number;
    }>;
    metadata: {
      totalLatency: number;
      retrievalLatency: number;
      llmLatency: number;
    };
  }> {
    if (this.isDev) console.time('RetrievalQA_Total');
    
    const startTime = Date.now();
    
    try {
      if (this.isDev) console.time('RetrievalQA_Chain');
      
      const result = await this.chain.call({
        query: question,
      });
      
      if (this.isDev) console.timeEnd('RetrievalQA_Chain');
      
      const endTime = Date.now();
      const totalLatency = endTime - startTime;

      // ソースドキュメントの整形
      const sourceDocuments = result.sourceDocuments?.map((doc: any) => ({
        id: doc.metadata.id,
        question: doc.metadata.question,
        answer: doc.metadata.answer,
        category: [
          doc.metadata.main_category,
          doc.metadata.sub_category,
          doc.metadata.detail_category
        ].filter(Boolean).join(' > '),
        score: doc.metadata.score,
      })) || [];

      if (this.isDev) {
        console.log(`Total latency: ${totalLatency}ms`);
        console.log(`Source documents: ${sourceDocuments.length}`);
        console.timeEnd('RetrievalQA_Total');
      }

      return {
        answer: result.text,
        sourceDocuments,
        metadata: {
          totalLatency,
          retrievalLatency: 0, // TODO: 詳細な計測が必要な場合
          llmLatency: 0, // TODO: 詳細な計測が必要な場合
        },
      };
    } catch (error) {
      console.error('RetrievalQA error:', error);
      if (this.isDev) console.timeEnd('RetrievalQA_Total');
      
      throw new Error(`質問の処理中にエラーが発生しました: ${error}`);
    }
  }

  /**
   * バッチ処理で複数の質問に回答
   * @param questions 質問の配列
   * @returns 回答の配列
   */
  async answerQuestions(questions: string[]): Promise<Array<{
    question: string;
    answer: string;
    sourceDocuments: Array<{
      id: number;
      question: string | null;
      answer: string;
      category: string;
      score: number;
    }>;
    metadata: {
      totalLatency: number;
      retrievalLatency: number;
      llmLatency: number;
    };
  }>> {
    const results = [];
    
    for (const question of questions) {
      try {
        const result = await this.answerQuestion(question);
        results.push({
          question,
          ...result,
        });
      } catch (error) {
        console.error(`Error processing question: ${question}`, error);
        results.push({
          question,
          answer: "申し訳ございませんが、この質問の処理中にエラーが発生しました。直接お問い合わせください。",
          sourceDocuments: [],
          metadata: {
            totalLatency: 0,
            retrievalLatency: 0,
            llmLatency: 0,
          },
        });
      }
    }
    
    return results;
  }

  /**
   * システムの健全性チェック
   * @returns システムの状態
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    retrieverStatus: 'ok' | 'error';
    llmStatus: 'ok' | 'error';
    latency: number;
  }> {
    const startTime = Date.now();
    
    try {
      // 簡単なテスト質問で動作確認
      const testResult = await this.answerQuestion("営業時間を教えてください");
      const latency = Date.now() - startTime;
      
      return {
        status: testResult.answer ? 'healthy' : 'unhealthy',
        retrieverStatus: testResult.sourceDocuments.length > 0 ? 'ok' : 'error',
        llmStatus: testResult.answer.length > 0 ? 'ok' : 'error',
        latency,
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        retrieverStatus: 'error',
        llmStatus: 'error',
        latency: Date.now() - startTime,
      };
    }
  }
} 