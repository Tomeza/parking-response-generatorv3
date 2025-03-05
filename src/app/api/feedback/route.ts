import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { responseId, isPositive } = await request.json();

    if (!responseId) {
      return NextResponse.json(
        { error: 'レスポンスIDが必要です' },
        { status: 400 }
      );
    }

    // レスポンスログを更新
    const updatedResponse = await prisma.responseLog.update({
      where: { id: responseId },
      data: { feedback: isPositive },
    });

    return NextResponse.json({
      success: true,
      message: 'フィードバックを保存しました',
      data: updatedResponse,
    });
  } catch (error) {
    console.error('フィードバック保存エラー:', error);
    return NextResponse.json(
      { error: 'フィードバックの保存に失敗しました' },
      { status: 500 }
    );
  }
} 