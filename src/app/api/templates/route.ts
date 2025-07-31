import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 一時的に認証を無効にして、全テンプレートを取得
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json(
        { error: 'テンプレートの取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
} 