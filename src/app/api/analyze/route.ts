import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface QueryAnalysis {
  category: string;
  intent: string;
  tone: string;
  confidence: number;
}

interface RoutingResult {
  template: any;
  confidence: number;
  exactMatch: boolean;
  processingTimeMs: number;
  evidence: {
    source: string;
    rowId?: number;
    contentHash?: string;
    fieldKnowledge?: any;
  };
}

// シンプルなセンシング（現場ナレッジベース）
async function analyzeQuery(query: string): Promise<QueryAnalysis> {
  const lowerQuery = query.toLowerCase();
  
  // カテゴリ判定（現場の言葉から）
  let category = 'general';
  if (lowerQuery.includes('駐車') || lowerQuery.includes('パーキング')) {
    category = 'parking';
  } else if (lowerQuery.includes('送迎') || lowerQuery.includes('シャトル')) {
    category = 'shuttle';
  } else if (lowerQuery.includes('予約') || lowerQuery.includes('reservation')) {
    category = 'reservation';
  } else if (lowerQuery.includes('定員') || lowerQuery.includes('人数')) {
    category = 'capacity';
  } else if (lowerQuery.includes('運営') || lowerQuery.includes('時間')) {
    category = 'operation';
  }

  // 意図判定（現場の質問タイプから）
  let intent = 'inquiry';
  if (lowerQuery.includes('変更') || lowerQuery.includes('修正')) {
    intent = 'change';
  } else if (lowerQuery.includes('確認') || lowerQuery.includes('チェック')) {
    intent = 'check';
  } else if (lowerQuery.includes('制限') || lowerQuery.includes('できない') || lowerQuery.includes('不可')) {
    intent = 'restriction';
  } else if (lowerQuery.includes('手順') || lowerQuery.includes('方法')) {
    intent = 'procedure';
  } else if (lowerQuery.includes('時間') || lowerQuery.includes('スケジュール')) {
    intent = 'schedule';
  }

  // トーン判定（現場の対応スタイルから）
  let tone = 'normal';
  if (lowerQuery.includes('緊急') || lowerQuery.includes('急いで')) {
    tone = 'urgent';
  } else if (lowerQuery.includes('丁寧') || lowerQuery.includes('正式')) {
    tone = 'formal';
  } else if (lowerQuery.includes('親切') || lowerQuery.includes('配慮')) {
    tone = 'polite';
  }

  return {
    category,
    intent,
    tone,
    confidence: 0.9 // 現場ナレッジベースのため高信頼度
  };
}

// 完全一致ルーティング
async function routeQuery(analysis: QueryAnalysis): Promise<RoutingResult> {
  const startTime = Date.now();
  
  // 完全一致検索（category + intent + tone）
  let template = await prisma.templates.findFirst({
    where: {
      category: analysis.category,
      intent: analysis.intent,
      tone: analysis.tone,
      is_approved: true
    },
    orderBy: { created_at: 'desc' }
  });

  const processingTimeMs = Date.now() - startTime;
  const exactMatch = !!template;

  // 根拠情報の抽出
  const metadata = template?.metadata as any;
  const evidence = {
    source: metadata?.source || 'unknown',
    rowId: metadata?.rowId,
    contentHash: metadata?.contentHash,
    fieldKnowledge: metadata?.field_knowledge
  };

  return {
    template,
    confidence: exactMatch ? analysis.confidence : 0.1,
    exactMatch,
    processingTimeMs,
    evidence
  };
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // 現場ナレッジベースの解析
    const analysis = await analyzeQuery(query);

    // 完全一致ルーティング
    const routingResult = await routeQuery(analysis);

    return NextResponse.json({
      query,
      analysis,
      routing: routingResult
    });

  } catch (error) {
    console.error('Analyze API error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
} 