import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { searchKnowledge } from '../lib/search';

const prisma = new PrismaClient();

interface TestQuery {
  query: string;
  expectedTags?: string[];
  category?: string;
  results?: any[];
}

/**
 * テストクエリファイルをパースして、クエリリストを抽出する
 */
async function parseTestQueries(filePath: string): Promise<TestQuery[]> {
  // ファイルを読み込む
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 各行をクエリとして解析
  const lines = content.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^["「]|["」]$/g, '')); // 「」や""を削除
  
  // TestQueryオブジェクトの配列に変換
  const testQueries: TestQuery[] = lines.map(line => ({
    query: line,
    expectedTags: guessExpectedTags(line),
    category: guessCategory(line)
  }));
  
  return testQueries;
}

/**
 * クエリからカテゴリを推測
 */
function guessCategory(query: string): string {
  if (query.includes('予約') || query.includes('キャンセル') || query.includes('変更')) {
    return '予約関連';
  } else if (query.includes('送迎') || query.includes('人数') || query.includes('定員')) {
    return '送迎関連';
  } else if (query.includes('国際線') || query.includes('外車') || query.includes('大型車')) {
    return '利用制限';
  } else if (query.includes('営業時間') || query.includes('時間')) {
    return '営業情報';
  } else if (query.includes('料金') || query.includes('計算')) {
    return '料金';
  } else if (query.includes('駐車場') || query.includes('利用手順')) {
    return '利用の流れ';
  }
  
  return '一般';
}

/**
 * クエリから予測されるタグを推測
 */
function guessExpectedTags(query: string): string[] {
  const tags: string[] = [];
  
  if (query.includes('予約')) tags.push('予約');
  if (query.includes('キャンセル')) tags.push('キャンセル');
  if (query.includes('変更')) tags.push('変更');
  if (query.includes('国際線')) tags.push('国際線');
  if (query.includes('送迎')) tags.push('送迎');
  if (query.includes('料金')) tags.push('料金');
  if (query.includes('営業時間')) tags.push('営業時間');
  if (query.includes('荷物')) tags.push('荷物');
  if (query.includes('繁忙期')) tags.push('繁忙期');
  if (query.includes('満車')) tags.push('満車');
  if (query.includes('アクセス')) tags.push('アクセス');
  
  return tags;
}

/**
 * 各テストクエリを実行して結果を記録
 */
async function runTestQueries(testQueries: TestQuery[]): Promise<TestQuery[]> {
  const results: TestQuery[] = [];
  
  for (const [index, query] of testQueries.entries()) {
    console.log(`[${index + 1}/${testQueries.length}] テスト: "${query.query}"`);
    
    try {
      // 検索を実行
      const searchResult = await searchKnowledge(query.query);
      
      // 結果を記録
      results.push({
        ...query,
        results: searchResult ? searchResult.results.slice(0, 3) : []
      });
      
      // 結果のサマリを表示
      if (searchResult && searchResult.results.length > 0) {
        console.log(`  ✅ ${searchResult.results.length}件の結果が見つかりました`);
        console.log(`  🔝 最上位の回答: ID=${searchResult.results[0].id}, カテゴリ=${searchResult.results[0].main_category}/${searchResult.results[0].sub_category}`);
      } else {
        console.log('  ❌ 結果が見つかりませんでした');
      }
    } catch (error) {
      console.error(`  ❌ エラー: ${error}`);
      results.push({
        ...query,
        results: []
      });
    }
    
    // 少し待機（APIリクエストが連続しすぎないように）
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * テスト結果をJSONファイルに保存
 */
function saveTestResults(results: TestQuery[], outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`テスト結果を${outputPath}に保存しました`);
}

/**
 * テスト結果をCSVファイルに保存
 */
function saveTestResultsCSV(results: TestQuery[], outputPath: string): void {
  // ヘッダー
  let csv = 'Query,ExpectedTags,Category,ResultCount,TopResultID,TopResultScore,TopResultCategory,TopResultAnswer\n';
  
  // 各行のデータ
  for (const result of results) {
    const topResult = result.results && result.results.length > 0 ? result.results[0] : null;
    
    csv += [
      `"${result.query}"`,
      `"${result.expectedTags?.join(',') || ''}"`,
      `"${result.category || ''}"`,
      result.results?.length || 0,
      topResult?.id || '',
      topResult?.final_score || '',
      `"${topResult ? `${topResult.main_category}/${topResult.sub_category}` : ''}"`,
      `"${topResult?.answer?.replace(/"/g, '""') || ''}"` // CSVでダブルクォートをエスケープ
    ].join(',') + '\n';
  }
  
  fs.writeFileSync(outputPath, csv);
  console.log(`テスト結果を${outputPath}に保存しました`);
}

/**
 * メイン関数
 */
async function main() {
  try {
    // 入力ファイルと出力ファイルのパス
    const inputPath = path.join(__dirname, '../../data/test-Q.txt');
    const outputJsonPath = path.join(__dirname, '../../data/test-results.json');
    const outputCsvPath = path.join(__dirname, '../../data/test-results.csv');
    
    // テストクエリをパース
    const testQueries = await parseTestQueries(inputPath);
    console.log(`${testQueries.length}件のテストクエリを解析しました`);
    
    // 各クエリをテスト実行
    const testResults = await runTestQueries(testQueries);
    
    // 結果を保存
    saveTestResults(testResults, outputJsonPath);
    saveTestResultsCSV(testResults, outputCsvPath);
    
    // テスト成功率を計算
    const successfulTests = testResults.filter(test => test.results && test.results.length > 0);
    console.log(`テスト完了: ${successfulTests.length}/${testResults.length} (${Math.round(successfulTests.length / testResults.length * 100)}%) のクエリが結果を返しました`);
    
    // カテゴリ別の統計
    const categoryCounts: Record<string, { total: number, success: number }> = {};
    testResults.forEach(test => {
      const category = test.category || '未分類';
      if (!categoryCounts[category]) {
        categoryCounts[category] = { total: 0, success: 0 };
      }
      
      categoryCounts[category].total++;
      if (test.results && test.results.length > 0) {
        categoryCounts[category].success++;
      }
    });
    
    console.log('カテゴリ別統計:');
    Object.entries(categoryCounts).forEach(([category, { total, success }]) => {
      console.log(`  ${category}: ${success}/${total} (${Math.round(success / total * 100)}%)`);
    });
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトの実行
main(); 