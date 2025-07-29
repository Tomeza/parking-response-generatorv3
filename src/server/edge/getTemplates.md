# Get Templates Edge Function

## 概要

テンプレート取得のEdge Function実装メモ。

## 実装方針

1. JWTパススルーでRLSを適用
2. 厳格フィルタ優先（category/intent）
3. 重要度と使用頻度でソート
4. 最大3件を返却

## コード例

```typescript
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

## デプロイ手順

1. Supabase Functionsディレクトリを作成
   ```bash
   mkdir -p supabase/functions/get-templates
   ```

2. 実装ファイルを配置
   ```bash
   cp index.ts supabase/functions/get-templates/
   ```

3. デプロイ
   ```bash
   supabase functions deploy get-templates
   ```

4. シークレットを設定
   ```bash
   supabase secrets set SUPABASE_URL=xxx SUPABASE_ANON_KEY=xxx
   ```

## テスト

```bash
curl -X POST https://xxx.functions.supabase.co/get-templates \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"category":"Billing","intent":"due_date","language":"ja"}'
``` 