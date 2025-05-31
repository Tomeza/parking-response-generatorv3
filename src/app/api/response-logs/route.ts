import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EMBEDDING_VERSION } from '@/config/constants';

// GET: 履歴データを取得
export async function GET() {
  try {
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
    const { query, response, response_count, used_knowledge_ids, missing_tags, missing_alerts, feedback, knowledge_id } = body;

    // Basic validation
    if (!query || !response) {
      return NextResponse.json(
        { error: 'Query and response are required' },
        { status: 400 }
      );
    }

    const log = await prisma.responseLog.create({
      data: {
        query,
        response,
        response_count: response_count !== undefined ? Number(response_count) : 1,
        used_knowledge_ids: used_knowledge_ids || [],
        missing_tags: missing_tags || [],
        missing_alerts: missing_alerts || [],
        feedback: feedback !== undefined ? Boolean(feedback) : null,
        knowledge_id: knowledge_id !== undefined ? Number(knowledge_id) : null,
        embeddingModel: EMBEDDING_VERSION,
        embeddingDims: EMBEDDING_VERSION === 'v2' ? 384 : 1536,
        quantized: EMBEDDING_VERSION === 'v2' && process.env.EMB_QUANTIZED === 'true',
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