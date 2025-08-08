export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get('date');

    if (!dateStr) {
      return NextResponse.json(
        { error: '日付パラメータが必要です' },
        { status: 400 }
      );
    }

    // 日付をパース
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: '無効な日付形式です' },
        { status: 400 }
      );
    }

    // 繁忙期情報を検索
    const busyPeriod = await prisma.seasonalInfo.findFirst({
      where: {
        start_date: { lte: date },
        end_date: { gte: date },
      },
    });

    if (busyPeriod) {
      return NextResponse.json({
        isBusyPeriod: true,
        info: busyPeriod,
      });
    } else {
      return NextResponse.json({
        isBusyPeriod: false,
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
} 