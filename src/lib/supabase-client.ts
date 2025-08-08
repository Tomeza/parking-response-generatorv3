import { createSupabaseBrowserClient } from './supabase/browser';

// 統一されたSupabaseクライアント（環境変数チェックは関数内で実行）
export const createSupabaseClient = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createSupabaseBrowserClient();
};

// 後方互換性のため残す（非推奨）
export const supabase = createSupabaseClient(); 