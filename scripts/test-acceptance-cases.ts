import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestCase {
  query: string;
  expectedCategory: string;
  expectedIntent: string;
  expectedTone: string;
  description: string;
}

const testCases: TestCase[] = [
  {
    query: "駐車場の予約を確認したい",
    expectedCategory: "reservation",
    expectedIntent: "check",
    expectedTone: "normal",
    description: "駐車場予約の確認"
  },
  {
    query: "支払い方法を教えて",
    expectedCategory: "payment",
    expectedIntent: "inquiry",
    expectedTone: "normal",
    description: "支払い方法の問い合わせ"
  },
  {
    query: "送迎サービスを利用したい",
    expectedCategory: "shuttle",
    expectedIntent: "inquiry",
    expectedTone: "normal",
    description: "送迎サービスの問い合わせ"
  },
  {
    query: "緊急で駐車場の予約が必要です",
    expectedCategory: "reservation",
    expectedIntent: "create",
    expectedTone: "urgent",
    description: "緊急駐車場予約"
  },
  {
    query: "将来の料金体系について知りたい",
    expectedCategory: "payment",
    expectedIntent: "check",
    expectedTone: "future",
    description: "将来の料金体系確認"
  }
];

async function analyzeQuery(query: string) {
  const lowerQuery = query.toLowerCase();
  
  // カテゴリ判定
  let category = 'other';
  if (lowerQuery.includes('駐車') || lowerQuery.includes('パーキング')) {
    category = 'reservation';
  } else if (lowerQuery.includes('支払') || lowerQuery.includes('料金') || lowerQuery.includes('お金')) {
    category = 'payment';
  } else if (lowerQuery.includes('送迎') || lowerQuery.includes('シャトル')) {
    category = 'shuttle';
  }
  
  // 意図判定
  let intent = 'inquiry';
  if (lowerQuery.includes('確認')) {
    intent = 'check';
  } else if (lowerQuery.includes('教えて')) {
    intent = 'inquiry';
  } else if (lowerQuery.includes('予約') && (lowerQuery.includes('必要') || lowerQuery.includes('したい'))) {
    intent = 'create';
  } else if (lowerQuery.includes('知りたい')) {
    intent = 'check';
  }
  
  // トーン判定
  let tone = 'normal';
  if (lowerQuery.includes('緊急') || lowerQuery.includes('急') || lowerQuery.includes('今すぐ')) {
    tone = 'urgent';
  } else if (lowerQuery.includes('将来') || lowerQuery.includes('改定') || lowerQuery.includes('予定')) {
    tone = 'future';
  }
  
  return { category, intent, tone };
}

async function findTemplate(analysis: { category: string; intent: string; tone: string }) {
  // 1. 完全一致検索
  let template = await prisma.templates.findFirst({
    where: {
      category: analysis.category,
      intent: analysis.intent,
      tone: analysis.tone,
      is_approved: true
    }
  });
  
  // 2. カテゴリ・意図一致検索
  if (!template) {
    template = await prisma.templates.findFirst({
      where: {
        category: analysis.category,
        intent: analysis.intent,
        is_approved: true
      }
    });
  }
  
  // 3. カテゴリのみ一致検索
  if (!template) {
    template = await prisma.templates.findFirst({
      where: {
        category: analysis.category,
        is_approved: true
      }
    });
  }
  
  return template;
}

async function testAcceptanceCases() {
  console.log('🧪 受け入れチェックを開始...\n');
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`📝 テストケース: ${testCase.description}`);
    console.log(`   クエリ: "${testCase.query}"`);
    
    // センシング実行
    const analysis = await analyzeQuery(testCase.query);
    console.log(`   センシング結果: ${analysis.category}:${analysis.intent}:${analysis.tone}`);
    
    // 期待値との比較
    const categoryMatch = analysis.category === testCase.expectedCategory;
    const intentMatch = analysis.intent === testCase.expectedIntent;
    const toneMatch = analysis.tone === testCase.expectedTone;
    
    console.log(`   期待値: ${testCase.expectedCategory}:${testCase.expectedIntent}:${testCase.expectedTone}`);
    console.log(`   カテゴリ: ${categoryMatch ? '✅' : '❌'} (${analysis.category} vs ${testCase.expectedCategory})`);
    console.log(`   意図: ${intentMatch ? '✅' : '❌'} (${analysis.intent} vs ${testCase.expectedIntent})`);
    console.log(`   トーン: ${toneMatch ? '✅' : '❌'} (${analysis.tone} vs ${testCase.expectedTone})`);
    
    // テンプレート検索
    const template = await findTemplate(analysis);
    if (template) {
      console.log(`   テンプレート: ${template.title}`);
      console.log(`   信頼度: ${categoryMatch && intentMatch && toneMatch ? '高' : '中'}`);
    } else {
      console.log(`   テンプレート: 見つかりませんでした`);
      console.log(`   信頼度: 低`);
    }
    
    // テスト結果判定
    const testPassed = categoryMatch && intentMatch && toneMatch;
    if (testPassed) {
      passedTests++;
    }
    
    console.log(`   結果: ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);
  }
  
  // 総合結果
  const passRate = (passedTests / totalTests) * 100;
  console.log('📊 総合結果');
  console.log(`   合格テスト: ${passedTests}/${totalTests}`);
  console.log(`   合格率: ${passRate.toFixed(1)}%`);
  
  if (passRate >= 80) {
    console.log('🎉 合格ライン（80%以上）を達成しました！');
  } else {
    console.log('⚠️  合格ラインに達していません。マッピング規則の調整が必要です。');
  }
  
  return passRate >= 80;
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  testAcceptanceCases().finally(() => {
    prisma.$disconnect();
  });
}

export { testAcceptanceCases }; 