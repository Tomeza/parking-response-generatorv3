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
}; 