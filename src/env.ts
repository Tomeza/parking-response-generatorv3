export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!;

// 必須環境変数のチェック
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// 本番環境でのローカルURLチェック
if (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(SUPABASE_URL)) {
  throw new Error(`Production build with local SUPABASE URL: ${SUPABASE_URL}`);
}

// baseUrl ユーティリティ
export function getBaseUrl() {
  return (
    SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

export function getAuthRedirectUrl() {
  return `${getBaseUrl()}/auth/callback`;
} 