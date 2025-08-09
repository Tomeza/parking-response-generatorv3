// 遅延初期化のための環境変数getter
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  // CI環境では空文字列を返す（ダミー用）
  if (process.env.CI && !url) {
    console.warn('CI環境: NEXT_PUBLIC_SUPABASE_URLが未設定');
    return 'https://dummy.supabase.co';
  }
  
  if (!url) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  // 本番環境でのローカルURLチェック
  if (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`Production build with local SUPABASE URL: ${url}`);
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // CI環境では空文字列を返す（ダミー用）
  if (process.env.CI && !key) {
    console.warn('CI環境: NEXT_PUBLIC_SUPABASE_ANON_KEYが未設定');
    return 'dummy-anon-key';
  }
  
  if (!key) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return key;
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || getBaseUrl();
}

// 後方互換性のための非推奨エクスポート
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

// baseUrl ユーティリティ
export function getBaseUrl() {
  return (
    getSiteUrl() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

export function getAuthRedirectUrl() {
  return `${getBaseUrl()}/auth/callback`;
} 