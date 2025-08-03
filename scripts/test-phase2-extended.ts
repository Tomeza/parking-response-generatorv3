import { QueryAnalyzer } from '../src/lib/query-analyzer';
import { TemplateRouter } from '../src/lib/template-router';
import { prisma } from '../src/lib/db';

interface TestCase {
  query: string;
  expected: {
    category: string;
    intent: string;
    tone: string;
  };
  description?: string;
}

interface DetailedResult {
  query: string;
  expected: any;
  actual: any;
  success: boolean;
  categoryScores?: Record<string, number>;
  hitKeywords?: Record<string, { pos: string[], neg: string[], phr: string[] }>;
  tiebreakerInfo?: {
    usageLabel: string;
    updatedAt: string;
    id: number;
  };
  humanReview?: {
    needsReview: boolean;
    reason: string;
    actions: string[];
  };
}

const testCases: TestCase[] = [
  // 既存のテストケース
  { query: "予約をキャンセルしたい", expected: { category: 'reservation', intent: 'cancel', tone: 'normal' } },
  { query: "料金を確認したい", expected: { category: 'payment', intent: 'check', tone: 'normal' } },
  { query: "送迎サービスの時間を教えてください", expected: { category: 'shuttle', intent: 'inquiry', tone: 'normal' } },
  { query: "充電器の利用方法を教えてください", expected: { category: 'facility', intent: 'inquiry', tone: 'normal' } },
  { query: "バリアフリー設備の確認をお願いします", expected: { category: 'facility', intent: 'check', tone: 'normal' } },
  { query: "設備の故障を報告します", expected: { category: 'facility', intent: 'report', tone: 'urgent' } },
  { query: "設備の利用可能時間を確認したい", expected: { category: 'facility', intent: 'check', tone: 'normal' } },
  { query: "駐車場で事故が起きました", expected: { category: 'trouble', intent: 'report', tone: 'urgent' } },
  { query: "車の故障で出られません", expected: { category: 'trouble', intent: 'report', tone: 'urgent' } },
  { query: "駐車券を紛失しました", expected: { category: 'trouble', intent: 'report', tone: 'normal' } },
  { query: "駐車場でトラブルが発生しました", expected: { category: 'trouble', intent: 'report', tone: 'urgent' } },
  { query: "駐車場へのアクセス方法を教えてください", expected: { category: 'access', intent: 'inquiry', tone: 'normal' } },
  { query: "最寄り駅からの経路を確認したい", expected: { category: 'access', intent: 'check', tone: 'normal' } },
  { query: "駐車場の住所を教えてください", expected: { category: 'access', intent: 'inquiry', tone: 'normal' } },
  { query: "大型車の駐車可能時間を確認したい", expected: { category: 'vehicle', intent: 'check', tone: 'normal' } },
  { query: "車両の種類別料金を教えてください", expected: { category: 'vehicle', intent: 'inquiry', tone: 'normal' } },
  { query: "車両の高さ制限を確認したい", expected: { category: 'vehicle', intent: 'check', tone: 'normal' } },
  // 追加のテストケース
  { query: "予約の変更手続きを教えてください", expected: { category: 'reservation', intent: 'modify', tone: 'normal' } },
  { query: "支払い方法を確認したい", expected: { category: 'payment', intent: 'check', tone: 'normal' } },
  { query: "現金での支払いのみ可能ですか", expected: { category: 'payment', intent: 'inquiry', tone: 'normal' } },
  { query: "送迎バスの定員を教えてください", expected: { category: 'shuttle', intent: 'inquiry', tone: 'normal' } },
  { query: "空港までの送迎時間を確認したい", expected: { category: 'shuttle', intent: 'check', tone: 'normal' } },
  { query: "精算機の使い方を教えてください", expected: { category: 'facility', intent: 'inquiry', tone: 'normal' } },
  { query: "ゲートの開閉時間を確認したい", expected: { category: 'facility', intent: 'check', tone: 'normal' } },
  { query: "駐車場でクレームを報告します", expected: { category: 'trouble', intent: 'report', tone: 'urgent' } },
  { query: "返金の手続きを教えてください", expected: { category: 'trouble', intent: 'inquiry', tone: 'normal' } },
  { query: "Googleマップでの行き方を教えてください", expected: { category: 'access', intent: 'inquiry', tone: 'normal' } },
  { query: "ナビゲーションの設定方法を確認したい", expected: { category: 'access', intent: 'check', tone: 'normal' } },
  { query: "外車の受け入れ可否を確認したい", expected: { category: 'vehicle', intent: 'check', tone: 'normal' } },
  { query: "軽自動車の料金を教えてください", expected: { category: 'vehicle', intent: 'inquiry', tone: 'normal' } }
];

async function runDetailedTests() {
  const analyzer = new QueryAnalyzer();
  const router = new TemplateRouter();
  
  const results: DetailedResult[] = [];
  
  console.log('🔍 Phase2.5: 詳細テスト実行開始...\n');
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📝 テストケース ${i + 1}: "${testCase.query}"`);
    
    try {
      // 1. クエリ分析
      const analysis = await analyzer.analyze(testCase.query);
      
      // 2. テンプレートルーティング
      const routingResult = await router.route(testCase.query, analysis);
      
      // 3. 結果判定
      const success = 
        analysis.category === testCase.expected.category &&
        analysis.intent === testCase.expected.intent &&
        analysis.tone === testCase.expected.tone;
      
      // 4. 詳細情報の収集
      const detailedResult: DetailedResult = {
        query: testCase.query,
        expected: testCase.expected,
        actual: {
          category: analysis.category,
          intent: analysis.intent,
          tone: analysis.tone
        },
        success,
        humanReview: {
          needsReview: routingResult.needsHumanReview,
          reason: routingResult.reviewReason,
          actions: routingResult.suggestedActions
        }
      };
      
      // 5. カテゴリスコアの詳細分析（QueryAnalyzerの内部状態から取得）
      if (!success) {
        detailedResult.categoryScores = await getCategoryScores(testCase.query);
        detailedResult.hitKeywords = await getHitKeywords(testCase.query);
        
        // 6. タイブレーク情報の取得
        if (routingResult.templateFound) {
          const template = await prisma.templates.findUnique({
            where: { id: routingResult.selectedTemplateId },
            select: { usageLabel: true, updated_at: true, id: true }
          });
          
          if (template) {
            detailedResult.tiebreakerInfo = {
              usageLabel: template.usageLabel || 'N/A',
              updatedAt: template.updated_at.toISOString(),
              id: template.id
            };
          }
        }
      }
      
      results.push(detailedResult);
      
      if (success) {
        console.log(`  ✅ 期待値と一致`);
      } else {
        console.log(`  ❌ 期待値と不一致: {
  expected: ${JSON.stringify(testCase.expected)},
  actual: ${JSON.stringify(detailedResult.actual)}
}`);
      }
      
    } catch (error) {
      console.error(`  ❌ テストエラー: ${error}`);
    }
  }
  
  // 結果サマリー
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = (successCount / totalCount * 100).toFixed(1);
  
  console.log(`\n📊 詳細テスト結果サマリー`);
  console.log(`  総テスト数: ${totalCount}`);
  console.log(`  成功: ${successCount}`);
  console.log(`  失敗: ${totalCount - successCount}`);
  console.log(`  成功率: ${successRate}%`);
  
  // 失敗ケースの詳細分析
  const failedResults = results.filter(r => !r.success);
  
  if (failedResults.length > 0) {
    console.log(`\n🔍 失敗ケース詳細分析（上位${Math.min(10, failedResults.length)}件）:`);
    
    failedResults.slice(0, 10).forEach((result, index) => {
      console.log(`\n${index + 1}. "${result.query}"`);
      console.log(`   Gold: ${result.expected.category}/${result.expected.intent}/${result.expected.tone}`);
      console.log(`   Predicted: ${result.actual.category}/${result.actual.intent}/${result.actual.tone}`);
      
      if (result.categoryScores) {
        console.log(`   📊 カテゴリスコア:`);
        Object.entries(result.categoryScores)
          .sort(([,a], [,b]) => b - a)
          .forEach(([category, score]) => {
            console.log(`      ${category}: ${score}`);
          });
      }
      
      if (result.hitKeywords) {
        console.log(`   🎯 ヒットキーワード:`);
        Object.entries(result.hitKeywords).forEach(([category, keywords]) => {
          if (keywords.pos.length > 0 || keywords.neg.length > 0 || keywords.phr.length > 0) {
            console.log(`      ${category}:`);
            if (keywords.pos.length > 0) console.log(`        pos: ${keywords.pos.join(', ')}`);
            if (keywords.neg.length > 0) console.log(`        neg: ${keywords.neg.join(', ')}`);
            if (keywords.phr.length > 0) console.log(`        phr: ${keywords.phr.join(', ')}`);
          }
        });
      }
      
      if (result.tiebreakerInfo) {
        console.log(`   🔄 タイブレーク根拠:`);
        console.log(`      usageLabel: ${result.tiebreakerInfo.usageLabel}`);
        console.log(`      updated_at: ${result.tiebreakerInfo.updatedAt}`);
        console.log(`      id: ${result.tiebreakerInfo.id}`);
      }
      
      if (result.humanReview?.needsReview) {
        console.log(`   ⚠️  人間確認: ${result.humanReview.reason}`);
        console.log(`      actions: ${result.humanReview.actions.join(', ')}`);
      }
    });
  }
  
  console.log(`\n🎉 詳細テスト完了`);
}

// カテゴリスコアの取得（QueryAnalyzerの内部実装に依存）
async function getCategoryScores(query: string): Promise<Record<string, number>> {
  // 簡易実装：実際のスコア計算ロジックを再現
  const scores: Record<string, number> = {};
  const lowerQuery = query.toLowerCase();
  
  // 各カテゴリのキーワードでスコアを計算
  const categories = ['access', 'shuttle', 'payment', 'reservation', 'vehicle', 'facility', 'trouble', 'information'];
  
  for (const category of categories) {
    let score = 0;
    // 簡易スコア計算（実際のロジックに合わせて調整）
    if (lowerQuery.includes(category)) score += 2;
    if (lowerQuery.includes('確認')) score += 1;
    if (lowerQuery.includes('教えて')) score += 1;
    if (lowerQuery.includes('報告')) score += 2;
    
    if (score > 0) {
      scores[category] = score;
    }
  }
  
  return scores;
}

// ヒットキーワードの取得
async function getHitKeywords(query: string): Promise<Record<string, { pos: string[], neg: string[], phr: string[] }>> {
  const lowerQuery = query.toLowerCase();
  const result: Record<string, { pos: string[], neg: string[], phr: string[] }> = {};
  
  // 簡易実装：実際のキーワードマッチングを再現
  const keywords = {
    access: { pos: ['アクセス', '住所', '地図'], neg: [], phr: [] },
    shuttle: { pos: ['送迎', 'バス'], neg: [], phr: [] },
    payment: { pos: ['料金', '支払い'], neg: [], phr: [] },
    reservation: { pos: ['予約', '確認'], neg: [], phr: [] },
    vehicle: { pos: ['車両', '車'], neg: [], phr: [] },
    facility: { pos: ['設備', '充電器'], neg: [], phr: [] },
    trouble: { pos: ['故障', '事故', '報告'], neg: [], phr: [] },
    information: { pos: ['情報', '教えて'], neg: [], phr: [] }
  };
  
  for (const [category, keywordSet] of Object.entries(keywords)) {
    const hits = {
      pos: keywordSet.pos.filter(k => lowerQuery.includes(k.toLowerCase())),
      neg: keywordSet.neg.filter(k => lowerQuery.includes(k.toLowerCase())),
      phr: keywordSet.phr.filter(k => lowerQuery.includes(k.toLowerCase()))
    };
    
    if (hits.pos.length > 0 || hits.neg.length > 0 || hits.phr.length > 0) {
      result[category] = hits;
    }
  }
  
  return result;
}

// コマンドライン引数の解析
const args = process.argv.slice(2);
const explainMode = args.includes('--explain');
const onlyFails = args.includes('--only-fails');
const topIndex = args.indexOf('--top');
const topCount = topIndex !== -1 ? parseInt(args[topIndex + 1]) || 10 : 10;

if (explainMode) {
  runDetailedTests()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  // 通常のテスト実行
  runTests()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

async function runTests() {
  const analyzer = new QueryAnalyzer();
  const router = new TemplateRouter();
  
  let successCount = 0;
  let humanReviewCount = 0;
  const categoryStats: Record<string, { success: number, total: number }> = {};
  
  console.log('🎯 Phase2.5: 拡張ルーティングテスト開始...\n');
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📝 テストケース ${i + 1}: "${testCase.query}"`);
    
    try {
      const analysis = await analyzer.analyze(testCase.query);
      console.log(`  📊 解析結果: ${JSON.stringify(analysis, null, 2)}`);
      
      const routingResult = await router.route(testCase.query, analysis);
      
      const success = 
        analysis.category === testCase.expected.category &&
        analysis.intent === testCase.expected.intent &&
        analysis.tone === testCase.expected.tone;
      
      // カテゴリ統計の更新
      if (!categoryStats[testCase.expected.category]) {
        categoryStats[testCase.expected.category] = { success: 0, total: 0 };
      }
      categoryStats[testCase.expected.category].total++;
      if (success) {
        categoryStats[testCase.expected.category].success++;
        successCount++;
      }
      
      console.log(`  🎯 ルーティング結果: ${JSON.stringify(routingResult, null, 2)}`);
      
      if (success) {
        console.log(`  ✅ 期待値と一致`);
      } else {
        console.log(`  ❌ 期待値と不一致: {
  expected: ${JSON.stringify(testCase.expected)},
  actual: ${JSON.stringify({
    category: analysis.category,
    intent: analysis.intent,
    tone: analysis.tone
  })}
}`);
      }
      
      if (routingResult.needsHumanReview) {
        humanReviewCount++;
        console.log(`  ⚠️  人間の確認が必要: ${routingResult.reviewReason}`);
        console.log(`  💡 推奨アクション: ${JSON.stringify(routingResult.suggestedActions)}`);
      }
      
    } catch (error) {
      console.error(`  ❌ テストエラー: ${error}`);
    }
  }
  
  // 結果サマリー
  console.log(`\n📊 拡張テスト結果サマリー`);
  console.log(`  総テスト数: ${testCases.length}`);
  console.log(`  成功: ${successCount}`);
  console.log(`  失敗: ${testCases.length - successCount}`);
  console.log(`  成功率: ${(successCount / testCases.length * 100).toFixed(1)}%`);
  console.log(`  人間確認必要: ${humanReviewCount}件`);
  console.log(`  人間確認率: ${(humanReviewCount / testCases.length * 100).toFixed(1)}%`);
  
  console.log(`\n📈 カテゴリ別統計`);
  Object.entries(categoryStats).forEach(([category, stats]) => {
    const rate = (stats.success / stats.total * 100).toFixed(1);
    console.log(`  ${category}: ${stats.success}/${stats.total} (${rate}%)`);
  });
  
  console.log(`\n🎯 Phase2拡張品質指標`);
  const directHitRate = (successCount / testCases.length * 100).toFixed(1);
  const correctionRate = (humanReviewCount / testCases.length * 100).toFixed(1);
  console.log(`  直撃率: ${directHitRate}%`);
  console.log(`  補正率: ${correctionRate}%`);
  
  const targetDirectHit = 80;
  const targetCorrection = 20;
  
  if (parseFloat(directHitRate) >= targetDirectHit) {
    console.log(`  ✅ 直撃率目標（${targetDirectHit}%以上）を達成`);
  } else {
    console.log(`  ❌ 直撃率目標（${targetDirectHit}%以上）未達成`);
  }
  
  if (parseFloat(correctionRate) <= targetCorrection) {
    console.log(`  ✅ 補正率目標（${targetCorrection}%以下）を達成`);
  } else {
    console.log(`  ❌ 補正率目標（${targetCorrection}%以下）未達成`);
  }
  
  console.log(`\n🎉 Phase2 拡張ルーティングテスト完了`);
  console.log(`\n👋 拡張テスト終了`);
} 