const { PrismaClient } = require('@prisma/client');
const { searchKnowledge } = require('../lib/search');

interface SearchResult {
  id: number;
  score?: number;
  question?: string;
  is_template?: boolean;
}

const prisma = new PrismaClient();

const testQueries = [
  // 基本的な予約方法の質問
  "予約方法を教えてください",
  "予約の仕方を教えてください",
  "予約の手順を教えてください",
  "どうやって予約すればいいですか",

  // 具体的な予約方法の質問
  "オンラインで予約する方法を教えてください",
  "ネット予約のやり方を教えてください",
  "ウェブサイトでの予約方法を教えてください",
  "インターネットで予約する手順を教えてください",

  // 予約に関する一般的な質問
  "予約はどうすればできますか",
  "予約の方法について知りたいです",
  "予約の仕組みを教えてください",
  "予約システムの使い方を教えてください",

  // 予約開始時期に関する質問
  "予約はいつからできますか",
  "予約の受付開始時期を教えてください",
  "予約の申し込み時期について教えてください",
  "予約の受け付けはいつからですか",

  // 予約に関する詳細な質問
  "予約時の注意点を教えてください",
  "予約する際の確認事項を教えてください",
  "予約時の必要情報を教えてください",
  "予約時の入力項目について教えてください"
];

interface TestResult {
  query: string;
  topResult: {
    id: number;
    score: number;
    question: string;
    is_template: boolean;
  };
  responseTime: number;
  allResults: Array<{
    id: number;
    score: number;
    question: string;
  }>;
}

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const query of testQueries) {
    console.log(`\nテストクエリ実行中: "${query}"`);
    
    const startTime = Date.now();
    const searchResults = await searchKnowledge(query) as SearchResult[];
    const endTime = Date.now();
    
    const responseTime = endTime - startTime;
    
    const result: TestResult = {
      query,
      topResult: {
        id: searchResults[0]?.id || 0,
        score: searchResults[0]?.score || 0,
        question: searchResults[0]?.question || '',
        is_template: searchResults[0]?.is_template || false
      },
      responseTime,
      allResults: searchResults.slice(0, 3).map((r: SearchResult) => ({
        id: r.id,
        score: r.score || 0,
        question: r.question || ''
      }))
    };

    results.push(result);
    
    // 結果の表示
    console.log(`レスポンス時間: ${responseTime}ms`);
    console.log(`トップ結果: ID=${result.topResult.id}, スコア=${result.topResult.score}`);
    console.log(`質問: ${result.topResult.question}`);
    console.log(`テンプレート: ${result.topResult.is_template ? 'はい' : 'いいえ'}`);
    console.log('上位3件の結果:');
    result.allResults.forEach((r, i) => {
      console.log(`${i + 1}. ID=${r.id}, スコア=${r.score}: ${r.question}`);
    });
  }

  return results;
}

async function main() {
  try {
    console.log('予約方法のテストクエリ検証を開始します...\n');
    const results = await runTests();
    
    // 結果の分析
    const successCount = results.filter(r => r.topResult.id === 1).length;
    const avgResponseTime = results.reduce((acc, r) => acc + r.responseTime, 0) / results.length;
    
    console.log('\n=== テスト結果サマリー ===');
    console.log(`総テスト数: ${results.length}`);
    console.log(`成功数（ID:1が最上位）: ${successCount}`);
    console.log(`成功率: ${(successCount / results.length * 100).toFixed(1)}%`);
    console.log(`平均レスポンス時間: ${avgResponseTime.toFixed(1)}ms`);
    
    // 失敗したケースの詳細
    const failures = results.filter(r => r.topResult.id !== 1);
    if (failures.length > 0) {
      console.log('\n=== 失敗したケース ===');
      failures.forEach(f => {
        console.log(`\nクエリ: "${f.query}"`);
        console.log(`実際のトップ結果: ID=${f.topResult.id}, スコア=${f.topResult.score}`);
        console.log(`質問: ${f.topResult.question}`);
      });
    }
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 