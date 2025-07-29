---
slug: template-retrieval-implementation
title: テンプレート検索システムの実装詳細（2025年7月29日）
created: 2025-07-29
project: parking-response-generator
purpose: センス（ルーティング）と重要記憶（高品質テキスト層）の統合実装の詳細仕様
reason: 高品質テキストレイヤーとしてのテンプレート検索システムの実装と検証
status: implemented
tags: 
  - Edge Functions
  - RLS
  - データベース設計
  - セキュリティ
  - テンプレート検索
  - 高品質テキスト層
implemented: true
priority: high
last_verified: 2025-07-29
related_docs:
  - 250729implementation-plan.md
---

# テンプレート検索システムの実装詳細

## 1. 概要

高品質なテキストレイヤーとしてのテンプレート検索システムを実装。
カテゴリ、トーン、言語による厳格なフィルタリングと、RLSによるセキュリティを確保。

## 2. データベース構造

### templates テーブル
```sql
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,              -- 'Billing','Complaint','Request' 等
  intent text,                         -- 'due_date','overcharge' 等
  importance int not null default 3,   -- 1..5（業務判断で採点）
  frequency int not null default 0,    -- 使用回数（学習用）
  tone text,                           -- 'polite','casual','legal'など
  style text,
  language text not null default 'ja',
  variables jsonb,                     -- {company_name, due_date, ...}
  body text not null,                  -- 監査済み本文
  version text default 'v1',
  approved boolean not null default true,
  embedding vector(512),               -- 補助検索用（オプション）
  updated_at timestamptz not null default now()
);

-- インデックス
create index if not exists idx_templates_cat_intent on public.templates(category, intent);
create index if not exists idx_templates_rank on public.templates(importance desc, frequency desc);
```

### selection_logs テーブル
```sql
create table if not exists public.selection_logs (
  id uuid primary key default gen_random_uuid(),
  input_hash text not null,            -- メール本文のハッシュ
  router_output jsonb not null,        -- {category,intent,urgency,...}
  query_params jsonb not null,         -- 実際のクエリパラメータ
  template_id uuid,                    -- 確定テンプレート
  candidates jsonb,                    -- 候補IDs（Top3など）
  latency_ms int,
  fallback_reason text,                -- 'no_intent','no_hit','vector_assist' 等
  created_at timestamptz not null default now()
);

create index if not exists idx_sel_logs_created on public.selection_logs(created_at desc);
```

## 3. セキュリティ設定

### RLSポリシー
```sql
-- スキーマ権限
grant usage on schema public to authenticated;
grant usage on schema public to anon;

-- テーブル権限
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to anon;

-- RLSポリシー
create policy "read_templates_admin_editor"
on public.templates for select
to authenticated
using (
  exists(
    select 1
    from jsonb_array_elements_text(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' -> 'roles') as r(role)
    where r.role in ('admin', 'editor')
  )
);

create policy "write_templates_admin"
on public.templates for all
to authenticated
using (
  exists(
    select 1
    from jsonb_array_elements_text(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' -> 'roles') as r(role)
    where r.role = 'admin'
  )
)
with check (true);
```

## 4. Edge Function実装

`supabase/functions/get-templates/index.ts`:
```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 環境変数
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  try {
    // メソッドチェック
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // 認証チェック
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response("Unauthorized", { status: 401 });
    }

    // パラメータ取得
    const { category, intent, language, tone } = await req.json();

    // Supabaseクライアント初期化
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    // クエリ構築
    let query = supabase.from("templates").select("*");
    
    if (category) query = query.eq("category", category);
    if (intent) query = query.eq("intent", intent);
    if (language) query = query.eq("language", language);
    if (tone) query = query.eq("tone", tone);

    // 実行（重要度・頻度順）
    const { data, error } = await query
      .order("importance", { ascending: false })
      .order("frequency", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Query error:", error);
      return new Response(error.message, { status: 400 });
    }

    // レスポンス
    return new Response(
      JSON.stringify({ 
        success: true, 
        templates: data ?? [],
        meta: {
          count: data?.length ?? 0,
          filters: { category, intent, language, tone }
        }
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (e) {
    console.error("Server error:", e);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Internal Server Error",
        details: e.message 
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});
```

## 5. テスト結果

### 1. 正常系（日本語・カジュアル）
**リクエスト**:
```json
{
  "category": "Billing",
  "tone": "casual",
  "language": "ja"
}
```
**レスポンス**:
```json
{
  "success": true,
  "templates": [{
    "id": "85c54d1c-2593-450b-9493-7c596b732df3",
    "category": "Billing",
    "intent": "cancellation",
    "importance": 3,
    "frequency": 0,
    "tone": "casual",
    "language": "ja",
    "variables": {
      "cancel_date": null,
      "customer_name": null
    },
    "body": "{customer_name}様\n\nキャンセルのご連絡ありがとうございます。\n{cancel_date}のご予約のキャンセル承りました。\n\nまたのご利用をお待ちしております！"
  }],
  "meta": {
    "count": 1,
    "filters": {
      "category": "Billing",
      "language": "ja",
      "tone": "casual"
    }
  }
}
```

### 2. 正常系（英語・丁寧）
**リクエスト**:
```json
{
  "category": "Request",
  "tone": "polite",
  "language": "en"
}
```
**レスポンス**:
```json
{
  "success": true,
  "templates": [{
    "id": "d19c1c83-baa2-4ebf-b27a-6ea962f3f714",
    "category": "Request",
    "intent": "change_address",
    "importance": 4,
    "frequency": 0,
    "tone": "polite",
    "language": "en",
    "variables": {
      "new_address": null,
      "customer_name": null,
      "effective_date": null
    },
    "body": "Dear {customer_name},\n\nThank you for notifying us of your address change..."
  }],
  "meta": {
    "count": 1,
    "filters": {
      "category": "Request",
      "language": "en",
      "tone": "polite"
    }
  }
}
```

### 3. 存在しない条件
**リクエスト**:
```json
{
  "category": "NonExistent",
  "tone": "formal",
  "language": "fr"
}
```
**レスポンス**:
```json
{
  "success": true,
  "templates": [],
  "meta": {
    "count": 0,
    "filters": {
      "category": "NonExistent",
      "language": "fr",
      "tone": "formal"
    }
  }
}
```

### 4. 認証なし
**リクエスト**: Authorization headerなし
**レスポンス**:
```json
{
  "code": 401,
  "message": "Missing authorization header"
}
```

## 6. 性能と制限

- テンプレート取得の制限: 最大3件
- 重要度（importance）による優先順位付け
- 使用頻度（frequency）による学習
- RLSによるロールベースのアクセス制御
- スキーマ権限による保護

## 7. 今後の展開

1. selection_logsの実装によるユーザー行動の分析
2. パフォーマンス計測とチューニング
3. ベクトル検索の補助的な活用
4. テンプレートの自動評価システムの構築
