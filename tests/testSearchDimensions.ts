// tests/testSearchDimensions.ts
// console.log("****** tests/testSearchDimensions.ts LOADED ====");

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// ① require で直接読み込んでみる
let embModule: any;
try {
  // console.log("→ Attempting require('../src/lib/embeddings.ts')…");
  embModule = require('../src/lib/embeddings.ts');
  // console.log("→ require succeeded. Available exports:", Object.keys(embModule));
} catch (err) {
  console.error("!! require failed:", err);
  process.exit(1);
}

const { searchSimilarKnowledge } = embModule;

// console.log("→ searchSimilarKnowledge is", typeof searchSimilarKnowledge);

interface TestQuery {
  no: number;
  category: string;
  query: string;
  notes: string;
  expectedKnowledgeId?: number; // Optional: Expected correct Knowledge ID for accuracy calculation
}

const testQueries: TestQuery[] = [
  { no: 1, category: 'シンプル直接照合', query: '駐車場の予約方法を教えて', notes: '完全一致／FAQ型', expectedKnowledgeId: 140 },
  { no: 2, category: '言い換え（同義語）', query: '駐車スペースの事前申請はどうすればいいですか？', notes: '「予約」→「申請」', expectedKnowledgeId: 140 },
  { no: 3, category: '長文問い合わせ', query: '明日の朝８時から１２時まで車を止めておきたいんですが、どうやって予約できますか？', notes: '時間枠指定＋複数条件', expectedKnowledgeId: 140 },
  { no: 4, category: 'あいまい表現', query: '空きがあるか知りたい', notes: '「空き状況」はRAGで補う', expectedKnowledgeId: 1 },
  { no: 5, category: '拡張情報含む', query: 'クレジットカードで支払える駐車場予約の手順を教えて', notes: '支払い方法＋手順', expectedKnowledgeId: 6 },
  { no: 6, category: '略語／口語', query: 'Pmt方法は？', notes: '略語混合', expectedKnowledgeId: 79 },
  { no: 7, category: '地域指定', query: '東京駅周辺で一番安い駐車場の予約方法を教えて', notes: 'ロケーション要素' /* expectedKnowledgeId: "N/A" */ },
  { no: 8, category: 'オプション条件', query: '車高制限1.5m以下で予約できる駐車場は？', notes: 'フィルタ条件', expectedKnowledgeId: 39 },
  { no: 9, category: 'ネガティブケース（外部）', query: 'バス停留所の時刻表は？', notes: '完全にFAQ外／応答なし' /* expectedKnowledgeId: "N/A" */ },
  { no: 10, category: '複数Intent 混在', query: '予約の料金とキャンセル方法を知りたい', notes: '複合クエリ', expectedKnowledgeId: 113 },
  { no: 11, category: '類似質問（多様な切り口）', query: '予約状況の確認方法を教えて', notes: '「予約確認」 vs 「予約方法」', expectedKnowledgeId: 2 },
  { no: 12, category: '過去情報参照', query: '昨日予約した内容をキャンセルしたい', notes: '文脈推論／履歴参照', expectedKnowledgeId: 113 },
  { no: 13, category: 'フォローアップ質問', query: '予約した後、領収書は発行できますか？', notes: '連続する問い合わせ', expectedKnowledgeId: 69 },
  { no: 14, category: '経路案内＋予約', query: '空港行きシャトル駐車場までの行き方と予約方法を教えて', notes: 'RAGで地図／交通＋FAQ融合', expectedKnowledgeId: 140 },
  { no: 15, category: '長文＋曖昧', query: '週末に車を預けたいんですが、良さそうなところありますか？', notes: 'レコメンド型／あいまい', expectedKnowledgeId: 141 },
];

interface ResultRecord {
  queryNo: number;
  queryCategory: string;
  queryText: string;
  dimensions: number;
  efSearchValue?: number;
  responseTimeMs: number;
  top1_Id?: number;
  top1_Similarity?: number;
  top5_Ids_Similarities: string; // JSON string of {id: number, similarity: number}[]
  // Placeholders for accuracy metrics - to be filled after manual review or if expectedKnowledgeId is provided
  isTop1Correct?: boolean;
  isInTop5Correct?: boolean;
}

const now = new Date();
const year = now.getFullYear();
const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 月は0から始まるため+1
const day = now.getDate().toString().padStart(2, '0');
const dateString = `${year}-${month}-${day}`;

const baseOutputDir = path.join(__dirname, 'test_results'); // ベースの出力ディレクトリ
const datedOutputDir = path.join(baseOutputDir, dateString); // 日付ベースのサブディレクトリ

if (!fs.existsSync(datedOutputDir)) {
  fs.mkdirSync(datedOutputDir, { recursive: true }); // recursive: true で親ディレクトリも作成
}

const csvFileName = `embedding_performance_test_${now.getTime()}.csv`; // Date.now() の代わりに now.getTime() を使用
const csvFilePath = path.join(datedOutputDir, csvFileName);
const csvHeaders = [
  'queryNo', 'queryCategory', 'queryText', 'dimensions', 'efSearchValue',
  'responseTimeMs', 'top1_Id', 'top1_Similarity', 'top5_Ids_Similarities',
  'isTop1Correct', 'isInTop5Correct'
].join(',') + '\n';
fs.writeFileSync(csvFilePath, csvHeaders);

function formatForCsv(value: any): string {
  if (value === null || typeof value === 'undefined') return '';
  const str = String(value);
  // Escape double quotes and wrap in double quotes if it contains comma, double quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

(async () => {
  const prisma = new PrismaClient();
  const defaultLimit = 5; // We need top 5 for Recall@5
  const efSearchValuesToTest = [undefined, 32, 64, 100, 128]; // 拡張したefSearchテストパターン

  try {
    for (const testQuery of testQueries) {
      const dims = 1536; // 次元数を1536に固定
      for (const efSearch of efSearchValuesToTest) {
        console.log(`\n--- Testing Query No: ${testQuery.no} ("${testQuery.query}") ---`);
        // efSearchの表示を searchSimilarKnowledge のデフォルト値ロジックに合わせる
        const displayEfSearch = efSearch === undefined 
          ? (process.env.VECTOR_EFSEARCH_DEFAULT ? parseInt(process.env.VECTOR_EFSEARCH_DEFAULT, 10) : 100) 
          : efSearch;
        console.log(`Dimensions: ${dims}, efSearch: ${displayEfSearch}`);

        const startTime = process.hrtime();
        const searchResults = await searchSimilarKnowledge(testQuery.query, defaultLimit, efSearch, dims);
        const endTime = process.hrtime(startTime);
        const responseTimeMs = (endTime[0] * 1000) + (endTime[1] / 1000000);

        const top1Result = searchResults.length > 0 ? searchResults[0] : undefined;
        // Map to simple {id, similarity} for CSV and initial top5 log
        const top5PlainResults = searchResults.slice(0, 5).map(r => ({ id: r.id, similarity: parseFloat(r.similarity.toFixed(4)) }));

        // Fetch knowledge content for console logging
        const resultIds = top5PlainResults.map(r => r.id);
        let detailedResultsForConsole: any[] = [];
        if (resultIds.length > 0) {
          const knowledgeItems = await prisma.knowledge.findMany({
            where: { id: { in: resultIds } },
            select: { id: true, question: true, answer: true },
          });
          // Join search results with fetched content
          detailedResultsForConsole = top5PlainResults.map(searchRes => {
            const KItem = knowledgeItems.find(k => k.id === searchRes.id);
            return {
              ...searchRes,
              question: KItem?.question,
              answer: KItem?.answer?.substring(0, 100) + (KItem && KItem.answer && KItem.answer.length > 100 ? '...' : ''), // Truncate answer for brevity
            };
          });
        }

        const record: ResultRecord = {
          queryNo: testQuery.no,
          queryCategory: testQuery.category,
          queryText: testQuery.query,
          dimensions: dims,
          efSearchValue: efSearch,
          responseTimeMs: parseFloat(responseTimeMs.toFixed(2)),
          top1_Id: top1Result?.id,
          top1_Similarity: top1Result ? parseFloat(top1Result.similarity.toFixed(4)) : undefined,
          top5_Ids_Similarities: JSON.stringify(top5PlainResults), // Keep this as plain IDs and similarities for CSV
          isTop1Correct: testQuery.expectedKnowledgeId && top1Result ? top1Result.id === testQuery.expectedKnowledgeId : undefined,
          isInTop5Correct: testQuery.expectedKnowledgeId && top5PlainResults.some(r => r.id === testQuery.expectedKnowledgeId) ? true : (top5PlainResults.length > 0 ? false : undefined),
        };

        const csvRow = [
          record.queryNo,
          record.queryCategory,
          record.queryText,
          record.dimensions,
          record.efSearchValue,
          record.responseTimeMs,
          record.top1_Id,
          record.top1_Similarity,
          record.top5_Ids_Similarities,
          record.isTop1Correct,
          record.isInTop5Correct
        ].map(formatForCsv).join(',') + '\n';
        fs.appendFileSync(csvFilePath, csvRow);

        console.log(`Results for ${dims} dim:`);
        if (detailedResultsForConsole.length > 0) {
          detailedResultsForConsole.forEach(res => {
            console.log(`  - ID: ${res.id}, Similarity: ${res.similarity}`);
            console.log(`    Q: ${res.question || 'N/A'}`);
            console.log(`    A: ${res.answer || 'N/A'}`);
          });
        } else {
          console.log('  No results found.');
        }
        console.log(`Response Time: ${responseTimeMs.toFixed(2)} ms`);
      }
    }
    console.log(`\n--- All tests completed. Results saved to: ${csvFilePath} ---`);
  } catch (error) {
    console.error("Error during searchSimilarKnowledge tests:", error);
  } finally {
    await prisma.$disconnect();
  }
})().catch(err => {
  console.error("Unhandled error in runTest IIFE:", err);
  process.exit(1);
}); 