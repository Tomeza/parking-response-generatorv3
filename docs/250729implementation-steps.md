---
slug: implementation-steps
title: 実装手順：高品質テキスト層からの段階的実装（2025年7月29日）
created: 2025-07-29
project: parking-response-generator
purpose: センス（ルーティング）と高品質テキスト層の統合実装手順
reason: 先生の指摘「センスが刺さる先に高品質テキスト層が必要」に基づく実装順序の定義
status: planning
tags: 
  - データベース設計
  - RLS
  - Edge Functions
  - フィーチャーフラグ
  - セキュリティ
implemented: false
priority: high
last_verified: 2025-07-29
---

# 実装手順：高品質テキスト層からの段階的実装

## 0) 実装順序の根拠

「センス（ルーティング）」が刺さる先に"高品質テキスト層"が必要なため、以下の順序で実装を進める：

1. 受け皿（templates・方針文）の整備
2. Edge Function実装
3. フィーチャーフラグによる結線

## ✅ Step 1：DB作成 & RLS（高品質テキスト層の用意）

### 1-1. スキーマ（`templates` と `selection_logs`）

```sql
-- templates: 返信テンプレの"高品質テキスト層"
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,              -- 'Billing','Complaint','Request' 等
  intent text,                         -- 'due_date','overcharge','payment_method' 等
  importance int not null default 3,   -- 1..5（業務判断で採点）
  frequency int not null default 0,    -- 使用回数（学習に利用）
  tone text,                           -- 'polite','casual','legal' など
  style text,
  language text not null default 'ja',
  variables jsonb,                     -- {company_name, due_date, ...}
  body text not null,                  -- 監査済み本文：LLMはここを改変しない前提
  version text default 'v1',
  approved boolean not null default true,
  embedding vector(512),               -- 任意（補助検索）
  updated_at timestamptz not null default now()
);

create index if not exists idx_templates_cat_intent on public.templates(category, intent);
create index if not exists idx_templates_rank on public.templates(importance desc, frequency desc);

-- selection_logs: ルーティング/選択の軽量ログ（PIIは入れない）
create table if not exists public.selection_logs (
  id uuid primary key default gen_random_uuid(),
  input_hash text not null,            -- メール本文のハッシュ
  router_output jsonb not null,        -- {category,intent,urgency,...}
  query_params jsonb not null,         -- 実際のクエリ（category/intent等）
  template_id uuid,                    -- 確定テンプレ
  candidates jsonb,                    -- 候補IDs（Top3など）
  latency_ms int,
  fallback_reason text,                -- 'no_intent','no_hit','vector_assist' 等
  created_at timestamptz not null default now()
);

create index if not exists idx_sel_logs_created on public.selection_logs(created_at desc);
```

### 1-2. RLS（最小権限・JWTロール前提）

```sql
alter table public.templates enable row level security;
alter table public.selection_logs enable row level security;

-- 読み取り: admin/editor のみ
create policy "read_templates_admin_editor"
on public.templates for select
to authenticated
using (
  exists(
    select 1
    from jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'roles') as r(role)
    where r.role in ('admin','editor')
  )
);

-- 書き込み: admin のみ
create policy "write_templates_admin"
on public.templates for all
to authenticated
using (
  exists(
    select 1
    from jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'roles') as r(role)
    where r.role = 'admin'
  )
)
with check (true);

-- selection_logs: insert は admin/editor、select は admin
create policy "insert_selection_logs_admin_editor"
on public.selection_logs for insert
to authenticated
with check (
  exists(
    select 1
    from jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'roles') as r(role)
    where r.role in ('admin','editor')
  )
);

create policy "read_selection_logs_admin"
on public.selection_logs for select
to authenticated
using (
  exists(
    select 1
    from jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'roles') as r(role)
    where r.role = 'admin'
  )
);
```

### 1-3. 最小シード（まず「直撃体験」を作る）

```sql
insert into public.templates
(category,intent,importance,frequency,tone,language,variables,body,approved)
values
('Billing','due_date',5,0,'polite','ja',
 '{"company_name":null,"due_date":null,"contact":null}',
 '平素よりお世話になっております。{company_name}様

お支払い期日につきましてご案内いたします。
期日は {due_date} でございます。ご不明点がございましたら {contact} までご連絡ください。

引き続きよろしくお願いいたします。', true);
```

## ✅ Step 2：Edge Function デプロイ

### 2-1. 関数作成とデプロイ

```bash
# 新規関数
supabase functions new get-templates

# 作成された functions/get-templates/index.ts を実装
```

### 2-2. 実装（JWTパススルーでRLS適用）

```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const auth = req.headers.get("Authorization"); // Bearer <JWT>
    if (!auth) return new Response("Unauthorized", { status: 401 });

    const { category, intent, language } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },  // ← JWTをそのままパススルー
    });

    let q = supabase.from("templates")
      .select("*")
      .eq("category", category)
      .eq("language", language ?? "ja");

    if (intent) q = q.eq("intent", intent);

    const { data, error } = await q
      .order("importance", { ascending: false })
      .order("frequency", { ascending: false })
      .limit(3);

    if (error) return new Response(error.message, { status: 400 });

    return new Response(JSON.stringify({ candidates: data ?? [] }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(`Internal Error: ${e}`, { status: 500 });
  }
});
```

### 2-3. デプロイとシークレット設定

```bash
supabase secrets set SUPABASE_URL="https://<project-ref>.supabase.co" \
  SUPABASE_ANON_KEY="<YOUR_ANON_KEY>"

supabase functions deploy get-templates --project-ref <project-ref>
```

## ✅ Step 3：アプリ側の配線（FFで安全に結線）

### 3-1. フィーチャーフラグ設定

```typescript
// src/config/flags.ts
export const USE_DB_TEMPLATES = process.env.USE_DB_TEMPLATES === 'true';
```

### 3-2. 環境変数設定

```env
# .env（ステージ）
USE_DB_TEMPLATES=false
FUNCTIONS_BASE_URL=https://<project-ref>.functions.supabase.co
```

### 3-3. 結線の最小イメージ

```typescript
// 1) ルーティング（既存）
const routerOutput = await route(emailText);

// 2) 変換
const q = mapRouterToQuery(routerOutput);

// 3) 取得（サーバ側でJWTを取得して渡す）
const { candidates } = await fetchTemplates(q, userAccessToken);

// 4) ヒット→テンプレ差し込み→LLMで文体統一（テンプレ本文は改変不可）
```

## 🔎 進め方の目安（2日で着地）

### Day 1（7/30）
- Step 1 完了（テーブル・RLS・最小シード）
- コミット/プッシュ

### Day 2（7/31）
1. Step 2（Edge Function実装）
2. Step 3（FFで結線）
3. ステージでFF=OFF/ON両方の動作確認
4. PR作成

## ✅ PRチェックリスト

- [ ] `USE_DB_TEMPLATES=false` で旧経路が動く（ロールバックOK）
- [ ] `USE_DB_TEMPLATES=true` で新経路が動く
- [ ] Edge Function経由でDB読取り（クライアント直叩きなしでもOK）
- [ ] RLS：`templates`読取りが`admin/editor`のJWTでのみ可
- [ ] 候補取得p95 < 1.5s（ステージ）
- [ ] ログ最小（router_output/query_params/candidates/template_id/latency_ms）
- [ ] 重要テンプレはLLMが本文改変しない（プロンプト規約で担保）

## 🧨 リスク管理

### セキュリティリスク
- **RLS漏れ**：
  - JWTパススルーのEdge経由
  - デフォルトDeny
  - E2E権限テスト

### 品質リスク
- **ベクトル誤ヒット**：
  - カテゴリ/intentの厳格フィルタ優先
  - ベクトル検索は補助的に使用

### 運用リスク
- **古いテンプレ固定**：
  - `importance`再採点
  - 将来的に`recency`をスコアに加点

### 障害対策
- **緊急時**：
  - FFをOFFに戻して即時退避
  - 旧経路での運用継続

## まとめ

この実装手順は、「センス」と「高品質テキスト層」を安全に統合するための具体的なステップを提供します。フィーチャーフラグを活用することで、リスクを最小限に抑えながら段階的な導入が可能です。 