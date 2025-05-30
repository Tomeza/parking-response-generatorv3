/**
 * LangChain Hybrid Retriever
 * 既存の検索機能（PGroonga + Vector + MCP）をLangChainのリトリーバーとして統合
 */

import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { searchKnowledge } from './search';
import { SearchResult } from './common-types';
import { getMCPClient } from './mcp-client';

export interface HybridRetrieverInput extends BaseRetrieverInput {
  /** PGroongaのみを使用するかどうか */
  pgroongaOnly?: boolean;
  /** ベクトル検索のef_search値 */
  efSearchValue?: number;
  /** 最大取得件数 */
  maxResults?: number;
  /** MCPを使用するかどうか */
  useMCP?: boolean;
  /** デバッグモード */
  isDev?: boolean;
}

/**
 * ハイブリッドリトリーバー
 * PGroonga全文検索、ベクトル検索、MCP SQL検索を組み合わせて結果を返す
 */
export class HybridRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers", "hybrid"];

  private pgroongaOnly: boolean;
  private efSearchValue?: number;
  private maxResults: number;
  private useMCP: boolean;
  private isDev: boolean;

  constructor(input: HybridRetrieverInput = {}) {
    super(input);
    this.pgroongaOnly = input.pgroongaOnly ?? false;
    this.efSearchValue = input.efSearchValue;
    this.maxResults = input.maxResults ?? 10;
    this.useMCP = input.useMCP ?? false;
    this.isDev = input.isDev ?? false;
  }

  /**
   * 検索クエリに基づいてドキュメントを取得
   */
  async _getRelevantDocuments(query: string): Promise<Document[]> {
    try {
      // 1. 既存の検索機能を使用
      const searchResults = await searchKnowledge(
        query,
        this.isDev,
        this.pgroongaOnly,
        undefined, // query_id
        this.efSearchValue
      );

      // 2. MCPを使用する場合は追加検索を実行
      let mcpResults: SearchResult[] = [];
      if (this.useMCP) {
        mcpResults = await this.searchWithMCP(query);
      }

      // 3. 結果を統合
      const allResults = [...searchResults, ...mcpResults];
      
      // 4. 重複除去とスコア順ソート
      const uniqueResults = this.deduplicateResults(allResults);
      
      // 5. 最大件数に制限
      const limitedResults = uniqueResults.slice(0, this.maxResults);

      // 6. LangChain Documentに変換
      return this.convertToDocuments(limitedResults);

    } catch (error) {
      console.error('HybridRetriever error:', error);
      return [];
    }
  }

  /**
   * MCPを使用した検索
   */
  private async searchWithMCP(query: string): Promise<SearchResult[]> {
    try {
      const mcpClient = getMCPClient();
      
      // MCPサーバーが起動していない場合は起動
      if (!mcpClient) {
        console.warn('MCP client not available');
        return [];
      }

      // 自然言語クエリからSQLを生成して実行
      // 例: "駐車場の料金について教えて" → SELECT * FROM "Knowledge" WHERE question LIKE '%料金%' OR answer LIKE '%料金%'
      const sqlQuery = this.generateSQLFromQuery(query);
      
      const mcpResponse = await mcpClient.executeSQL(sqlQuery);
      
      if (mcpResponse && Array.isArray(mcpResponse)) {
        return mcpResponse.map((row: any) => ({
          ...row,
          score: 0.8, // MCPからの結果には固定スコアを付与
          note: 'MCP検索結果'
        }));
      }

      return [];
    } catch (error) {
      console.error('MCP search error:', error);
      return [];
    }
  }

  /**
   * 自然言語クエリからSQLを生成（簡易版）
   * 将来的にはLLMを使用してより高度な変換を行う
   */
  private generateSQLFromQuery(query: string): string {
    // 簡易的なキーワード抽出とSQL生成
    const keywords = query.split(/\s+/).filter(word => word.length > 1);
    const conditions = keywords.map(keyword => 
      `(question ILIKE '%${keyword}%' OR answer ILIKE '%${keyword}%')`
    ).join(' OR ');

    return `
      SELECT id, main_category, sub_category, detail_category, question, answer, 
             is_template, usage, note, issue, "createdAt", "updatedAt"
      FROM "Knowledge" 
      WHERE ${conditions}
      ORDER BY "updatedAt" DESC 
      LIMIT ${this.maxResults}
    `;
  }

  /**
   * 検索結果の重複除去
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<number>();
    const unique: SearchResult[] = [];

    // スコア順にソート
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
        is_template: result.is_template,
        usage: result.usage,
        note: result.note,
        issue: result.issue,
        score: result.score,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        source: 'parking_knowledge_base'
      }
    }));
  }

  /**
   * ページコンテンツのフォーマット
   */
  private formatPageContent(result: SearchResult): string {
    const parts = [];
    
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
    
    if (result.usage) {
      parts.push(`使用方法: ${result.usage}`);
    }
    
    if (result.note) {
      parts.push(`備考: ${result.note}`);
    }

    return parts.join('\n\n');
  }
}

/**
 * デフォルトのハイブリッドリトリーバーインスタンス
 */
export const defaultRetriever = new HybridRetriever({
  pgroongaOnly: false,
  maxResults: 10,
  useMCP: false, // 初期はfalse、MCPの通信問題解決後にtrueに変更
  isDev: process.env.NODE_ENV === 'development'
}); 