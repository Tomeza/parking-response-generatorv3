import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // メソッドチェック
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { 
        status: 405,
        headers: { ...corsHeaders }
      });
    }

    // 認証チェック
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing authorization header" 
        }),
        { 
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // リクエストボディ取得
    const { category, intent, language, tone } = await req.json();
    
    // 必須パラメータチェック
    if (!category) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Category is required" 
        }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // 環境変数取得とデバッグ
    const envVars = {
      DB_URL: Deno.env.get("DB_URL"),
      DB_ANON_KEY: Deno.env.get("DB_ANON_KEY"),
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY")
    };

    console.log("Environment variables:", {
      ...envVars,
      DB_ANON_KEY: envVars.DB_ANON_KEY ? "present" : "missing",
      SUPABASE_ANON_KEY: envVars.SUPABASE_ANON_KEY ? "present" : "missing"
    });

    if (!envVars.DB_URL || !envVars.DB_ANON_KEY) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server configuration error",
          details: "Missing database configuration",
          debug: {
            DB_URL: !!envVars.DB_URL,
            DB_ANON_KEY: !!envVars.DB_ANON_KEY
          }
        }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Supabaseクライアント初期化
    const supabase = createClient(envVars.DB_URL, envVars.DB_ANON_KEY);

    console.log("Querying templates with params:", { category, intent, language, tone });

    // クエリ構築
    let query = supabase.from("templates")
      .select("*")
      .eq("category", category)
      .eq("language", language ?? "ja");
    
    if (intent) query = query.eq("intent", intent);
    if (tone) query = query.eq("tone", tone);

    // 実行（重要度・頻度順）
    const { data, error } = await query
      .order("importance", { ascending: false })
      .order("frequency", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          details: error
        }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    console.log("Query successful, found templates:", data?.length ?? 0);

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
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        },
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
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});