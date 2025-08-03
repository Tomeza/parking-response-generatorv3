import { QueryAnalyzer } from '../src/lib/query-analyzer';
import { TemplateRouter } from '../src/lib/template-router';

const analyzer = new QueryAnalyzer();
const router = new TemplateRouter();

interface RegressionTestCase {
  query: string;
  expected: {
    category: string;
    intent: string;
    tone: string;
    urgency: string;
  };
  description: string;
}

const regressionTests: RegressionTestCase[] = [
  {
    query: "駐車券を紛失しました",
    expected: {
      category: "trouble",
      intent: "report",
      tone: "normal",
      urgency: "medium"
    },
    description: "紛失は通常対応（緊急ではない）"
  },
  {
    query: "現金での支払いのみ可能ですか",
    expected: {
      category: "payment",
      intent: "inquiry",
      tone: "normal",
      urgency: "low"
    },
    description: "「のみ可能ですか」は問い合わせ"
  },
  {
    query: "精算機の使い方を教えてください",
    expected: {
      category: "facility",
      intent: "inquiry",
      tone: "normal",
      urgency: "low"
    },
    description: "設備キーワードでfacilityに分類"
  },
  {
    query: "軽自動車の料金を教えてください",
    expected: {
      category: "vehicle",
      intent: "inquiry",
      tone: "normal",
      urgency: "low"
    },
    description: "料金×車両でvehicleに分類"
  },
  {
    query: "設備の故障を報告します",
    expected: {
      category: "facility",
      intent: "report",
      tone: "urgent",
      urgency: "high"
    },
    description: "故障は緊急対応"
  }
];

async function runRegressionTests() {
  console.log('🧪 回帰テスト開始\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of regressionTests) {
    console.log(`📝 ${testCase.description}`);
    console.log(`   クエリ: "${testCase.query}"`);
    
    try {
      const analysis = await analyzer.analyze(testCase.query);
      const template = await router.route(testCase.query, analysis);
      
      const results = {
        category: analysis.category,
        intent: analysis.intent,
        tone: analysis.tone,
        urgency: analysis.urgency
      };
      
      const isPass = 
        results.category === testCase.expected.category &&
        results.intent === testCase.expected.intent &&
        results.tone === testCase.expected.tone &&
        results.urgency === testCase.expected.urgency;
      
      if (isPass) {
        console.log('   ✅ 合格');
        passed++;
      } else {
        console.log('   ❌ 不合格');
        console.log(`      期待: ${JSON.stringify(testCase.expected)}`);
        console.log(`      実際: ${JSON.stringify(results)}`);
        failed++;
      }
      
      console.log(`      テンプレート: ${template?.title || 'なし'}\n`);
      
    } catch (error) {
      console.log('   ❌ エラー:', error);
      failed++;
    }
  }
  
  console.log('📊 回帰テスト結果');
  console.log(`   合格: ${passed}`);
  console.log(`   不合格: ${failed}`);
  console.log(`   成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 すべての回帰テストが合格しました！');
  } else {
    console.log('\n⚠️  一部のテストが不合格です。');
  }
}

runRegressionTests().catch(console.error); 