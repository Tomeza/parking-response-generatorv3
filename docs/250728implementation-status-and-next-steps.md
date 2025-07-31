---
slug: implementation-status-and-next-steps
title: 実装ステータスと次のステップ（2025年7月28日）
created: 2025-07-28
project: parking-response-generator
purpose: 現状の実装ステータスの確認と次のステップの計画
reason: LangChain・Supabase・テンプレート管理の統合に向けた実装計画の整理
status: in_progress
tags: 
  - LangChain
  - Supabase
  - テンプレート管理
  - ルーティング
implemented: false
priority: high
last_verified: 2025-07-28
---

# 実装ステータスと次のステップ（2025年7月28日）

## ✅ 現状の実装ステータス

| 領域                      | 状態               | 補足                                          |
| ----------------------- | ---------------- | ------------------------------------------- |
| LangChainの導入            | ✅ 実装済            | RouterChainなどで初期ルーティングを構築済                  |
| SupabaseテンプレートDB        | ⏳ 構造はあるがメタ情報設計未完 | `importance`, `category`, `style`等のカラム追加検討中 |
| LangChain → Supabase接続部 | ❌ 未実装            | Router出力→DBクエリ入力へのマッピング未構築                  |
| テンプレクエリの優先度制御           | ❌ 未実装            | 頻度・重要度ベースでの優先順位付き検索はこれから                    |
| フォールバック戦略（例：失敗時候補提示）    | ❌ 構想段階           | ルーティング失敗時のUX設計も今後                           |
| UI連携（候補提示 or 出力確認）      | ✅/⏳ 基本機能あり       | 最終応答表示はあるが、出力候補UIなどは今後必要                    |

## 🧭 実装ステップ：「センス × 記憶 × ルート」構造の実現

### 🔹 Step 1: Supabaseテンプレ構造の拡張

**目的**: 「記憶に重みを持たせる」の実現

#### 実装タスク
- カラム追加
  - `importance`: 重要度（数値）
  - `frequency`: 使用頻度
  - `tone`: 応答トーン
  - `style`: 応答スタイル
  - `category`: カテゴリ分類
  - `situation_tag`: 状況タグ
- テスト用テンプレートへのタグ付け
  - 代表的なケース数件を選定
  - メタ情報の付与と検証

### 🔹 Step 2: Router出力 → クエリパラメータ変換関数の実装

**目的**: 「センスから記憶へのルートを引く」の実現

#### 実装タスク
- `mapRouterToQuery` 関数の実装
  ```typescript
  interface SupabaseQueryParams {
    category?: string;
    importance?: number;
    style?: string;
    // ... その他必要なパラメータ
  }

  function mapRouterToQuery(routerOutput: RouterOutput): SupabaseQueryParams {
    // Router出力からクエリパラメータへの変換ロジック
  }
  ```
- 型安全性の確保
  - TypeScriptの型定義
  - 型補完のサポート

### 🔹 Step 3: Supabaseクエリ関数の実装

**目的**: 「重みのある記憶から、最も妥当な応答候補を引く」の実現

#### 実装タスク
- `fetchTemplates` 関数の実装
  ```typescript
  async function fetchTemplates(params: SupabaseQueryParams) {
    // 重要度と頻度でソートされたテンプレート取得
    // ORDER BY importance DESC, frequency DESC LIMIT 1
  }
  ```
- クエリ最適化
  - インデックス設計
  - パフォーマンス考慮

### 🔹 Step 4: LangChainチェーンへの統合

**目的**: 「センス→記憶→応答」の一貫処理の実現

#### 実装タスク
- テンプレート取得処理の組み込み
- フォールバック処理の実装
  - テンプレート未取得時のLLM生成
  - エラーハンドリング

## 💬 着手推奨順序

1. ✅ Supabaseテンプレ構造の設計・メタ情報追加
2. ✅ `fetchTemplates.ts` の実装
3. ✅ `mapRouterToQuery.ts` の作成
4. 🔁 LangChainチェーンへの統合

## 🎁 事前準備項目

### テンプレートデータの準備
- 10件程度のサンプルテンプレート
- 各テンプレートに以下のタグを付与
  - カテゴリ
  - 重要度
  - トーン
  - 状況タグ

### Supabase/Prismaスキーマの準備
- テーブル定義
- カラム定義
- インデックス設計

## 📝 注意点

- 各ステップでの動作確認を忘れずに
- 型安全性を常に意識
- パフォーマンスへの配慮
- エラーハンドリングの実装

「この構造を正確にできると、強いAGIが作れる」という指針に基づき、各ステップを慎重に実装していきます。 