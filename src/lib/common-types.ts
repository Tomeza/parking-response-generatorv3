/**
 * プロジェクト全体で共通して使用する型定義
 */

import { Knowledge } from '@prisma/client';

/**
 * 検索結果の共通型定義
 * Knowledge型を拡張して検索関連の属性を追加
 */
export type SearchResult = Knowledge & {
  score?: number;
  pgroonga_score?: number;
  sim_score?: number;
  question_sim?: number;
  answer_sim?: number;
  note?: string;
  is_template?: boolean;
  score_details?: {
    normQ: number;  // 正規化された質問文検索スコア
    normA: number;  // 正規化された回答文検索スコア
    normV: number;  // 正規化されたベクトル検索スコア
    weighted: number; // 重み付けされた最終スコア
  };
};

/**
 * 検出された日付情報の型定義
 */
export interface DateInfo {
  date: string;
  type: string;
}

/**
 * 処理ステップのアラートワード検出結果
 */
export interface AlertStepContent {
  detected: Record<string, string>;
  dates?: DateInfo[];
}

/**
 * ナレッジアイテムの型定義（簡略版）
 */
export interface KnowledgeItem {
  id: number;
  answer: string;
  question?: string;
  main_category?: string;
  sub_category?: string;
  score?: number;
}

/**
 * ナレッジ検索ステップの結果型定義
 */
export interface KnowledgeStepContent {
  used: KnowledgeItem[];
  missing?: string[];
  unused?: KnowledgeItem[];
}

/**
 * トレース情報ステップの型定義
 */
export interface TraceStepContent {
  success: boolean;
  suggestions?: string[];
  logs?: string[];
}

/**
 * テンプレート適用ステップの型定義
 */
export interface TemplateStepContent {
  template: string;
  variables?: Record<string, string>;
  source?: string;
}

/**
 * 処理ステップの種類
 */
export type StepType = 
  | 'アラートワード検出'
  | 'ナレッジ検索'
  | 'トレース・改善提案'
  | 'テンプレート適用';

/**
 * 処理ステップのコンテンツ型
 */
export type StepContent = 
  | AlertStepContent
  | KnowledgeStepContent
  | TraceStepContent
  | TemplateStepContent;

/**
 * 処理ステップの型定義
 */
export interface ProcessStep {
  step: StepType;
  content: StepContent;
}

/**
 * クエリ結果の型定義
 */
export interface QueryResult {
  text: string;
  steps: ProcessStep[];
} 