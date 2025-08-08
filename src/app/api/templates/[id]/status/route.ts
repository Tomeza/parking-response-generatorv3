export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { canManageTemplate } from '@/lib/auth';

const VALID_TRANSITIONS = {
  draft: ['pending'],
  pending: ['approved', 'draft'],
  approved: ['archived'],
  archived: ['draft']
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status, comment } = await request.json();

    // バリデーション
    if (!status) {
      return NextResponse.json(
        { error: 'ステータスは必須です' },
        { status: 400 }
      );
    }

    // 現在のステータスを取得
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('status')
      .eq('id', params.id)
      .single();

    if (templateError) {
      console.error('Error fetching template:', templateError);
      return NextResponse.json(
        { error: 'テンプレートの取得に失敗しました' },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません' },
        { status: 404 }
      );
    }

    // 権限チェック
    const hasPermission = await canManageTemplate(template.status);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'この操作を実行する権限がありません' },
        { status: 403 }
      );
    }

    // 遷移の検証
    const validNextStates = VALID_TRANSITIONS[template.status as keyof typeof VALID_TRANSITIONS];
    if (!validNextStates?.includes(status)) {
      return NextResponse.json(
        { error: `${template.status}から${status}への遷移は許可されていません` },
        { status: 400 }
      );
    }

    // トランザクション開始
    const { data, error } = await supabase.rpc('update_template_status', {
      p_template_id: params.id,
      p_old_status: template.status,
      p_new_status: status,
      p_comment: comment || '',
      p_approved_by: 'system@example.com' // TODO: 認証実装後に実際のユーザーメールアドレスに変更
    });

    if (error) {
      console.error('Error updating template status:', error);
      return NextResponse.json(
        { error: 'ステータスの更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
} 