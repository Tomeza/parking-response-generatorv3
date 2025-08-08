export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { refineResponse } from '@/lib/anthropic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { original_response, tone, knowledge_ids } = body;

    if (!original_response) {
      return NextResponse.json(
        { error: '元の回答が必要です' },
        { status: 400 }
      );
    }

    const refinedResponse = await refineResponse(
      original_response,
      tone || 'formal',
      knowledge_ids
    );

    return NextResponse.json({ 
      refined_response: refinedResponse,
      original_response: original_response,
      success: true
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました', success: false },
      { status: 500 }
    );
  }
} 