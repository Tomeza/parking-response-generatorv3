import { NextRequest, NextResponse } from 'next/server';
import { refineResponse } from '@/lib/anthropic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { original_response, tone } = body;

    if (!original_response) {
      return NextResponse.json(
        { error: '元の回答が必要です' },
        { status: 400 }
      );
    }

    const refinedResponse = await refineResponse(
      original_response,
      tone || 'formal'
    );

    return NextResponse.json({ refined_response: refinedResponse });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
} 