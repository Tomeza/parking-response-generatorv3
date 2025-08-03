import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// テストケース定義
const testCases = [
  {
    query: '駐車場の予約を確認したい',
    expected: { category: 'reservation', intent: 'check', tone: 'normal' },
    description: '予約確認'
  },
  {
    query: '支払い方法を教えて',
    expected: { category: 'payment', intent: 'inquiry', tone: 'normal' },
    description: '支払い方法'
  },
  {
    query: '送迎サービスを利用したい',
    expected: { category: 'shuttle', intent: 'inquiry', tone: 'normal' },
    description: '送迎サービス'
  },
  {
    query: '緊急で駐車場の予約が必要です',
    expected: { category: 'reservation', intent: 'create', tone: 'urgent' },
    description: '緊急予約'
  },
  {
    query: '将来の料金体系について知りたい',
    expected: { category: 'payment', intent: 'check', tone: 'future' },
    description: '将来の料金'
  }
];

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
  } else if (lowerQuery.includes('支払') || lowerQuery.includes('料金')) {
    category = 'payment';
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
  } else if (lowerQuery.includes('新規') || lowerQuery.includes('作成') || lowerQuery.includes('必要')) {
    intent = 'create';
  }

  // トーン判定（現場の対応スタイルから）
  let tone = 'normal';
  if (lowerQuery.includes('緊急') || lowerQuery.includes('急いで')) {
    tone = 'urgent';
  } else if (lowerQuery.includes('丁寧') || lowerQuery.includes('正式')) {
    tone = 'formal';
  } else if (lowerQuery.includes('親切') || lowerQuery.includes('配慮')) {
    tone = 'polite';
  } else if (lowerQuery.includes('将来') || lowerQuery.includes('改定')) {
    tone = 'future';
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

async function runAcceptanceTest() {
  console.log('受け入れチェック（小テスト）\n');

  let passedTests = 0;
  const totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`テスト: ${testCase.description}`);
    console.log(`クエリ: "${testCase.query}"`);
    
    // センシング
    const analysis = await analyzeQuery(testCase.query);
    console.log(`  センシング結果: ${analysis.category}:${analysis.intent}:${analysis.tone}`);
    
    // 期待値との比較
    const categoryMatch = analysis.category === testCase.expected.category;
    const intentMatch = analysis.intent === testCase.expected.intent;
    const toneMatch = analysis.tone === testCase.expected.tone;
    
    const isPassed = categoryMatch && intentMatch && toneMatch;
    
    if (isPassed) {
      passedTests++;
      console.log(`  ✅ 合格: 完全一致`);
    } else {
      console.log(`  ❌ 不合格:`);
      if (!categoryMatch) console.log(`    カテゴリ: 期待=${testCase.expected.category}, 実際=${analysis.category}`);
      if (!intentMatch) console.log(`    意図: 期待=${testCase.expected.intent}, 実際=${analysis.intent}`);
      if (!toneMatch) console.log(`    トーン: 期待=${testCase.expected.tone}, 実際=${analysis.tone}`);
    }

    // ルーティング結果
    const routingResult = await routeQuery(analysis);
    if (routingResult.template) {
      console.log(`  テンプレート: ${routingResult.template.title}`);
      console.log(`  ソース: ${routingResult.evidence.source}`);
      console.log(`  直撃: ${routingResult.exactMatch ? 'はい' : 'いいえ'}`);
    } else {
      console.log(`  テンプレート: 見つかりません`);
    }
    
    console.log('');
  }

  // 結果サマリー
  const passRate = (passedTests / totalTests) * 100;
  console.log('=== テスト結果 ===');
  console.log(`合格: ${passedTests}/${totalTests} (${passRate.toFixed(1)}%)`);
  
  if (passRate >= 80) {
    console.log('✅ 合格ライン達成！');
  } else {
    console.log('❌ 合格ライン未達成。マッピング規則の調整が必要です。');
  }

  return passRate;
}

runAcceptanceTest().catch(console.error).finally(() => prisma.$disconnect()); 