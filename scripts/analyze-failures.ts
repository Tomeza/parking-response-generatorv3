import { PrismaClient } from '@prisma/client';
import { QueryAnalyzer } from '../src/lib/query-analyzer';
import { TemplateRouter } from '../src/lib/template-router';

const prisma = new PrismaClient();

interface TestCase {
  query: string;
  expected: {
    category: string;
    intent: string;
    tone: string;
  };
}

const testCases: TestCase[] = [
  {
    query: "送迎サービスの時間を教えてください",
    expected: { category: "shuttle", intent: "inquiry", tone: "normal" }
  },
  {
    query: "バリアフリー設備の確認をお願いします",
    expected: { category: "facility", intent: "check", tone: "normal" }
  },
  {
    query: "設備の故障を報告します",
    expected: { category: "facility", intent: "report", tone: "urgent" }
  },
  {
    query: "設備の利用可能時間を確認したい",
    expected: { category: "facility", intent: "check", tone: "normal" }
  },
  {
    query: "駐車券を紛失しました",
    expected: { category: "trouble", intent: "report", tone: "normal" }
  },
  {
    query: "車両の種類別料金を教えてください",
    expected: { category: "vehicle", intent: "inquiry", tone: "normal" }
  },
  {
    query: "車両の高さ制限を確認したい",
    expected: { category: "vehicle", intent: "check", tone: "normal" }
  },
  {
    query: "予約の変更手続きを教えてください",
    expected: { category: "reservation", intent: "modify", tone: "normal" }
  },
  {
    query: "ナビゲーションの設定方法を確認したい",
    expected: { category: "access", intent: "check", tone: "normal" }
  },
  {
    query: "軽自動車の料金を教えてください",
    expected: { category: "vehicle", intent: "inquiry", tone: "normal" }
  }
];

async function analyzeFailures() {
  const analyzer = new QueryAnalyzer();
  const router = new TemplateRouter();

  console.log('🔍 失敗ケース詳細分析\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📝 テストケース ${i + 1}: "${testCase.query}"`);
    
    try {
      // クエリ分析
      const analysis = await analyzer.analyze(testCase.query);
      
      // 各カテゴリのスコア計算
      const categoryScores = await analyzer.getCategoryScores(testCase.query);
      
      // テンプレート検索
      const result = await router.route(analysis);
      
      console.log(`   Gold: ${testCase.expected.category}/${testCase.expected.intent}/${testCase.expected.tone}`);
      console.log(`   Predicted: ${analysis.category}/${analysis.intent}/${analysis.tone}`);
      
      // カテゴリスコア表示
      console.log('   📊 カテゴリスコア:');
      Object.entries(categoryScores).forEach(([category, score]) => {
        console.log(`      ${category}: ${score}`);
      });
      
      // ヒットしたキーワード表示
      console.log('   🎯 ヒットキーワード:');
      const hitKeywords = await analyzer.getHitKeywords(testCase.query);
      Object.entries(hitKeywords).forEach(([category, keywords]) => {
        if (keywords.length > 0) {
          console.log(`      ${category}:`);
          keywords.forEach(keyword => {
            console.log(`        ${keyword.type}: ${keyword.word}`);
          });
        }
      });
      
      // 最終テンプレート情報
      if (result.template) {
        console.log('   📋 最終テンプレート:');
        console.log(`      ID: ${result.template.id}`);
        console.log(`      Title: ${result.template.title}`);
        console.log(`      UsageLabel: ${result.template.usageLabel || 'N/A'}`);
        console.log(`      Updated: ${result.template.updated_at}`);
      }
      
      // 成功/失敗判定
      const isSuccess = 
        analysis.category === testCase.expected.category &&
        analysis.intent === testCase.expected.intent &&
        analysis.tone === testCase.expected.tone;
      
      console.log(`   ${isSuccess ? '✅' : '❌'} ${isSuccess ? '成功' : '失敗'}`);
      
    } catch (error) {
      console.log(`   ❌ エラー: ${error}`);
    }
    
    console.log('');
  }
}

analyzeFailures()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 