export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const per_page = parseInt(searchParams.get('per_page') || '10');

    // バリデーション
    if (isNaN(page) || page < 1 || isNaN(per_page) || per_page < 1 || per_page > 100) {
      return NextResponse.json(
        { error: 'ページネーションパラメータが不正です' },
        { status: 400 }
      );
    }

    // オフセットの計算
    const offset = (page - 1) * per_page;

    // 履歴の取得
    const { data: history, error, count } = await supabase
      .from('template_approval_history')
      .select('*', { count: 'exact' })
      .eq('template_id', params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + per_page - 1);

    if (error) {
      console.error('Error fetching approval history:', error);
      return NextResponse.json(
        { error: '承認履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    // ページネーション情報の計算
    const total_pages = Math.ceil((count || 0) / per_page);

    return NextResponse.json({
      data: history,
      pagination: {
        current_page: page,
        per_page,
        total_items: count,
        total_pages,
        has_next: page < total_pages,
        has_previous: page > 1
      }
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
} 