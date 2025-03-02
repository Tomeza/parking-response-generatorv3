import { NextRequest, NextResponse } from 'next/server';
import { refineResponse } from '@/lib/anthropic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, tone } = body;

    if (!text) {
      return NextResponse.json(
        { error: '元の回答が必要です' },
        { status: 400 }
      );
    }

    const refinedResponse = await refineResponse(
      text,
      tone || 'formal'
    );

    return NextResponse.json({ refinedText: refinedResponse });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
} 