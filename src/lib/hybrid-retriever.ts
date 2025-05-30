/**
 * HybridRetriever - PGroonga + pgvector の統合リトリーバー
 * MCPは使用せず、シンプルなハイブリッド検索に集中
 * パフォーマンス最適化版 v2
 * フェーズ A: 並列化＆キャッシュ対応
 */

import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { generateEmbedding } from './embeddings';
import { prisma } from './db';
import { SearchResult, Knowledge } from './common-types'; // Knowledge をインポート
import Redis from 'ioredis';

// Supabase クライアントの型とインスタンス (仮)
// 実際のプロジェクトでは適切な初期化を行う
interface SupabaseFilter {
  [key: string]: any;
}
interface SupabaseClient {
  from: (table: string) => {
    select: (columns: string) => {
      match: (filters: SupabaseFilter) => Promise<{ data: Knowledge[], error: any }>;
    };
  };
}

export interface HybridRetrieverInput extends BaseRetrieverInput {
  /** 最大取得件数 */
  topK?: number;
  /** ベクトル検索のef_search値 */
  efSearchValue?: number;
  /** デバッグモード */
  isDev?: boolean;
  redisUrl?: string; // Redis接続URL
  supabaseClient?: SupabaseClient; // 追加済み
}

interface ParsedQuery {
  filters: SupabaseFilter; 
  keywords: string[];
}

// Redisクライアントのインスタンス
// 環境変数などからURLを指定することを推奨

// グローバルなef_search設定フラグ
let globalEfSearchSet = false;

/**
 * PGroongaクライアント（全文検索）- 最適化版 v2
 */
class PGroongaClient {
  async search(keywords: string[], limit: number = 10): Promise<SearchResult[]> {
    if (keywords.length === 0) return [];
    const query = keywords.join(' '); // 配列をスペース区切りの文字列に
    try {
      const results = await prisma.$queryRaw<SearchResult[]>`
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
      return results.map(r => ({ ...r, note: 'PGroonga検索結果' }));
    } catch (error) {
      console.error('PGroonga search error:', error);
      try {
        const fallbackResults = await prisma.knowledge.findMany({
          where: {
            OR: keywords.flatMap(keyword => [
              { question: { contains: keyword, mode: 'insensitive' } },
              { answer: { contains: keyword, mode: 'insensitive' } }
            ])
          },
          take: limit,
          orderBy: { id: 'desc' },
          select: { id: true, main_category: true, sub_category: true, detail_category: true, question: true, answer: true, is_template: true, usage: true, note: true, issue: true, createdAt: true, updatedAt: true }
        });
        return fallbackResults.map((r, index) => ({ ...r, score: 1.0 - (index * 0.1), note: 'フォールバック検索結果' }));
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

  async searchEmbedding(keywords: string[], limit: number = 10): Promise<SearchResult[]> {
    if (keywords.length === 0) return [];
    const query = keywords.join(' '); // 配列をスペース区切りの文字列に
    try {
      if (!globalEfSearchSet && this.efSearchValue) {
        await prisma.$executeRawUnsafe(`SET hnsw.ef_search = ${this.efSearchValue};`);
        globalEfSearchSet = true;
      }
      const queryEmbedding = await generateEmbedding(query, 1536);
      if (!queryEmbedding || queryEmbedding.length === 0) return [];
      const results = await prisma.$queryRaw<SearchResult[]>`
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
      return results.map(r => ({ ...r, score: (r as any).similarity, note: 'ベクトル検索結果' }));
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }
}

function combineResults(
  pgroongaResults: SearchResult[], 
  vectorResults: SearchResult[], 
  supabaseResults: Knowledge[], // Supabaseからの結果 (Knowledge型想定)
  topK: number, 
  k: number = 60
): SearchResult[] {
  // Supabaseの結果をSearchResult形式に変換 (scoreは仮で0.5)
  const supabaseSearchDocs: SearchResult[] = supabaseResults.map((doc, index) => ({
    ...doc,
    score: 0.5 + (0.1 / (index + 1)), // Supabase内での順位も少し考慮
    note: 'Supabase動的SQL結果'
  }));

  const allResults = [...pgroongaResults, ...vectorResults, ...supabaseSearchDocs];

  if (allResults.length === 0) return [];
  
  const rrfScores = new Map<number, { score: number; item: SearchResult }>();

  allResults.forEach((result) => {
    if (!result || typeof result.id !== 'number') return; // IDがないものはスキップ
    const rrfScorePart = 1 / (k + (result.score || 0.001)); // スコアがない場合は小さな値

    if (rrfScores.has(result.id)) {
      const existing = rrfScores.get(result.id)!;
      existing.score += rrfScorePart;
      existing.item.score = existing.score; // RRFスコアで上書き
    } else {
      rrfScores.set(result.id, {
        score: rrfScorePart,
        item: { ...result, score: rrfScorePart, note: result.note || 'RRF統合候補' }
      });
    }
  });

  return Array.from(rrfScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(entry => ({
      ...entry.item,
      score: entry.score, 
      note: entry.item.note || 'RRF統合結果' // 各ソースのnoteを引き継ぐか、RRF統合結果とする
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
  private supabase: SupabaseClient; // ★ プロパティとして定義
  private redis: Redis; // ★ Redisインスタンスもプロパティに

  constructor(input: HybridRetrieverInput = {}) {
    super(input);
    this.topK = input.topK ?? 5;
    this.isDev = input.isDev ?? false;
    
    this.pgroongaClient = new PGroongaClient();
    this.pgvectorClient = new PgvectorClient(input.efSearchValue ?? 30); // ef_searchを30に最適化

    // ★ Redisクライアントをインスタンスプロパティとして初期化
    this.redis = new Redis(input.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.redis.on('error', (err) => {
      console.error('HybridRetriever Redis Client Error', err);
    });

    // ★ SupabaseクライアントをDIまたはデフォルトモックで初期化
    if (input.supabaseClient) {
      this.supabase = input.supabaseClient;
    } else {
      // DIされなかった場合のフォールバック (テストやローカル開発用の仮実装)
      // この仮実装はテストの邪魔にならないように、非常に単純なものにするか、
      // エラーをスローするなどして、未設定であることを明確にするのが望ましい
      console.warn('Supabase client not injected, using default mock/placeholder.');
      this.supabase = {
        from: (table: string) => ({
          select: (columns: string) => ({
            match: async (filters: SupabaseFilter) => {
              console.log(`[Mock Supabase] Querying table ${table} with filters:`, filters);
              // デフォルトでは空の結果を返すか、エラーをスローする
              return { data: [], error: new Error('Mock Supabase: Not implemented') };
            }
          })
        })
      };
    }
  }

  // フェーズBで実装予定 (parseQuery)
  private async parseQuery(query: string): Promise<ParsedQuery> {
    if (this.isDev) console.log(`Parsing query: ${query}`);
    // 仮実装: クエリ全体をキーワードとし、フィルターは空とする
    // 実際のSelfQueryRetrieverではここでLLMコールなどが入る
    return {
      filters: {},
      keywords: query.split(/\s+/).filter(Boolean) // スペースで分割してキーワード配列に
    };
  }

  /**
   * 検索クエリに基づいてドキュメントを取得 - 最適化版 v2
   */
  async _getRelevantDocuments(query: string): Promise<Document[]> {
    if (this.isDev) console.time('HybridRetriever_Total');

    const { filters, keywords } = await this.parseQuery(query);
    const cacheKey = `${query}:${JSON.stringify(filters)}:${keywords.join(',')}`;
    let redisGetFailed = false; // ★ GETエラーフラグ

    try {
      const cachedResults = await this.redis.get(cacheKey); // ★ this.redis を使用
      if (cachedResults) {
        if (this.isDev) {
          console.log('Cache HIT!');
          console.timeEnd('HybridRetriever_Total');
        }
        const parsedResults: SearchResult[] = JSON.parse(cachedResults);
        return this.convertToDocuments(parsedResults);
      }
    } catch (cacheError) {
      console.error('Redis GET error:', cacheError);
      redisGetFailed = true; // ★ フラグを立てる
    }

    if (this.isDev) console.log('Cache MISS or GET error, querying databases...');

    try {
      const searchLimit = Math.min(this.topK * 2, 8);
      
      const [pgDocs, pvDocs, sbDocsData] = await Promise.all([
        this.pgroongaClient.search(keywords, searchLimit),
        this.pgvectorClient.searchEmbedding(keywords, searchLimit),
        this.supabase.from('knowledge').select('*').match(filters) // ★ this.supabase を使用
      ]);

      const sbDocs = sbDocsData.data;
      if (this.isDev) {
        console.log(`PGroonga results: ${pgDocs.length}`);
        console.log(`Vector results: ${pvDocs.length}`);
        console.log(`Supabase results: ${sbDocs.length}`);
      }

      const fusedResults = combineResults(pgDocs, pvDocs, sbDocs, this.topK);

      if (!redisGetFailed) { // ★ GETが成功した場合のみSETを試みる
        try {
          await this.redis.set(cacheKey, JSON.stringify(fusedResults), 'EX', 3600); // ★ this.redis を使用
        } catch (cacheSetError) {
          console.error('Redis SET error:', cacheSetError);
        }
      }

      if (this.isDev) {
        console.log(`Fused results: ${fusedResults.length}`);
        console.timeEnd('HybridRetriever_Total');
      }
      return this.convertToDocuments(fusedResults);
    } catch (dbError) {
      console.error('HybridRetriever DB/Service error:', dbError);
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
          source: result.note || 'hybrid-search'
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

  // ★追加: クリーンアップメソッド (テストやアプリケーション終了時に呼ぶ)
  async cleanup(): Promise<void> {
    if (this.redis && typeof this.redis.quit === 'function') {
      await this.redis.quit();
    }
  }
} 