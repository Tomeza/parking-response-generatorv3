import { createSupabaseBrowserClient } from './supabase/browser';

// 統一されたSupabaseクライアント（環境変数チェックは関数内で実行）
export const createSupabaseClient = () => {
  // CI環境では環境変数がない場合はダミークライアントを返す
  if (process.env.CI && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    console.warn('CI環境: Supabase環境変数が未設定のためダミークライアントを使用');
    return createSupabaseBrowserClient();
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createSupabaseBrowserClient();
};

// 後方互換性のため残す（非推奨）- 遅延初期化
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient();
  }
  return supabaseInstance;
};

// 後方互換性のための非推奨プロパティ
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    return getSupabaseClient()[prop as keyof ReturnType<typeof createSupabaseClient>];
  }
}); 