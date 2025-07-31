---
title: Template System Deployment and Testing
description: テンプレートシステムのデプロイと動作確認手順
author: AI Team
date: 2025-07-30
category: Deployment
tags:
  - deployment
  - testing
  - edge-function
status: draft
---

# テンプレートシステムのデプロイと動作確認

## 1. マイグレーションの実行

```bash
# マイグレーションの実行
supabase migration up

# （もしくはStudioのSQL Editorで直接実行）
# supabase/migrations/20250730000000_create_templates.sql の内容を実行
```

## 2. Edge Functionのデプロイ

```bash
# Edge Functionのデプロイ
supabase functions deploy get-templates

# シークレットの設定
supabase secrets set SUPABASE_URL=your-project-url
supabase secrets set SUPABASE_ANON_KEY=your-anon-key
```

## 3. 動作確認

### 3.1 全テンプレートの取得

```bash
curl -X GET 'https://your-project-ref.supabase.co/functions/v1/get-templates' \
  -H "Authorization: Bearer your-anon-key"
```

### 3.2 カテゴリ指定での取得

```bash
curl -X GET 'https://your-project-ref.supabase.co/functions/v1/get-templates?category=Billing' \
  -H "Authorization: Bearer your-anon-key"
```

### 3.3 カテゴリ・意図・トーンの組み合わせ

```bash
curl -X GET 'https://your-project-ref.supabase.co/functions/v1/get-templates?category=Billing&intent=due_date&tone=polite' \
  -H "Authorization: Bearer your-anon-key"
```

## 4. 確認項目

### 4.1 基本機能
- [ ] テーブルが正しく作成されている
- [ ] 初期データ（10件）が正しく投入されている
- [ ] RLSポリシーが正しく機能している
- [ ] Edge Functionが正しくデプロイされている

### 4.2 API動作
- [ ] 認証なしでアクセスした場合は401エラー
- [ ] 認証ありで全件取得が成功
- [ ] カテゴリでの絞り込みが機能
- [ ] 意図での絞り込みが機能
- [ ] トーンでの絞り込みが機能
- [ ] 複数条件での絞り込みが機能

### 4.3 データ整合性
- [ ] 返却されるJSONの構造が正しい
- [ ] variablesの形式が正しい
- [ ] ステータスが正しく設定されている

## 5. 次のステップ

確認が完了したら、以下を実装：

1. テンプレート管理UI
2. ルーティングロジック
3. フィードバックの収集機構
4. 使用統計の記録

## 6. トラブルシューティング

### 6.1 マイグレーションエラー
- テーブルが既に存在する場合は `DROP TABLE IF EXISTS templates CASCADE;` を先頭に追加
- RLSポリシーが既に存在する場合は `DROP POLICY IF EXISTS "select_templates_authenticated" ON templates;` を追加

### 6.2 Edge Function エラー
- 環境変数が正しく設定されているか確認
- Authorization headerが正しく設定されているか確認
- CORSヘッダーが正しく設定されているか確認 