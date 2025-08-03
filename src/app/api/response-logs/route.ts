import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

// GET: 履歴データを取得
export async function GET() {
  try {
    // prismaがundefinedでないことを確認
    if (!prisma) {
      console.error('Prisma client is not initialized');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }

    const logs = await prisma.responseLog.findMany({
      orderBy: {
        created_at: 'desc'
      },
      take: 10
    });
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('履歴の取得中にエラーが発生しました:', error);
    return NextResponse.json(
      { error: '履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST: 新しい履歴データを保存
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, response, response_count } = body;

    // prismaがundefinedでないことを確認
    if (!prisma) {
      console.error('Prisma client is not initialized');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }

    const log = await prisma.responseLog.create({
      data: {
        query,
        response,
        response_count
      }
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('履歴の保存中にエラーが発生しました:', error);
    return NextResponse.json(
      { error: '履歴の保存に失敗しました' },
      { status: 500 }
    );
  }
} 