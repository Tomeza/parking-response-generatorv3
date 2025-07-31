---
slug: implementation-guide
title: 実装ガイド：センス×記憶×ルート構造の実現（2025年7月29日）
created: 2025-07-29
project: parking-response-generator
purpose: メール返信システムの実装ガイドライン
reason: センス（ルーティング）と記憶（テンプレート）を統合した応答生成システムの実装
status: planning
tags: 
  - LangChain
  - Supabase
  - テンプレート管理
  - ルーティング
  - セキュリティ
implemented: false
priority: high
last_verified: 2025-07-29
---

# 実装ガイド：センス×記憶×ルート構造の実現

## 0) コンテキストと前提

### 目的
メール返信アプリで「入力の意図に応じて最短で"重要な記憶（テンプレ・FAQ・過去例）"へ到達し、適切な文面を生成する」流れを完成させる。

### 現状
- LangChainの**ルーティング層（センス）**はある程度実装済み
- **Supabaseクエリ（重要記憶の取り出し）**は未接続

### 先生の示唆
- 「**センス（初期ルート決め）** × **重みづけされた記憶（長さ・重要度・浅さ）** × **即応（パンと出る）」**が鍵
- まず"ルート→記憶"の橋渡し精度が勝負

### 方針
**小さく結線 → ログで見える化 → 誤差の補正ループ**。部分最適ではなく"統合された動き"を重視。

## 1) 実装ロードマップ

### Day 1（7/30）— 記憶の構造化

> 先生の話の適用：「**記憶の長さ・重要度・浅さ**で重みづけ」

#### Supabase: `templates` テーブル拡張

```sql
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  intent text,
  importance int not null default 3,  -- 1(low)〜5(high)
  frequency int not null default 0,
  tone text,
  style text,
  language text not null default 'ja',
  variables jsonb,        -- {company_name, due_date, ...}
  body text not null,
  embedding vector(512),  -- 任意: 使う場合
  updated_at timestamptz not null default now()
);

create index on templates(category, intent);
create index on templates(importance desc, frequency desc);
```

#### RLS設定

```sql
alter table templates enable row level security;

-- 読み取り: admin/editor のみ
create policy "read_templates"
on templates for select
to authenticated
using (
  exists(
    select 1
    from jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'roles') as r(role)
    where r.role in ('admin','editor')
  )
);

-- 書き込み: admin のみ
create policy "write_templates"
on templates for all
to authenticated
using (
  exists(
    select 1
    from jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'roles') as r(role)
    where r.role = 'admin'
  )
)
with check (true);
```

### Day 2 — ルート→クエリの"橋渡し"

> 先生の話の適用：**「ルートを決めるパラメータ（センス）」→「重要記憶へ直行」**

#### Adapter層の実装

```typescript
// Router 出力例
type RouterOutput = {
  category: 'Billing' | 'Complaint' | 'Request';
  intent: 'due_date' | 'overcharge' | 'payment_method' | 'other';
  urgency: 'high' | 'low';
  language?: 'ja' | 'en';
};

// Supabase クエリ入力
type TemplateQuery = {
  category: string;
  intent?: string;
  language?: string;
};

export function mapRouterToQuery(r: RouterOutput): TemplateQuery {
  return {
    category: r.category,
    intent: r.intent !== 'other' ? r.intent : undefined,
    language: r.language ?? 'ja',
  };
}
```

#### fetchTemplates.ts の実装方針
- `ORDER BY importance DESC, frequency DESC` を既定
- intent 未指定時は `category` のみで上位取得
- 必要なら部分ベクトル検索で補完

#### ログ設計
- ルーティング出力
- 発行SQL
- 取得テンプレID
- レイテンシ

### Day 3 — 統合チェーン＆フォールバック

> 先生の話の適用：「**長期で重要**でも**素早くディテール**」＋「**センスは絶対でない**（補正可能）」

#### チェーン構成

```
[User Email] 
  → RouterChain(カテゴリ/意図/緊急度)
  → mapRouterToQuery()
  → fetchTemplates()
    ├ ヒット: テンプレ注入でLLM整形（差し込み変数を充填）
    └ 未ヒット: 類似テンプレTop3 + LLM生成にフォールバック
```

#### UI/UX設計
- 誤ルート時の**候補3つ提示**（人間の"補正"を早く）
- 選択結果を frequency に+1（使用頻度学習）

### Day 4–5 — 計測・補正ループ

> 先生の話の適用：「**センスは重み付け前の直感**。誤差を見越して戻せる設計が知性」

#### メトリクス設計
- ルーティング一致率（人手修正率の逆数）
- テンプレ・ヒット率／フォールバック比率
- fetchTemplates レイテンシ p50/p95
- 返信編集量（差分トークン）

#### 改善サイクル
- 意図粒度の再設計
- テンプレ群のタグクラスタリング

## 2) 成果物の定義

### 機能要件
- 入力→ルート→テンプレ選択（重み順）→LLM整形→UIで候補提示／確定

### 品質要件
- 「頻出×重要」案件は**1発で適切な雛形が出る**（≒"パンと出る"）

### 運用要件
- 誤ルート時はUIで**即補正**
- ログからルーティングとテンプレを**定期微調整**

## 3) リスク評価と回避策

### A. 実装リスク

#### 1. ルーティング過学習／意図粒度のミスマッチ
- *症状*：テンプレ選択がブレる／無関係テンプレ出る
- *回避*：
  - Router プロンプトに**典型例と反例**を明示
  - `intent` を**業務語彙で固定語彙化**
  - **Shadow Logging**による評価

#### 2. テンプレのスコアリング偏り
- *症状*：古いが頻繁に使われたテンプレが上位固定
- *回避*：
  - `recency_weight` の導入
  - **編集時に importance 再評点**

#### 3. ベクトル検索のノイズヒット
- *症状*：似て非なるテンプレが上がる
- *回避*：
  - **厳格フィルタ優先**
  - UIでの人間選択とフィードバック

#### 4. LLMのテンプレ逸脱
- *症状*：法務文言などが変わる
- *回避*：
  - 厳格なシステムプロンプト
  - 差分ログの監査
  - 署名ブロックの固定

### B. 運用リスク

#### 1. 誤ルート時のUX悪化
- *回避*：
  - 候補3件提示
  - カテゴリ再選択UI
  - フィードバックループ

#### 2. ログ未整備
- *回避*：
  - `classification_logs`
  - `selection_logs`
  - 主要メトリクスの定期レポート

#### 3. テンプレのスパゲティ化
- *回避*：
  - 命名規約の整備
  - 非推奨フラグの導入
  - 定期的な棚卸し

### C. セキュリティリスク

#### 1. Anon Key露出
- *回避*：
  - Edge Function経由のアクセス
  - 役割ベースのRLS
  - 環境変数の厳格管理

#### 2. RLS誤設定
- *回避*：
  - デフォルトDeny方式
  - `app_metadata.roles`の強制
  - E2Eテストの実施

#### 3. PII混入
- *回避*：
  - テンプレの変数化
  - チェックリストの運用
  - 定期的な監査

## 4) 進め方

### ブランチ戦略
- **実装速度優先**：現行ブランチで疎結合実装
- **安全重視**：`feat/supabase-query-routing`での実装

### 共通ガードレール
- Feature Flag（`USE_DB_TEMPLATES`）の導入
- ロールバックパスの確保

## 5) 成功の定義

### 短期目標
- **頻出×重要ケース**で**1クリック確定**の実現

### 中期目標
- **人間の補正をログで学習**
- **週次での intent とテンプレの整理**

### 長期目標
- **センス（ルータ）×記憶（テンプレ）×補正（UI/ログ）**の三位一体の確立

## 6) 次のステップ

明日の開始時に以下を決定：
1. スキーマからの着手
2. Adapter/Queryからの着手

各アプローチのメリット・デメリットを検討の上、決定する。 