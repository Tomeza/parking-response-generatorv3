import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// エラーレスポンスの型定義
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// 成功レスポンスの型定義
interface SuccessResponse {
  success: true;
  data: unknown[];
}

type APIResponse = ErrorResponse | SuccessResponse;

// バリデーション用の定数
const VALID_TONES = [
  'formal', 'casual', 'strict', 'polite', 
  'emergency', 'seasonal', 'informative'
];

// バリデーション関数
function validateQueryParams(params: URLSearchParams): { isValid: boolean; error?: ErrorResponse } {
  // カテゴリ/intent/toneの文字列長チェック
  const category = params.get("category");
  const intent = params.get("intent");
  const tone = params.get("tone");

  if (category && category.length > 50) {
    return {
      isValid: false,
      error: {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "Category name is too long (max 50 characters)",
          details: { param: "category", value: category }
        }
      }
    };
  }

  if (intent && intent.length > 50) {
    return {
      isValid: false,
      error: {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "Intent name is too long (max 50 characters)",
          details: { param: "intent", value: intent }
        }
      }
    };
  }

  if (tone) {
    if (tone.length > 20) {
      return {
        isValid: false,
        error: {
          success: false,
          error: {
            code: "INVALID_PARAMETER",
            message: "Tone name is too long (max 20 characters)",
            details: { param: "tone", value: tone }
          }
        }
      };
    }

    if (!VALID_TONES.includes(tone)) {
      return {
        isValid: false,
        error: {
          success: false,
          error: {
            code: "INVALID_TONE",
            message: "Invalid tone specified",
            details: {
              param: "tone",
              value: tone,
              validTones: VALID_TONES
            }
          }
        }
      };
    }
  }

  return { isValid: true };
}

serve(async (req) => {
  // CORS対応
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 認証チェック
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw {
        code: "UNAUTHORIZED",
        message: "Missing authorization header"
      };
    }

    // クエリパラメータの取得とバリデーション
    const url = new URL(req.url);
    const validation = validateQueryParams(url.searchParams);
    if (!validation.isValid && validation.error) {
      return new Response(
        JSON.stringify(validation.error),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      );
    }

    const category = url.searchParams.get("category");
    const intent = url.searchParams.get("intent");
    const tone = url.searchParams.get("tone");

    // Supabaseクライアントの初期化
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // クエリの構築
    let query = supabaseClient
      .from("templates")
      .select("*")
      .eq("status", "approved");

    if (category) query = query.eq("category", category);
    if (intent) query = query.eq("intent", intent);
    if (tone) query = query.eq("tone", tone);

    // データの取得
    const { data, error } = await query;

    // エラーハンドリング
    if (error) {
      console.error("Database error:", error);
      throw {
        code: "DATABASE_ERROR",
        message: "Failed to fetch templates",
        details: error
      };
    }

    // 成功レスポンス
    return new Response(
      JSON.stringify({ success: true, data: data || [] }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    // エラーレスポンス
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "An unexpected error occurred",
        details: error.details
      }
    };

    return new Response(
      JSON.stringify(errorResponse),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error.code === "UNAUTHORIZED" ? 401 : 500,
      }
    );
  }
});