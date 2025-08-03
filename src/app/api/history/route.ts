import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    // クエリパラメータから取得するページ数と制限を設定
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // データベースから履歴を取得
    const responseLogs = await prisma.responseLog.findMany({
      take: limit,
      skip: skip,
      orderBy: { created_at: 'desc' },
      include: {
        knowledge: true,
      },
    });

    // 全体の件数を取得
    const total = await prisma.responseLog.count();

    // クライアントに返すデータを整形
    const items = responseLogs.map(log => ({
      id: log.id,
      query: log.query,
      response: log.response,
      createdAt: log.created_at.toISOString(),
      knowledgeId: log.knowledge_id,
      knowledgeInfo: log.knowledge ? {
        id: log.knowledge.id,
        main_category: log.knowledge.main_category,
        sub_category: log.knowledge.sub_category
      } : null
    }));

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasMore: skip + items.length < total
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { error: '履歴の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
} 