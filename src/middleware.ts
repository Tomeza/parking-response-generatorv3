import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 保護されたルートの設定
  const isAuthRoute = request.nextUrl.pathname.startsWith('/templates');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/templates');

  // 認証が必要なルートでセッションがない場合
  if ((isAuthRoute || isApiRoute) && !session) {
    // APIルートの場合は401エラーを返す
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // ページルートの場合はログインページにリダイレクト
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/templates/:path*',
    '/api/templates/:path*',
  ],
}; 