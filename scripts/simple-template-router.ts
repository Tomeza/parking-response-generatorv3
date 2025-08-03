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
  fallbackUsed: boolean;
  processingTimeMs: number;
}

class SimpleTemplateRouter {
  // シンプルなセンシング（キーワードベース）
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const lowerQuery = query.toLowerCase();
    
    // カテゴリ判定
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

    // 意図判定
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

    // トーン判定
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
      confidence: 0.8 // 簡易判定のため固定値
    };
  }

  // シンプルなルーティング
  async routeQuery(query: string): Promise<RoutingResult> {
    const startTime = Date.now();
    
    // 1. センシング
    const analysis = await this.analyzeQuery(query);
    
    // 2. 厳格なフィルタによる検索
    let template = await prisma.templates.findFirst({
      where: {
        category: analysis.category,
        intent: analysis.intent,
        tone: analysis.tone,
        is_approved: true
      },
      orderBy: { created_at: 'desc' }
    });

    let fallbackUsed = false;

    // 3. フィルタ緩和による検索
    if (!template) {
      template = await prisma.templates.findFirst({
        where: {
          category: analysis.category,
          intent: analysis.intent,
          is_approved: true
        },
        orderBy: { created_at: 'desc' }
      });
      fallbackUsed = true;
    }

    // 4. カテゴリのみでの検索
    if (!template) {
      template = await prisma.templates.findFirst({
        where: {
          category: analysis.category,
          is_approved: true
        },
        orderBy: { created_at: 'desc' }
      });
      fallbackUsed = true;
    }

    // 5. 最終手段：最新の承認済みテンプレート
    if (!template) {
      template = await prisma.templates.findFirst({
        where: {
          is_approved: true
        },
        orderBy: { created_at: 'desc' }
      });
      fallbackUsed = true;
    }

    const processingTimeMs = Date.now() - startTime;

    // ログ記録
    await this.logRouting(query, analysis, template, fallbackUsed, processingTimeMs);

    return {
      template,
      confidence: template ? analysis.confidence : 0.1,
      fallbackUsed,
      processingTimeMs
    };
  }

  // ルーティングログの記録
  async logRouting(
    query: string,
    analysis: QueryAnalysis,
    template: any,
    fallbackUsed: boolean,
    processingTimeMs: number
  ) {
    try {
      await prisma.routingLogs.create({
        data: {
          query_text: query,
          detected_category: analysis.category,
          detected_intent: analysis.intent,
          detected_tone: analysis.tone,
          selected_template_id: template?.id || null,
          confidence_score: analysis.confidence,
          is_fallback: fallbackUsed,
          processing_time_ms: processingTimeMs,
          created_at: new Date()
        }
      });
    } catch (error) {
      console.warn('ログ記録に失敗:', error);
    }
  }
}

// テスト実行
async function testRouting() {
  const router = new SimpleTemplateRouter();
  
  const testQueries = [
    '駐車場の予約を変更したいのですが',
    '送迎の時間を確認したいです',
    '定員を超える人数で利用できますか？',
    '国際線の送迎は可能でしょうか？',
    '早朝の送迎は何時からですか？'
  ];

  console.log('テンプレートルーティングテスト\n');

  for (const query of testQueries) {
    console.log(`クエリ: "${query}"`);
    
    const result = await router.routeQuery(query);
    
    if (result.template) {
      console.log(`  選択テンプレート: ${result.template.title}`);
      console.log(`  信頼度: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`  フォールバック使用: ${result.fallbackUsed ? 'はい' : 'いいえ'}`);
      console.log(`  処理時間: ${result.processingTimeMs}ms`);
      console.log(`  内容: ${result.template.content.substring(0, 100)}...`);
    } else {
      console.log('  テンプレートが見つかりませんでした');
    }
    console.log('');
  }
}

testRouting().catch(console.error).finally(() => prisma.$disconnect()); 