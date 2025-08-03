const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 検証データセット
const testCases = [
  {
    query: "駐車場の予約を確認したい",
    expectedCategory: "reservation",
    expectedIntent: "check", 
    expectedTone: "normal",
    expectedTemplate: "予約確認_通常",
    expectedConfidence: 0.6,
    description: "基本予約確認"
  },
  {
    query: "支払い方法を教えて",
    expectedCategory: "payment",
    expectedIntent: "inquiry",
    expectedTone: "normal", 
    expectedTemplate: "支払い問い合わせ_通常",
    expectedConfidence: 0.6,
    description: "支払い方法問い合わせ"
  },
  {
    query: "送迎サービスを利用したい",
    expectedCategory: "shuttle",
    expectedIntent: "inquiry", 
    expectedTone: "normal",
    expectedTemplate: "送迎問い合わせ_通常",
    expectedConfidence: 0.6,
    description: "送迎サービス問い合わせ"
  },
  {
    query: "緊急で駐車場の予約が必要です",
    expectedCategory: "reservation",
    expectedIntent: "create",
    expectedTone: "urgent",
    expectedTemplate: "予約作成_緊急",
    expectedConfidence: 0.6,
    description: "緊急予約作成"
  },
  {
    query: "設備の故障を報告します",
    expectedCategory: "facility",
    expectedIntent: "report",
    expectedTone: "urgent",
    expectedTemplate: "設備故障_緊急",
    expectedConfidence: 0.6,
    description: "設備故障報告"
  },
  {
    query: "将来の料金体系について知りたい",
    expectedCategory: "payment",
    expectedIntent: "check",
    expectedTone: "future",
    expectedTemplate: "料金確認_将来",
    expectedConfidence: 0.6,
    description: "将来料金確認"
  }
];

// 検証結果の集計
const verificationResults = {
  sensingAccuracy: {
    total: 0,
    correct: 0,
    categoryAccuracy: 0,
    intentAccuracy: 0,
    toneAccuracy: 0
  },
  routingAccuracy: {
    total: 0,
    exactMatch: 0,
    partialMatch: 0,
    fallbackUsed: 0,
    noMatch: 0
  },
  performance: {
    avgProcessingTime: 0,
    totalTests: 0
  }
};

async function runVerificationSuite() {
  console.log('🚀 設計思想に基づく検証スイート開始');
  console.log('=' * 50);
  
  for (const testCase of testCases) {
    console.log(`\n📋 テストケース: ${testCase.description}`);
    console.log(`入力: "${testCase.query}"`);
    
    // API呼び出し
    const response = await callAnalyzeAPI(testCase.query);
    
    if (response) {
      // センシング精度の検証
      verifySensingAccuracy(response.analysis, testCase);
      
      // ルーティング精度の検証  
      verifyRoutingAccuracy(response.routing, testCase);
      
      // パフォーマンス記録
      recordPerformance(response.routing.processingTimeMs);
    }
  }
  
  // 結果集計とレポート
  generateVerificationReport();
}

async function callAnalyzeAPI(query) {
  try {
    const response = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    
    return await response.json();
  } catch (error) {
    console.error(`API呼び出しエラー: ${error.message}`);
    return null;
  }
}

function verifySensingAccuracy(analysis, expected) {
  verificationResults.sensingAccuracy.total++;
  
  const categoryMatch = analysis.category === expected.expectedCategory;
  const intentMatch = analysis.intent === expected.expectedIntent;
  const toneMatch = analysis.tone === expected.expectedTone;
  
  if (categoryMatch) verificationResults.sensingAccuracy.categoryAccuracy++;
  if (intentMatch) verificationResults.sensingAccuracy.intentAccuracy++;
  if (toneMatch) verificationResults.sensingAccuracy.toneAccuracy++;
  
  const allMatch = categoryMatch && intentMatch && toneMatch;
  if (allMatch) verificationResults.sensingAccuracy.correct++;
  
  console.log(`  🔍 センシング精度:`);
  console.log(`     カテゴリ: ${analysis.category} ${categoryMatch ? '✅' : '❌'} (期待: ${expected.expectedCategory})`);
  console.log(`     意図: ${analysis.intent} ${intentMatch ? '✅' : '❌'} (期待: ${expected.expectedIntent})`);
  console.log(`     トーン: ${analysis.tone} ${toneMatch ? '✅' : '❌'} (期待: ${expected.expectedTone})`);
  console.log(`     信頼度: ${(analysis.confidence * 100).toFixed(1)}%`);
}

function verifyRoutingAccuracy(routing, expected) {
  verificationResults.routingAccuracy.total++;
  
  if (routing.template) {
    const exactMatch = routing.template.title === expected.expectedTemplate;
    const categoryMatch = routing.template.category === expected.expectedCategory;
    
    if (exactMatch) {
      verificationResults.routingAccuracy.exactMatch++;
      console.log(`  🎯 ルーティング精度: 直撃 ✅`);
    } else if (categoryMatch) {
      verificationResults.routingAccuracy.partialMatch++;
      console.log(`  🎯 ルーティング精度: 部分一致 ⚠️`);
    } else {
      verificationResults.routingAccuracy.fallbackUsed++;
      console.log(`  🎯 ルーティング精度: フォールバック 🔄`);
    }
    
    console.log(`     選択テンプレート: ${routing.template.title}`);
    console.log(`     信頼度: ${(routing.confidence * 100).toFixed(1)}%`);
    console.log(`     処理時間: ${routing.processingTimeMs}ms`);
  } else {
    verificationResults.routingAccuracy.noMatch++;
    console.log(`  🎯 ルーティング精度: マッチなし ❌`);
  }
}

function recordPerformance(processingTime) {
  verificationResults.performance.totalTests++;
  verificationResults.performance.avgProcessingTime += processingTime;
}

function generateVerificationReport() {
  console.log('\n' + '=' * 50);
  console.log('📊 検証レポート');
  console.log('=' * 50);
  
  const total = verificationResults.sensingAccuracy.total;
  
  // センシング精度レポート
  console.log('\n🔍 【芯】センシング精度');
  console.log(`総テスト数: ${total}`);
  console.log(`完全一致率: ${((verificationResults.sensingAccuracy.correct / total) * 100).toFixed(1)}%`);
  console.log(`カテゴリ精度: ${((verificationResults.sensingAccuracy.categoryAccuracy / total) * 100).toFixed(1)}%`);
  console.log(`意図精度: ${((verificationResults.sensingAccuracy.intentAccuracy / total) * 100).toFixed(1)}%`);
  console.log(`トーン精度: ${((verificationResults.sensingAccuracy.toneAccuracy / total) * 100).toFixed(1)}%`);
  
  // ルーティング精度レポート
  console.log('\n🎯 【軸】ルーティング精度');
  console.log(`総テスト数: ${total}`);
  console.log(`直撃率: ${((verificationResults.routingAccuracy.exactMatch / total) * 100).toFixed(1)}%`);
  console.log(`部分一致率: ${((verificationResults.routingAccuracy.partialMatch / total) * 100).toFixed(1)}%`);
  console.log(`フォールバック率: ${((verificationResults.routingAccuracy.fallbackUsed / total) * 100).toFixed(1)}%`);
  console.log(`マッチなし率: ${((verificationResults.routingAccuracy.noMatch / total) * 100).toFixed(1)}%`);
  
  // パフォーマンスレポート
  console.log('\n⚡ パフォーマンス');
  const avgTime = verificationResults.performance.avgProcessingTime / verificationResults.performance.totalTests;
  console.log(`平均処理時間: ${avgTime.toFixed(1)}ms`);
  
  // 改善提案
  console.log('\n💡 改善提案');
  if (verificationResults.sensingAccuracy.correct / total < 0.8) {
    console.log('- センシング精度の向上が必要です');
  }
  if (verificationResults.routingAccuracy.exactMatch / total < 0.7) {
    console.log('- テンプレートマッチングの改善が必要です');
  }
  if (avgTime > 1000) {
    console.log('- 処理時間の最適化が必要です');
  }
  
  console.log('\n✅ 検証完了！');
}

// 実行
runVerificationSuite().catch(console.error); 