---
slug: implementation-plan
title: 実装着手計画：機能ブランチ＋フィーチャーフラグ方式（2025年7月29日）
created: 2025-07-29
project: parking-response-generator
purpose: センス（ルーティング）と重要記憶（高品質テキスト層）の統合実装計画
reason: 2日間での最小実装と安全な導入のための具体的手順の提示
status: planning
tags: 
  - フィーチャーフラグ
  - Edge Functions
  - RLS
  - データベース設計
  - セキュリティ
implemented: false
priority: high
last_verified: 2025-07-29
---

# 実装着手計画：機能ブランチ＋フィーチャーフラグ方式

## 0) 前提と狙い

### 目的
- **センス（ルーティング）→ 重要記憶（高品質テキスト層）→ "パンと出る"候補**の最短経路を作る

### アプローチ
- **短命機能ブランチ**で差分を小さく
- **フィーチャーフラグ（FF）で即ロールバック**可能に

### セキュリティ方針
- **Edge Function経由**で読み出し（クライアント直叩き禁止）
- **RLSは最小権限**で厳格に

## 1) ブランチ作成

```bash
git checkout -b feat/supabase-query-routing

# 以降で作るファイルの空雛形だけ先に置いてコミット
mkdir -p src/queries src/utils src/server/edge
touch src/utils/mapRouterToQuery.ts \
      src/queries/fetchTemplates.ts \
      src/server/edge/getTemplates.md   # ← Edge関数の実装メモ用（後で移す）
git add .
git commit -m "chore: scaffold files for Supabase query routing behind FF"
git push -u origin feat/supabase-query-routing
```

## 2) Day 1（7/30）：DB＋RLS実装

### 2.1 `templates` テーブル（高品質テキスト層）

```sql
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,        -- e.g., 'Billing','Complaint','Request'
  intent text,                   -- e.g., 'due_date','overcharge','payment_method'
  importance int not null default 3,  -- 1..5
  frequency int not null default 0,   -- 使用回数（学習）
  tone text,                    -- 'polite','casual','legal'
  style text,                   -- 任意の表現スタイル
  language text not null default 'ja',
  variables jsonb,              -- {company_name, due_date, ...}
  body text not null,           -- テンプレ本文（監査済）
  version text default 'v1',
  approved boolean not null default true, -- レビュー通過
  embedding vector(512),        -- 任意：補助検索
  updated_at timestamptz not null default now()
);

create index if not exists idx_templates_cat_intent on public.templates(category, intent);
create index if not exists idx_templates_rank on public.templates(importance desc, frequency desc);
```

### 2.2 軽量ログテーブル

```sql
create table if not exists public.selection_logs (
  id uuid primary key default gen_random_uuid(),
  input_hash text not null,         -- メール本文のハッシュ
  router_output jsonb not null,     -- {category,intent,urgency,...}
  query_params jsonb not null,      -- 実際に投げたパラメータ
  template_id uuid,                 -- 採択テンプレ
  candidates jsonb,                 -- 候補IDs（Top3など）
  latency_ms int,
  fallback_reason text,             -- 'no_intent','no_hit','vector_assist'等
  created_at timestamptz not null default now()
);
create index if not exists idx_sel_logs_created on public.selection_logs(created_at desc);
```

### 2.3 RLS設定

```sql
alter table public.templates enable row level security;
alter table public.selection_logs enable row level security;

-- templates読み取り：admin/editor
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

-- templates書き込み：adminのみ
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

-- selection_logs書き込み：admin/editor
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

-- selection_logs読み取り：adminのみ
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

## 3) Day 2：Adapter＋Edge Function＋FF実装

### 3.1 フィーチャーフラグ設定

```typescript
// src/config/flags.ts
export const USE_DB_TEMPLATES = process.env.USE_DB_TEMPLATES === 'true';
```

### 3.2 Router→Query変換（Adapter）

```typescript
// src/utils/mapRouterToQuery.ts
export type RouterOutput = {
  category: 'Billing'|'Complaint'|'Request';
  intent: 'due_date'|'overcharge'|'payment_method'|'other';
  urgency?: 'high'|'low';
  language?: 'ja'|'en';
};

export type TemplateQuery = {
  category: string;
  intent?: string;
  language: string;
};

export const mapRouterToQuery = (r: RouterOutput): TemplateQuery => ({
  category: r.category,
  intent: r.intent === 'other' ? undefined : r.intent,
  language: r.language ?? 'ja',
});
```

### 3.3 Edge Function実装

```typescript
// functions/get-templates/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("Unauthorized", { status: 401 });

    const { category, intent, language } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
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

    return new Response(JSON.stringify({ candidates: data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(`Internal Error: ${e}`, { status: 500 });
  }
});
```

### 3.4 テンプレート取得関数

```typescript
// src/queries/fetchTemplates.ts
import { USE_DB_TEMPLATES } from "@/src/config/flags";

export type TemplateQuery = { category: string; intent?: string; language: string };

export async function fetchTemplates(q: TemplateQuery, accessToken: string) {
  if (!USE_DB_TEMPLATES) return null;

  const res = await fetch(process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL + "/get-templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(q),
  });

  if (!res.ok) throw new Error(`get-templates failed: ${await res.text()}`);
  return (await res.json()) as { candidates: any[] };
}
```

## 4) LangChain統合イメージ

```typescript
// 1) ルーティング（既存）
const routerOutput = await route(emailText); // {category,intent,language,...}

// 2) 変換
const q = mapRouterToQuery(routerOutput);

// 3) Edge Function（RLS適用）で候補取得
const { candidates } = await fetchTemplates(q, userAccessToken);

// 4) 候補があればテンプレ差し込み→LLM整形（逸脱禁止）
let drafts = candidates.map(t => fillVariables(t.body, vars));
drafts = await normalizeToneWithLLM(drafts, { enforceTemplate: true });

// 5) UIでTop3提示→ユーザーが1つ確定→ frequency +1
```

## 5) PRチェックリスト

- [ ] `USE_DB_TEMPLATES=false` で従来どおり動作
- [ ] `USE_DB_TEMPLATES=true` で新経路が有効（即OFFでロールバック可）
- [ ] Edge Function経由で DB 読取（**クライアントから直叩きなし**）
- [ ] RLS：`templates` 読取は `admin/editor` のみ（ステージで E2E 確認）
- [ ] ルータ出力→クエリ変換の型が明示されている
- [ ] 候補取得の p95 < **1.5s**（ステージ）
- [ ] 重要テンプレは **LLMが本文を改変しない**（プロンプトで固定）
- [ ] 軽量ログ：`router_output` / `query_params` / `candidates` / `template_id` / `latency_ms`
- [ ] 例外時は**フォールバック理由**を記録

## 6) リスク管理

### 破壊的変更への対応
- FFで**丸ごとOFF**可
- 差分は機能ブランチ内に閉じる

### セキュリティリスク対策
- Edge FunctionでJWTパススルー（RLS適用）
- サービスロール使用時は**厳格ロール検証**

### 品質リスク対策
- **厳格フィルタ→ベクトル補助**の順に固定
- Top3をUI選択→frequency学習
- `importance`の運用見直し
- `recency`係数の合成スコア導入予定

### デバッグ対策
- 最初から**軽量ログ**（成功/失敗とも）を実装

## 7) 実装手順

1. **DBの作成＆RLS**
2. **Edge Functionデプロイ**
3. **FF=OFFのまま動作確認**
4. **FF=ONで経路切替**

## まとめ

この実装計画は、センス（ルーティング）と重要記憶（高品質テキスト層）を安全に統合するための具体的な手順を提供します。フィーチャーフラグとEdge Functionsを活用することで、リスクを最小限に抑えながら段階的な導入が可能です。 