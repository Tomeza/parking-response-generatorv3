/**
 * LangChain Fast Hybrid Retriever
 * パフォーマンス最適化版のハイブリッドリトリーバー
 */

import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { SearchResult } from './common-types';
import { prisma } from './db';
import { generateEmbedding } from './embeddings';

export interface FastHybridRetrieverInput extends BaseRetrieverInput {
  /** 最大取得件数 */
  maxResults?: number;
  /** デバッグモード */
  isDev?: boolean;
  /** キャッシュを使用するか */
  useCache?: boolean;
  /** 早期終了の閾値（この件数に達したら検索を停止） */
  earlyStopThreshold?: number;
  /** ベクトル検索をスキップするか */
  skipVectorSearch?: boolean;
}

/**
 * 検索結果のキャッシュ
 */
const searchCache = new Map<string, Document[]>();
const CACHE_TTL = 5 * 60 * 1000; // 5分
const cacheTimestamps = new Map<string, number>();

/**
 * 高速化ハイブリッドリトリーバー
 */
export class FastHybridRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers", "fast-hybrid"];

  private maxResults: number;
  private isDev: boolean;
  private useCache: boolean;
  private earlyStopThreshold: number;
  private skipVectorSearch: boolean;

  constructor(input: FastHybridRetrieverInput = {}) {
    super(input);
    this.maxResults = input.maxResults ?? 5; // デフォルトを5に削減
    this.isDev = input.isDev ?? false;
    this.useCache = input.useCache ?? true;
    this.earlyStopThreshold = input.earlyStopThreshold ?? 3;
    this.skipVectorSearch = input.skipVectorSearch ?? false;
  }

  /**
   * 検索クエリに基づいてドキュメントを取得（高速化版）
   */
  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const startTime = Date.now();
    
    // キャッシュチェック
    if (this.useCache) {
      const cached = this.getCachedResult(query);
      if (cached) {
        if (this.isDev) console.log(`⚡ Cache hit: ${Date.now() - startTime}ms`);
        return cached;
      }
    }

    try {
      // 1. 高速PGroonga検索（最優先）
      const pgroongaResults = await this.fastPGroongaSearch(query);
      
      // 早期終了チェック
      if (pgroongaResults.length >= this.earlyStopThreshold) {
        const documents = this.convertToDocuments(pgroongaResults.slice(0, this.maxResults));
        this.setCachedResult(query, documents);
        if (this.isDev) console.log(`⚡ Early stop (PGroonga): ${Date.now() - startTime}ms`);
        return documents;
      }

      // 2. ベクトル検索（必要な場合のみ）
      let vectorResults: SearchResult[] = [];
      if (!this.skipVectorSearch && pgroongaResults.length < this.maxResults) {
        vectorResults = await this.fastVectorSearch(query, this.maxResults - pgroongaResults.length);
      }

      // 3. 結果統合
      const allResults = [...pgroongaResults, ...vectorResults];
      const uniqueResults = this.deduplicateResults(allResults);
      const limitedResults = uniqueResults.slice(0, this.maxResults);
      
      const documents = this.convertToDocuments(limitedResults);
      
      // キャッシュに保存
      if (this.useCache) {
        this.setCachedResult(query, documents);
      }

      if (this.isDev) {
        console.log(`⚡ Fast retrieval completed: ${Date.now() - startTime}ms`);
        console.log(`   PGroonga: ${pgroongaResults.length}, Vector: ${vectorResults.length}, Total: ${documents.length}`);
      }

      return documents;

    } catch (error) {
      console.error('FastHybridRetriever error:', error);
      return [];
    }
  }

  /**
   * 高速PGroonga検索
   */
  private async fastPGroongaSearch(query: string): Promise<SearchResult[]> {
    try {
      // 簡単なキーワード抽出（Kuromojiをスキップ）
      const keywords = query
        .replace(/[？?！!。、，]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1)
        .slice(0, 3); // 最初の3キーワードのみ使用

      if (keywords.length === 0) return [];

      const searchQuery = keywords.join(' ');
      
      // 質問と回答を並列検索
      const [questionResults, answerResults] = await Promise.all([
        prisma.$queryRaw<{ id: number; score: number }[]>`
          SELECT id, pgroonga_score(k.tableoid, k.ctid) AS score
          FROM "Knowledge" k
          WHERE question &@~ ${searchQuery}
          ORDER BY score DESC
          LIMIT ${this.maxResults}
        `,
        prisma.$queryRaw<{ id: number; score: number }[]>`
          SELECT id, pgroonga_score(k.tableoid, k.ctid) AS score
          FROM "Knowledge" k
          WHERE answer &@~ ${searchQuery}
          ORDER BY score DESC
          LIMIT ${this.maxResults}
        `
      ]);

      // 結果をマージして重複除去
      const allResults = [...questionResults, ...answerResults];
      const uniqueMap = new Map<number, { id: number; score: number }>();
      
      allResults.forEach(result => {
        const existing = uniqueMap.get(result.id);
        if (!existing || existing.score < result.score) {
          uniqueMap.set(result.id, result);
        }
      });

      const sortedResults = Array.from(uniqueMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, this.maxResults);

      if (sortedResults.length === 0) return [];

      // 詳細情報を取得
      const ids = sortedResults.map(r => r.id);
      const knowledgeItems = await prisma.knowledge.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          main_category: true,
          sub_category: true,
          detail_category: true,
          question: true,
          answer: true,
          is_template: true,
          usage: true,
          note: true,
          issue: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      // スコアと結合
      return knowledgeItems.map(item => {
        const scoreData = sortedResults.find(r => r.id === item.id);
        return {
          ...item,
          score: scoreData?.score || 0
        };
      });

    } catch (error) {
      console.error('Fast PGroonga search error:', error);
      return [];
    }
  }

  /**
   * 高速ベクトル検索
   */
  private async fastVectorSearch(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // ef_searchを低く設定して高速化
      await prisma.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = 40;`);
      
      const queryEmbedding = await generateEmbedding(query, 1536);
      if (!queryEmbedding || queryEmbedding.length === 0) return [];

      const vectorResults = await prisma.$queryRaw<{ id: number; similarity: number }[]>`
        SELECT id, 1 - (embedding_vector <=> ${queryEmbedding}::vector) as similarity
        FROM "Knowledge"
        WHERE embedding_vector IS NOT NULL
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      if (vectorResults.length === 0) return [];

      // 詳細情報を取得
      const ids = vectorResults.map(r => r.id);
      const knowledgeItems = await prisma.knowledge.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          main_category: true,
          sub_category: true,
          detail_category: true,
          question: true,
          answer: true,
          is_template: true,
          usage: true,
          note: true,
          issue: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      // 類似度スコアと結合
      return knowledgeItems.map(item => {
        const vectorData = vectorResults.find(r => r.id === item.id);
        return {
          ...item,
          score: vectorData?.similarity || 0
        };
      });

    } catch (error) {
      console.error('Fast vector search error:', error);
      return [];
    }
  }

  /**
   * キャッシュから結果を取得
   */
  private getCachedResult(query: string): Document[] | null {
    const cacheKey = query.toLowerCase().trim();
    const timestamp = cacheTimestamps.get(cacheKey);
    
    if (timestamp && Date.now() - timestamp < CACHE_TTL) {
      return searchCache.get(cacheKey) || null;
    }
    
    // 期限切れのキャッシュを削除
    searchCache.delete(cacheKey);
    cacheTimestamps.delete(cacheKey);
    return null;
  }

  /**
   * 結果をキャッシュに保存
   */
  private setCachedResult(query: string, documents: Document[]): void {
    const cacheKey = query.toLowerCase().trim();
    searchCache.set(cacheKey, documents);
    cacheTimestamps.set(cacheKey, Date.now());
    
    // キャッシュサイズ制限（100件まで）
    if (searchCache.size > 100) {
      const oldestKey = Array.from(cacheTimestamps.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      searchCache.delete(oldestKey);
      cacheTimestamps.delete(oldestKey);
    }
  }

  /**
   * 検索結果の重複除去
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<number>();
    const unique: SearchResult[] = [];

    const sorted = results.sort((a, b) => (b.score || 0) - (a.score || 0));

    for (const result of sorted) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * SearchResultをLangChain Documentに変換
   */
  private convertToDocuments(results: SearchResult[]): Document[] {
    return results.map(result => new Document({
      pageContent: this.formatPageContent(result),
      metadata: {
        id: result.id,
        main_category: result.main_category,
        sub_category: result.sub_category,
        detail_category: result.detail_category,
        question: result.question,
        answer: result.answer,
        score: result.score,
        source: 'parking_knowledge_base'
      }
    }));
  }

  /**
   * ページコンテンツのフォーマット（簡略版）
   */
  private formatPageContent(result: SearchResult): string {
    const parts = [];
    
    if (result.question) {
      parts.push(`質問: ${result.question}`);
    }
    
    if (result.answer) {
      parts.push(`回答: ${result.answer}`);
    }

    return parts.join('\n\n');
  }
}

/**
 * 高速リトリーバーのファクトリー関数
 */
export function createFastRetriever(options: {
  maxResults?: number;
  skipVectorSearch?: boolean;
  useCache?: boolean;
} = {}): FastHybridRetriever {
  return new FastHybridRetriever({
    maxResults: options.maxResults ?? 3,
    skipVectorSearch: options.skipVectorSearch ?? false,
    useCache: options.useCache ?? true,
    earlyStopThreshold: 2,
    isDev: process.env.NODE_ENV === 'development'
  });
} 