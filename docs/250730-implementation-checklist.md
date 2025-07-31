---
title: Implementation Checklist - 実装チェックリストと補足情報
description: 設計思想の「芯」と「軸」を実装に反映するためのチェックリストと補足ガイドライン
author: AI Team
date: 2025-07-30
category: Implementation
tags:
  - checklist
  - guidelines
  - quality
  - operations
status: active
---

# 実装チェックリストと補足情報

## 1. データ設計チェックリスト

### 1.1 テーブル設計基準

#### テーブル共通設計
- [ ] ID体系の統一（UUIDまたはSERIAL）
  ```sql
  -- UUIDの場合
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
  -- SERIALの場合
  id SERIAL PRIMARY KEY
  ```
- [ ] 共通カラムの確認
  - [ ] `created_at TIMESTAMPTZ DEFAULT NOW()`
  - [ ] `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - [ ] `deleted_at TIMESTAMPTZ` (ソフトデリート用)
  - [ ] `metadata JSONB DEFAULT '{}'::jsonb`

#### テンプレート関連テーブル
- [ ] 命名規約の実装
  ```sql
  -- テンプレート名のフォーマット検証トリガー
  CREATE OR REPLACE FUNCTION validate_template_name()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.title !~ '^[A-Za-z]+:[A-Za-z_]+:[A-Za-z]+:ver\d+$' THEN
      RAISE EXCEPTION 'Invalid template name format. Expected: category:intent:tone:verX';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] ステータス管理
  ```sql
  ALTER TABLE templates ADD COLUMN status TEXT 
  CHECK (status IN ('draft', 'pending', 'approved', 'archived'))
  DEFAULT 'draft';
  ```

- [ ] 検索補助フィールド
  ```sql
  ALTER TABLE templates 
  ADD COLUMN tags TEXT[],
  ADD COLUMN keywords TEXT[],
  ADD COLUMN is_recommended BOOLEAN DEFAULT false;
  ```

### 1.2 embedding設計

```sql
-- 型可変対応のembedding
ALTER TABLE templates 
ADD COLUMN embedding_type TEXT DEFAULT 'openai',
ADD COLUMN embedding_version TEXT DEFAULT '1536',
ADD COLUMN embedding_data float[] -- 汎用的な配列型
```

### 1.3 variables設計

```typescript
// src/types/template.ts
interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'choice';
  required: boolean;
  choices?: string[]; // type === 'choice'の場合
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

interface Template {
  // ... 他のフィールド
  variables: TemplateVariable[];
}
```

## 2. UI/UX設計チェックリスト

### 2.1 管理画面

#### テンプレート比較ビュー
- [ ] バージョン間diff表示
  ```typescript
  interface TemplateDiff {
    oldVersion: number;
    newVersion: number;
    changes: {
      field: string;
      old: string;
      new: string;
      type: 'added' | 'removed' | 'modified';
    }[];
  }
  ```

#### 一括操作UI
- [ ] 複数テンプレートの同時操作
  - [ ] 承認
  - [ ] アーカイブ
  - [ ] タグ付け
  - [ ] カテゴリ変更

#### 例外フロー対応
- [ ] テンプレート不在時のフローチャート
  ```mermaid
  graph TD
    A[テンプレート不在] --> B{緊急度}
    B -->|高| C[管理者へエスカレーション]
    B -->|低| D[新規テンプレート作成フロー]
    D --> E[一時保存]
    E --> F[承認フロー]
  ```

## 3. 運用ルールチェックリスト

### 3.1 定期メンテナンス

#### 週次チェック
- [ ] ルーティング精度レポート
  - [ ] 直撃率 80%以上
  - [ ] 補正率 10%以下
  - [ ] P95レイテンシ 1000ms以下

#### 月次チェック
- [ ] テンプレート使用状況
  ```sql
  SELECT t.id, t.title, 
         COUNT(r.id) as usage_count,
         MAX(r.created_at) as last_used
  FROM templates t
  LEFT JOIN routing_logs r ON r.selected_template_id = t.id
  WHERE t.status = 'approved'
  GROUP BY t.id, t.title
  HAVING COUNT(r.id) = 0 
     OR MAX(r.created_at) < NOW() - INTERVAL '2 months'
  ```

### 3.2 品質管理トリガー

#### 自動レビュートリガー
- [ ] 2ヶ月未使用テンプレート
- [ ] 50%以上の補正率
- [ ] 3回連続のフィードバック

#### 手動レビュートリガー
- [ ] カテゴリ/意図の新規追加時
- [ ] テンプレート数が30%増加時
- [ ] 新規ユースケース追加時

## 4. 実装フェーズの完了基準

### Phase 1: データ構造（2週間）
- [ ] テーブル作成と制約の確認
  - 完了基準：「全テーブルが命名規約に従い、制約とトリガーが正常動作」

### Phase 2: API層（3週間）
- [ ] QueryAnalyzer実装
  - 完了基準：「代表的な3パターンで95%以上の精度」
- [ ] TemplateRouter実装
  - 完了基準：「直撃率80%以上（テストデータ）」

### Phase 3: UI/UX（2週間）
- [ ] 管理画面実装
  - 完了基準：「全CRUD操作が完了し、バリデーション正常動作」
- [ ] フィードバックUI実装
  - 完了基準：「フィードバックが正しくログされ、分析可能」

### Phase 4: 運用フロー（1週間）
- [ ] 承認フロー確認
  - 完了基準：「テスト承認者による5件の承認完了」
- [ ] モニタリング確認
  - 完了基準：「全指標がダッシュボードに表示され、アラート正常動作」

## 5. 初期10ケース検証

### 5.1 検証項目
1. 基本的なルーティング
   - [ ] カテゴリ完全一致
   - [ ] 意図完全一致
   - [ ] トーン完全一致

2. エッジケース
   - [ ] 類似カテゴリの区別
   - [ ] 複数の意図を含むケース
   - [ ] 緊急度の正確な判定

3. フォールバック
   - [ ] ベクトル検索への適切な移行
   - [ ] 類似テンプレートの提案
   - [ ] 手動介入の要否判定

### 5.2 検証プロセス
1. 設計レビュー（1日）
   - [ ] 各ケースの期待動作を文書化
   - [ ] エッジケースの処理方針を確認

2. 実装修正（2-3日）
   - [ ] レビュー指摘の反映
   - [ ] 単体テストの追加

3. 最終確認（1日）
   - [ ] 全10ケースの動作確認
   - [ ] パフォーマンス計測
   - [ ] ログ出力の確認

## 6. 定期的な設計思想の確認

### 6.1 週次レビュー時の確認事項
- [ ] センシング精度は維持されているか
- [ ] ルーティングの直撃率は目標値を満たしているか
- [ ] 品質層（テンプレート）は一貫性を保っているか
- [ ] 補正ループは正しく機能しているか

### 6.2 月次レビュー時の確認事項
- [ ] 設計思想からのズレは発生していないか
- [ ] 新規要件は設計思想に沿っているか
- [ ] 運用負荷は許容範囲内か
- [ ] 技術負債は蓄積していないか

## 7. ドキュメント管理

### 7.1 必須ドキュメント
- [ ] 命名規約ガイド
- [ ] テンプレート作成・編集ガイド
- [ ] レビュー・承認フローガイド
- [ ] 運用手順書
- [ ] トラブルシューティングガイド

### 7.2 更新ルール
- [ ] 四半期ごとの見直し
- [ ] 大きな仕様変更時の即時反映
- [ ] 運用課題からのフィードバック反映

このチェックリストは「芯」と「軸」を維持するための実践的なガイドラインです。
実装フェーズごとに参照し、必要に応じて更新してください。 