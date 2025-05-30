/**
 * HybridRetriever - PGroonga + pgvector の統合リトリーバー
 * MCPは使用せず、シンプルなハイブリッド検索に集中
 * パフォーマンス最適化版 v2
 */

import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { generateEmbedding } from './embeddings';
import { prisma } from './db';
import { SearchResult } from './common-types';

export interface HybridRetrieverInput extends BaseRetrieverInput {
  /** 最大取得件数 */
  topK?: number;
  /** ベクトル検索のef_search値 */
  efSearchValue?: number;
  /** デバッグモード */
  isDev?: boolean;
}

// グローバルなef_search設定フラグ
let globalEfSearchSet = false;

/**
 * PGroongaクライアント（全文検索）- 最適化版 v2
 */
class PGroongaClient {
  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      // 最適化されたPGroongaクエリ - embedding_vectorを除外
      const results = await prisma.$queryRaw<Array<{
        id: number;
        main_category: string | null;
        sub_category: string | null;
        detail_category: string | null;
        question: string | null;
        answer: string;
        is_template: boolean | null;
        usage: string | null;
        note: string | null;
        issue: string | null;
        createdAt: Date;
        updatedAt: Date;
        score: number;
      }>>`
        SELECT 
          k.id,
          k.main_category,
          k.sub_category,
          k.detail_category,
          k.question,
          k.answer,
          k.is_template,
          k.usage,
          k.note,
          k.issue,
          k."createdAt",
          k."updatedAt",
          pgroonga_score(k.tableoid, k.ctid) AS score
        FROM "Knowledge" k
        WHERE 
          k.question &@* ${query} OR k.answer &@* ${query}
        ORDER BY
          score DESC
        LIMIT ${limit}
      `;

      return results.map(r => ({
        ...r,
        note: 'PGroonga検索結果'
      }));
    } catch (error) {
      console.error('PGroonga search error:', error);
      // フォールバック: ILIKE検索 - 最適化
      try {
        const fallbackResults = await prisma.knowledge.findMany({
          where: {
            OR: [
              { question: { contains: query, mode: 'insensitive' } },
              { answer: { contains: query, mode: 'insensitive' } }
            ]
          },
          take: limit,
          orderBy: { id: 'desc' },
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

        return fallbackResults.map((r, index) => ({
          ...r,
          score: 1.0 - (index * 0.1), // 順位ベースのスコア
          note: 'フォールバック検索結果'
        }));
      } catch (fallbackError) {
        console.error('Fallback search error:', fallbackError);
        return [];
      }
    }
  }
}

/**
 * pgvectorクライアント（ベクトル検索）- 最適化版 v2
 */
class PgvectorClient {
  constructor(private efSearchValue?: number) {}

  async searchEmbedding(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      // ef_searchをグローバルに一度だけ設定
      if (!globalEfSearchSet && this.efSearchValue) {
        await prisma.$executeRawUnsafe(`SET hnsw.ef_search = ${this.efSearchValue};`);
        globalEfSearchSet = true;
      }

      const queryEmbedding = await generateEmbedding(query, 1536);
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        return [];
      }

      // 最適化: ベクトル検索とKnowledge情報取得を1つのクエリで実行 - embedding_vectorを除外
      const results = await prisma.$queryRaw<Array<{
        id: number;
        main_category: string | null;
        sub_category: string | null;
        detail_category: string | null;
        question: string | null;
        answer: string;
        is_template: boolean | null;
        usage: string | null;
        note: string | null;
        issue: string | null;
        createdAt: Date;
        updatedAt: Date;
        similarity: number;
      }>>`
        SELECT
          k.id,
          k.main_category,
          k.sub_category,
          k.detail_category,
          k.question,
          k.answer,
          k.is_template,
          k.usage,
          k.note,
          k.issue,
          k."createdAt",
          k."updatedAt",
          1 - (k.embedding_vector <=> ${queryEmbedding}::vector(1536)) AS similarity
        FROM "Knowledge" k
        WHERE k.embedding_vector IS NOT NULL
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      return results.map(r => ({
        ...r,
        score: r.similarity,
        note: 'ベクトル検索結果'
      }));
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }
}

/**
 * Reciprocal Rank Fusion (RRF) による結果統合 - 最適化版 v2
 * @param pgroongaResults PGroonga検索結果
 * @param vectorResults ベクトル検索結果
 * @param topK 最終的に返す件数
 * @param k RRFのパラメータ（デフォルト: 60）
 */
function fuseByRRF(
  pgroongaResults: SearchResult[], 
  vectorResults: SearchResult[], 
  topK: number, 
  k: number = 60
): SearchResult[] {
  // 高速化: 結果が少ない場合は単純結合
  if (pgroongaResults.length === 0) {
    return vectorResults.slice(0, topK).map(r => ({ ...r, note: 'ベクトル検索結果' }));
  }
  if (vectorResults.length === 0) {
    return pgroongaResults.slice(0, topK).map(r => ({ ...r, note: 'PGroonga検索結果' }));
  }

  // IDごとにRRFスコアを計算 - Mapを使用して高速化
  const rrfScores = new Map<number, { score: number; item: SearchResult }>();

  // PGroongaの結果を処理
  for (let i = 0; i < pgroongaResults.length; i++) {
    const result = pgroongaResults[i];
    const rank = i + 1;
    const rrfScore = 1 / (k + rank);
    
    rrfScores.set(result.id, {
      score: rrfScore,
      item: { ...result, score: rrfScore }
    });
  }

  // ベクトル検索の結果を処理
  for (let i = 0; i < vectorResults.length; i++) {
    const result = vectorResults[i];
    const rank = i + 1;
    const rrfScore = 1 / (k + rank);
    
    const existing = rrfScores.get(result.id);
    if (existing) {
      existing.score += rrfScore;
      existing.item.score = existing.score;
    } else {
      rrfScores.set(result.id, {
        score: rrfScore,
        item: { ...result, score: rrfScore }
      });
    }
  }

  // RRFスコア順にソートして上位topK件を返す
  return Array.from(rrfScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(entry => ({
      ...entry.item,
      score: entry.score,
      note: 'RRF統合結果'
    }));
}

/**
 * ハイブリッドリトリーバー - 最適化版 v2
 * PGroonga全文検索とpgvectorベクトル検索を組み合わせてRRFで統合
 */
export class HybridRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers", "hybrid"];

  private pgroongaClient: PGroongaClient;
  private pgvectorClient: PgvectorClient;
  private topK: number;
  private isDev: boolean;

  constructor(input: HybridRetrieverInput = {}) {
    super(input);
    this.topK = input.topK ?? 5;
    this.isDev = input.isDev ?? false;
    
    this.pgroongaClient = new PGroongaClient();
    this.pgvectorClient = new PgvectorClient(input.efSearchValue ?? 30); // ef_searchを30に最適化
  }

  /**
   * 検索クエリに基づいてドキュメントを取得 - 最適化版 v2
   */
  async _getRelevantDocuments(query: string): Promise<Document[]> {
    if (this.isDev) console.time('HybridRetriever_Total');

    try {
      // 並列で両方の検索を実行 - 取得件数を最適化（データ転送量削減）
      const searchLimit = Math.min(this.topK * 2, 8); // 最大8件に制限
      const [pgDocs, pvDocs] = await Promise.all([
        this.pgroongaClient.search(query, searchLimit),
        this.pgvectorClient.searchEmbedding(query, searchLimit)
      ]);

      if (this.isDev) {
        console.log(`PGroonga results: ${pgDocs.length}`);
        console.log(`Vector results: ${pvDocs.length}`);
      }

      // RRFで統合 - 最適化されたアルゴリズム
      const fusedResults = fuseByRRF(pgDocs, pvDocs, this.topK);

      if (this.isDev) {
        console.log(`Fused results: ${fusedResults.length}`);
        console.timeEnd('HybridRetriever_Total');
      }

      // LangChain Documentに変換 - 最適化
      return this.convertToDocuments(fusedResults);

    } catch (error) {
      console.error('HybridRetriever error:', error);
      if (this.isDev) console.timeEnd('HybridRetriever_Total');
      return [];
    }
  }

  /**
   * SearchResultをLangChain Documentに変換 - 最適化版
   */
  private convertToDocuments(results: SearchResult[]): Document[] {
    return results.map(result => {
      // ページコンテンツを事前に構築
      const pageContent = this.formatPageContent(result);
      
      return new Document({
        pageContent,
        metadata: {
          id: result.id,
          main_category: result.main_category,
          sub_category: result.sub_category,
          detail_category: result.detail_category,
          question: result.question,
          answer: result.answer,
          is_template: result.is_template,
          usage: result.usage,
          note: result.note,
          issue: result.issue,
          score: result.score,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          source: 'parking_knowledge_base'
        }
      });
    });
  }

  /**
   * ページコンテンツのフォーマット - 最適化版
   */
  private formatPageContent(result: SearchResult): string {
    const parts: string[] = [];
    
    if (result.question) {
      parts.push(`質問: ${result.question}`);
    }
    
    if (result.answer) {
      parts.push(`回答: ${result.answer}`);
    }
    
    if (result.main_category || result.sub_category || result.detail_category) {
      const categories = [result.main_category, result.sub_category, result.detail_category]
        .filter(Boolean)
        .join(' > ');
      parts.push(`カテゴリ: ${categories}`);
    }
    
    return parts.join('\n\n');
  }
} 