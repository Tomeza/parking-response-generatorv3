import { QueryAnalyzer } from '../src/lib/query-analyzer';
import { TemplateRouter } from '../src/lib/template-router';

async function testPhase2Routing() {
  console.log('🧪 Phase2 ルーティングテスト開始...');
  
  const analyzer = new QueryAnalyzer();
  const router = new TemplateRouter();
  
  // テストケース
  const testCases = [
    {
      query: '駐車場の予約を変更したいのですが',
      expected: {
        category: 'reservation',
        intent: 'modify',
        tone: 'normal'
      }
    },
    {
      query: '緊急で駐車場の予約をキャンセルしたい',
      expected: {
        category: 'reservation',
        intent: 'cancel',
        tone: 'urgent'
      }
    },
    {
      query: '送迎サービスの時間を教えてください',
      expected: {
        category: 'shuttle',
        intent: 'inquiry',
        tone: 'normal'
      }
    },
    {
      query: '支払い方法について詳しく知りたい',
      expected: {
        category: 'payment',
        intent: 'inquiry',
        tone: 'normal'
      }
    },
    {
      query: '駐車場で事故が起きました',
      expected: {
        category: 'trouble',
        intent: 'report',
        tone: 'urgent'
      }
    }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  let humanReviewCount = 0;
  
  for (const testCase of testCases) {
    totalTests++;
    console.log(`\n📝 テストケース ${totalTests}: "${testCase.query}"`);
    
    try {
      // 1. クエリ解析
      const analysis = await analyzer.analyze(testCase.query);
      console.log('  📊 解析結果:', {
        category: analysis.category,
        intent: analysis.intent,
        tone: analysis.tone,
        confidence: analysis.confidence,
        urgency: analysis.urgency
      });
      
      // 2. ルーティング
      const result = await router.route(analysis);
      console.log('  🎯 ルーティング結果:', {
        templateFound: !!result.template,
        templateTitle: result.template?.title || 'なし',
        confidence: result.confidence,
        fallbackUsed: result.fallbackUsed,
        needsHumanReview: result.needsHumanReview,
        reviewReason: result.reviewReason,
        alternativesCount: result.alternatives.length
      });
      
      // 3. 受け入れ回し判定の確認
      if (result.needsHumanReview) {
        humanReviewCount++;
        console.log('  ⚠️  人間の確認が必要:', result.reviewReason);
        console.log('  💡 推奨アクション:', result.suggestedActions);
      }
      
      // 4. 期待値との比較
      const categoryMatch = analysis.category === testCase.expected.category;
      const intentMatch = analysis.intent === testCase.expected.intent;
      const toneMatch = analysis.tone === testCase.expected.tone;
      
      if (categoryMatch && intentMatch && toneMatch) {
        passedTests++;
        console.log('  ✅ 期待値と一致');
      } else {
        console.log('  ❌ 期待値と不一致:', {
          expected: testCase.expected,
          actual: {
            category: analysis.category,
            intent: analysis.intent,
            tone: analysis.tone
          }
        });
      }
      
    } catch (error) {
      console.error(`  ❌ テストエラー:`, error);
    }
  }
  
  // 結果サマリー
  console.log('\n📊 テスト結果サマリー');
  console.log(`  総テスト数: ${totalTests}`);
  console.log(`  成功: ${passedTests}`);
  console.log(`  失敗: ${totalTests - passedTests}`);
  console.log(`  成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`  人間確認必要: ${humanReviewCount}件`);
  console.log(`  人間確認率: ${((humanReviewCount / totalTests) * 100).toFixed(1)}%`);
  
  // Phase2の品質指標
  console.log('\n🎯 Phase2品質指標');
  console.log(`  直撃率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`  補正率: ${((humanReviewCount / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests / totalTests >= 0.8) {
    console.log('  ✅ 直撃率目標（80%以上）を達成');
  } else {
    console.log('  ❌ 直撃率目標（80%以上）未達成');
  }
  
  if (humanReviewCount / totalTests <= 0.2) {
    console.log('  ✅ 補正率目標（20%以下）を達成');
  } else {
    console.log('  ❌ 補正率目標（20%以下）未達成');
  }
  
  console.log('\n🎉 Phase2 ルーティングテスト完了');
}

testPhase2Routing()
  .catch(console.error)
  .finally(() => {
    console.log('\n👋 テスト終了');
    process.exit(0);
  }); 