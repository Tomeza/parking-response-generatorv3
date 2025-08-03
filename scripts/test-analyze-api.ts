import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// /api/analyzeと同じロジックでテスト
async function testAnalyzeAPI() {
  const testQueries = [
    '駐車場の予約を変更したいのですが',
    '送迎の時間を確認したいです',
    '定員を超える人数で利用できますか？',
    '国際線の送迎は可能でしょうか？',
    '早朝の送迎は何時からですか？'
  ];

  console.log('完全一致ルーティングテスト (/api/analyze)\n');

  for (const query of testQueries) {
    console.log(`クエリ: "${query}"`);
    
    // センシング（現場ナレッジベース）
    const analysis = await analyzeQuery(query);
    console.log(`  センシング結果:`);
    console.log(`    カテゴリ: ${analysis.category}`);
    console.log(`    意図: ${analysis.intent}`);
    console.log(`    トーン: ${analysis.tone}`);
    console.log(`    信頼度: ${(analysis.confidence * 100).toFixed(1)}%`);

    // 完全一致ルーティング
    const routingResult = await routeQuery(analysis);
    
    if (routingResult.template) {
      console.log(`  完全一致: ${routingResult.exactMatch ? 'はい' : 'いいえ'}`);
      console.log(`  選択テンプレート: ${routingResult.template.title}`);
      console.log(`  処理時間: ${routingResult.processingTimeMs}ms`);
      console.log(`  内容: ${routingResult.template.content.substring(0, 100)}...`);
      
      // 根拠情報の表示
      console.log(`  根拠情報:`);
      console.log(`    ソース: ${routingResult.evidence.source}`);
      console.log(`    CSV行ID: ${routingResult.evidence.rowId}`);
      console.log(`    コンテンツハッシュ: ${routingResult.evidence.contentHash?.substring(0, 8)}`);
      if (routingResult.evidence.fieldKnowledge) {
        console.log(`    現場ナレッジ: ${JSON.stringify(routingResult.evidence.fieldKnowledge)}`);
      }
    } else {
      console.log('  テンプレートが見つかりませんでした');
    }
    console.log('');
  }
}

// センシング関数（/api/analyzeと同じ）
async function analyzeQuery(query: string): Promise<any> {
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
    confidence: 0.9
  };
}

// 完全一致ルーティング関数（/api/analyzeと同じ）
async function routeQuery(analysis: any): Promise<any> {
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

testAnalyzeAPI().catch(console.error).finally(() => prisma.$disconnect()); 