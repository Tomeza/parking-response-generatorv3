import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

interface TestResult {
  queryNo: number;
  queryCategory: string;
  queryText: string;
  dimensions: number;
  efSearchValue?: number; // CSVでは undefined もありうる
  responseTimeMs: number;
  top1_Id?: number;
  top1_Similarity?: number;
  top5_Ids_Similarities: string;
  isTop1Correct?: boolean; // CSVでは true, false, undefined (空文字)がありうる
  isInTop5Correct?: boolean; // CSVでは true, false, undefined (空文字)がありうる
}

interface ReportEntry {
  totalQueries: number;
  evaluatedQueries: number; // expectedKnowledgeId があったクエリ数
  recallAt1: number;
  recallAt5: number;
  averageLatency: number;
}

interface CategoryReport {
  [category: string]: {
    [efSearch: string]: ReportEntry; // efSearch値をキーとする (e.g., 'default', '32', '100')
    overall: ReportEntry; // カテゴリ全体の集計
  };
}

interface OverallReport {
    [efSearch: string]: ReportEntry;
    overall: ReportEntry;
}


async function parseCSV(filePath: string): Promise<TestResult[]> {
  return new Promise((resolve, reject) => {
    const results: TestResult[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // CSVから読み込んだ値の型変換
        const parsedData: any = {};
        parsedData.queryNo = parseInt(data.queryNo, 10);
        parsedData.queryCategory = data.queryCategory;
        parsedData.queryText = data.queryText;
        parsedData.dimensions = parseInt(data.dimensions, 10);
        parsedData.efSearchValue = data.efSearchValue === '' || data.efSearchValue === undefined ? undefined : parseInt(data.efSearchValue, 10);
        parsedData.responseTimeMs = parseFloat(data.responseTimeMs);
        parsedData.top1_Id = data.top1_Id === '' ? undefined : parseInt(data.top1_Id, 10);
        parsedData.top1_Similarity = data.top1_Similarity === '' ? undefined : parseFloat(data.top1_Similarity);
        parsedData.top5_Ids_Similarities = data.top5_Ids_Similarities;
        
        // boolean 値のパース: 'true'/'false' 文字列または空文字を boolean | undefined に
        if (data.isTop1Correct === 'true') parsedData.isTop1Correct = true;
        else if (data.isTop1Correct === 'false') parsedData.isTop1Correct = false;
        else parsedData.isTop1Correct = undefined;

        if (data.isInTop5Correct === 'true') parsedData.isInTop5Correct = true;
        else if (data.isInTop5Correct === 'false') parsedData.isInTop5Correct = false;
        else parsedData.isInTop5Correct = undefined;
        
        results.push(parsedData as TestResult);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function calculateMetrics(results: TestResult[]): ReportEntry {
    const evaluatedResults = results.filter(r => r.isTop1Correct !== undefined || r.isInTop5Correct !== undefined);
    const totalQueries = results.length;
    const evaluatedQueries = evaluatedResults.length;

    if (evaluatedQueries === 0) {
        return {
            totalQueries,
            evaluatedQueries,
            recallAt1: 0,
            recallAt5: 0,
            averageLatency: results.reduce((sum, r) => sum + r.responseTimeMs, 0) / (totalQueries || 1),
        };
    }

    const recallAt1Count = evaluatedResults.filter(r => r.isTop1Correct === true).length;
    const recallAt5Count = evaluatedResults.filter(r => r.isInTop5Correct === true).length;
    
    return {
        totalQueries,
        evaluatedQueries,
        recallAt1: recallAt1Count / evaluatedQueries,
        recallAt5: recallAt5Count / evaluatedQueries,
        averageLatency: results.reduce((sum, r) => sum + r.responseTimeMs, 0) / (totalQueries || 1),
    };
}


async function generateReport(dateString: string) {
  const resultsDir = path.join(__dirname, '..', 'tests', 'test_results', dateString);
  if (!fs.existsSync(resultsDir)) {
    console.error(`Directory not found: ${resultsDir}`);
    return;
  }

  const allResults: TestResult[] = [];
  const files = fs.readdirSync(resultsDir);
  for (const file of files) {
    if (file.startsWith('embedding_performance_test_') && file.endsWith('.csv')) {
      const filePath = path.join(resultsDir, file);
      try {
        const parsed = await parseCSV(filePath);
        allResults.push(...parsed);
      } catch (error) {
        console.error(`Error parsing CSV ${filePath}:`, error);
      }
    }
  }

  if (allResults.length === 0) {
    console.log('No test results found to generate a report.');
    return;
  }

  // 集計ロジック
  const categoryReport: CategoryReport = {};
  const overallReport: OverallReport = { overall: calculateMetrics(allResults) };


  // efSearchValueの実際の値を取得 (環境変数またはデフォルト100)
  const defaultEfSearchForDisplay = process.env.VECTOR_EFSEARCH_DEFAULT 
    ? parseInt(process.env.VECTOR_EFSEARCH_DEFAULT, 10) 
    : 100;

  const efSearchValues = [...new Set(allResults.map(r => r.efSearchValue))];

  for (const ef of efSearchValues) {
    const efKey = ef === undefined ? `default(${defaultEfSearchForDisplay})` : ef.toString();
    const resultsForEf = allResults.filter(r => r.efSearchValue === ef);
    if (resultsForEf.length > 0) {
        overallReport[efKey] = calculateMetrics(resultsForEf);
    }
  }
  
  const categories = [...new Set(allResults.map(r => r.queryCategory))];

  for (const category of categories) {
    categoryReport[category] = { overall: calculateMetrics(allResults.filter(r => r.queryCategory === category)) };
    for (const ef of efSearchValues) {
        const efKey = ef === undefined ? `default(${defaultEfSearchForDisplay})` : ef.toString();
        const resultsForCategoryAndEf = allResults.filter(r => r.queryCategory === category && r.efSearchValue === ef);
        if (resultsForCategoryAndEf.length > 0) {
            categoryReport[category][efKey] = calculateMetrics(resultsForCategoryAndEf);
        }
    }
  }

  // Markdown出力 (まずはコンソールに)
  console.log(`# Test Performance Report (${dateString})`);
  console.log('\n## Overall Summary by efSearch');
  console.log('| efSearch Value | Total Queries | Evaluated Queries | Recall@1 | Recall@5 | Avg. Latency (ms) |');
  console.log('|----------------|---------------|-------------------|----------|----------|-------------------|');
  
  Object.entries(overallReport).sort(([keyA], [keyB]) => keyA === 'overall' ? 1 : (keyB === 'overall' ? -1 : keyA.localeCompare(keyB, undefined, {numeric: true}))).forEach(([efKey, metrics]) => {
    console.log(`| ${efKey.padEnd(14)} | ${metrics.totalQueries.toString().padEnd(13)} | ${metrics.evaluatedQueries.toString().padEnd(17)} | ${(metrics.recallAt1 * 100).toFixed(2).padEnd(8)}% | ${(metrics.recallAt5 * 100).toFixed(2).padEnd(8)}% | ${metrics.averageLatency.toFixed(2).padEnd(17)} |`);
  });

  console.log('\n## Category Summary');
  for (const category of categories.sort()) {
    console.log(`\n### Category: ${category}`);
    console.log('| efSearch Value | Total Queries | Evaluated Queries | Recall@1 | Recall@5 | Avg. Latency (ms) |');
    console.log('|----------------|---------------|-------------------|----------|----------|-------------------|');
    
    const categoryEntries = categoryReport[category];
    Object.entries(categoryEntries).sort(([keyA], [keyB]) => keyA === 'overall' ? 1 : (keyB === 'overall' ? -1 : keyA.localeCompare(keyB, undefined, {numeric: true}))).forEach(([efKey, metrics]) => {
        console.log(`| ${efKey.padEnd(14)} | ${metrics.totalQueries.toString().padEnd(13)} | ${metrics.evaluatedQueries.toString().padEnd(17)} | ${(metrics.recallAt1 * 100).toFixed(2).padEnd(8)}% | ${(metrics.recallAt5 * 100).toFixed(2).padEnd(8)}% | ${metrics.averageLatency.toFixed(2).padEnd(17)} |`);
    });
  }
}

// スクリプト実行部分
const targetDate = process.argv[2]; // コマンドライン引数から日付を取得 (例: YYYY-MM-DD)
if (!targetDate) {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  console.log('No date provided. Generating report for today or latest available date. (Not implemented yet, please provide YYYY-MM-DD)');
  // TODO: 最新の日付フォルダを自動で見つけるロジックを追加するか、今日の日付で試行する
  // generateReport(`${year}-${month}-${day}`);
  console.error('Please provide a date in YYYY-MM-DD format as a command line argument.');
  process.exit(1);
} else if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    console.error('Invalid date format. Please use YYYY-MM-DD.');
    process.exit(1);
} else {
    generateReport(targetDate).catch(console.error);
} 