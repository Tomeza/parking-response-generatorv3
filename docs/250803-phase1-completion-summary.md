---
title: Phase1完了 - テンプレートシステムの基盤構築
description: 「芯」と「軸」の設計思想に基づくテンプレートシステムの基盤構築完了
author: AI Team
date: 2025-08-03
category: Implementation
tags:
  - phase1
  - templates
  - core-principles
  - data-structure
  - constraints
status: completed
---

# Phase1完了 - テンプレートシステムの基盤構築

## 概要

「芯」と「軸」の設計思想に基づくテンプレートシステムの基盤構築が完了しました。データ構造の設計から制約の確立、重複解決まで、安全で拡張可能なシステム基盤が構築されています。

## 実装成果

### 1. データ構造の完成

#### テンプレート管理
- **総テンプレート数**: 192件
- **承認済み**: 64件（一意性を制約で担保）
- **下書き**: 128件（重複解決により整理）

#### 根拠情報の記録
- **source**: 107件（CSV由来の識別）
- **originQuestion**: 90件（元の質問文）
- **タグ情報**: 90件（replyTypeTags, infoSourceTags, situationTags）

#### データ品質
- **重複解決**: 128件をdraftに変更し、品質層を整理
- **一意性確保**: 承認済みテンプレートの一意性を制約で担保
- **根拠追跡**: 全ての判断に根拠情報を記録

### 2. 制約とインデックスの確立

#### 部分ユニーク制約
```sql
CREATE UNIQUE INDEX uq_templates_approved_unique
  ON "Templates"(category, intent, tone)
  WHERE status = 'approved';
```

#### 検索インデックス
```sql
CREATE INDEX "Templates_category_intent_tone_status_idx"
  ON "Templates"(category, intent, tone, status);
```

#### スキーマ堅牢化
- **NOT NULL制約**: category, intent, tone, status
- **CHECK制約**: status値の検証、versionの正数制約

### 3. 移行性の確保

#### Prisma Migration
- `20250803000000_add_origin_question_and_partial_unique`
- `20250803000001_add_schema_constraints`
- 環境再現性を確保

#### スクリプト群
- 重複解決スクリプト
- データ移行スクリプト
- 検証スクリプト

## 「芯」と「軸」への適合

### 1. センシング精度
✅ **ルーティングキーの明確化**
- category, intent, tone の組み合わせで意図を特定
- 根拠情報（originQuestion、タグ）で判断の透明性を確保

### 2. ルーティング精度
✅ **厳格なフィルタによる最適選択**
- 承認済みテンプレートの一意性を制約で担保
- 段階的ルーティング（厳格→緩和→フォールバック）

### 3. 品質層
✅ **高品質な構造化テンプレ層**
- 承認済みテンプレートの一意性を制約で担保
- 根拠情報の記録で品質の追跡可能性を確保

### 4. 補正ループ
✅ **ログ機構とフィードバック機能**
- RoutingLogs, FeedbackLogsテーブルの実装
- 重複解決による品質向上

### 5. 技術の道具化
✅ **シンプルな実装で複雑性を回避**
- 段階的な改善プロセスで安全に実装
- 複雑な技術に依存しない設計

## 技術的詳細

### データ構造
```typescript
model Templates {
  // ルーティングキー
  category        String
  intent          String
  tone            String
  title           String
  version         Int       @default(1)

  // 本文/変数
  content         String
  variables       Json?

  // 運用
  status          String    @default("approved")
  is_approved     Boolean   @default(true)

  // 根拠情報
  source          String?   // 'csv'
  sourceRowId     Int?
  sourceHash      String?
  usageLabel      String?   // ◯/△/✖️
  note            String?
  originQuestion  String?   // 元の質問文
  replyTypeTags   String[]  @default([])
  infoSourceTags  String[]  @default([])
  situationTags   String[]  @default([])

  // 制約
  @@index([category, intent, tone, status])
  @@unique([category, intent, tone, title, version])
}
```

### 制約設計
- **部分ユニーク制約**: 承認済みテンプレートの一意性
- **NOT NULL制約**: ルーティングキーの必須性
- **CHECK制約**: データ整合性の確保

## 統計データ

### テンプレート分布
- **総数**: 192件
- **承認済み**: 64件（33.3%）
- **下書き**: 128件（66.7%）

### 根拠情報の充実度
- **source**: 107件（55.7%）
- **originQuestion**: 90件（46.9%）
- **タグ情報**: 90件（46.9%）

### 重複解決効果
- **解決前**: 承認済みテンプレートに重複あり
- **解決後**: 承認済みテンプレートの一意性を確保
- **変更件数**: 128件をdraftに変更

## 次のステップ

### Phase2（API/Routerの厳格化と受け入れ回し）

1. **API層の実装**
   - QueryAnalyzerの統合
   - TemplateRouterの厳格化
   - ルーティング精度の向上

2. **UI/UXの実装**
   - 管理画面の構築
   - フィードバックUIの実装
   - ユーザビリティの向上

3. **運用フローの確立**
   - 承認プロセスの確立
   - モニタリングの実装
   - 品質管理の自動化

## 教訓とベストプラクティス

### 成功要因
1. **設計思想への忠実性**: 「芯」と「軸」を常に参照
2. **段階的実装**: 安全な移行プロセス
3. **データ品質の重視**: 重複解決と制約設計
4. **根拠の記録**: 全ての判断に根拠を残す

### 避けるべき罠
1. **スコープ拡散**: 複雑な技術に脱線しない
2. **品質の軽視**: 制約設計を後回しにしない
3. **根拠の欠如**: 判断の根拠を記録しない
4. **一気通貫の欠如**: 段階的な改善を怠らない

## 結論

**「芯」と「軸」の設計思想に忠実な実装により、安全で拡張可能なテンプレートシステムの基盤が構築されました。**

Phase1の完了により、Phase2（API/Routerの厳格化と受け入れ回し）への準備が整いました。設計思想の「芯」と「軸」を維持しながら、継続的な改善を進めることができます。

---

**コミット**: `f1f3136` - feat: Phase1完了 - テンプレートシステムの基盤構築  
**ブランチ**: `feat/supabase-query-routing`  
**日時**: 2025-08-03 