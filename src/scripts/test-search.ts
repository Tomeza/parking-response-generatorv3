import { PrismaClient, Prisma } from '@prisma/client';
import { extractKeywords, analyzeText } from '../lib/tokenizer';

const prisma = new PrismaClient();

// テストケース
const testQueries = [
  {
    query: '駐車場の予約方法を教えてください',
    expectedKeywords: ['予約', '方法', '駐車場'],
  },
  {
    query: '明日の予約をキャンセルしたいのですが、どうすればいいですか？',
    expectedKeywords: ['予約', 'キャンセル'],
  },
  {
    query: '車を停めた後、どうやって建物に入ればいいですか？',
    expectedKeywords: ['車', '建物', '入る'],
  },
  {
    query: '支払い方法は現金以外にどんな方法がありますか？',
    expectedKeywords: ['支払い', '方法', '現金'],
  },
  {
    query: '8月15日に利用予定ですが、混雑していますか？',
    expectedKeywords: ['利用', '混雑', '8月15日'],
  },
];

// 従来の検索方法でのテスト
async function testTraditionalSearch(query: string) {
  console.log(`\n従来の検索方法: "${query}"`);
  
  const tokens = query.replace(/[、。！？]/g, ' ').split(/\s+/).filter(token => token.length > 0);
  console.log('トークン:', tokens);
  
  const startTime = Date.now();
  
  const results = await prisma.knowledge.findMany({
    where: {
      OR: [
        { question: { contains: query } },
        { answer: { contains: query } },
        ...tokens.map(token => ({
          OR: [
            { question: { contains: token } },
            { answer: { contains: token } },
            { main_category: { contains: token } },
            { sub_category: { contains: token } },
            { detail_category: { contains: token } },
          ],
        })),
      ],
    },
    take: 5,
  });
  
  const endTime = Date.now();
  
  console.log(`検索結果: ${results.length}件`);
  console.log(`実行時間: ${endTime - startTime}ms`);
  
  return results;
}

// 全文検索でのテスト
async function testFullTextSearch(query: string) {
  console.log(`\n全文検索: "${query}"`);
  
  // 形態素解析
  const keywords = await extractKeywords(query);
  console.log('抽出キーワード:', keywords);
  
  const analyzedText = await analyzeText(query);
  const weightedKeywords = analyzedText
    .filter(item => item.weight >= 1.0)
    .map(item => item.keyword);
  
  console.log('重み付けキーワード:', weightedKeywords);
  
  // tsqueryの構築
  const tsQuery = weightedKeywords.length > 0 
    ? weightedKeywords.join(' | ') 
    : query.replace(/\s+/g, ' | ');
  
  console.log('tsQuery:', tsQuery);
  
  const startTime = Date.now();
  
  // 全文検索の実行
  const rawQuery = Prisma.sql`
    SELECT 
      k.id, 
      k.main_category, 
      k.sub_category, 
      k.detail_category, 
      k.question, 
      k.answer, 
      k.is_template, 
      k.usage, 
      k.note, 
      k.issue,
      ts_rank(k.search_vector, to_tsquery('japanese', ${tsQuery})) AS rank
    FROM "Knowledge" k
    WHERE k.search_vector @@ to_tsquery('japanese', ${tsQuery})
    ORDER BY rank DESC
    LIMIT 5
  `;
  
  const results = await prisma.$queryRaw(rawQuery);
  
  const endTime = Date.now();
  
  console.log(`検索結果: ${(results as any[]).length}件`);
  console.log(`実行時間: ${endTime - startTime}ms`);
  
  return results;
}

// メイン関数
async function main() {
  console.log('全文検索テストを開始します...');
  
  for (const testCase of testQueries) {
    console.log('\n==================================================');
    console.log(`テストケース: "${testCase.query}"`);
    console.log('期待されるキーワード:', testCase.expectedKeywords);
    
    // 従来の検索方法でのテスト
    const traditionalResults = await testTraditionalSearch(testCase.query);
    
    // 全文検索でのテスト
    const fullTextResults = await testFullTextSearch(testCase.query);
    
    // 結果の比較
    console.log('\n結果の比較:');
    console.log(`従来の検索方法: ${traditionalResults.length}件`);
    console.log(`全文検索: ${(fullTextResults as any[]).length}件`);
    
    // 従来の検索結果のIDリスト
    const traditionalIds = traditionalResults.map(r => r.id);
    
    // 全文検索結果のIDリスト
    const fullTextIds = (fullTextResults as any[]).map(r => r.id);
    
    // 一致する結果の数
    const matchingIds = traditionalIds.filter(id => fullTextIds.includes(id));
    console.log(`一致する結果: ${matchingIds.length}件`);
    
    // 全文検索のみで見つかった結果
    const uniqueToFullText = fullTextIds.filter(id => !traditionalIds.includes(id));
    console.log(`全文検索のみで見つかった結果: ${uniqueToFullText.length}件`);
    
    // 従来の検索方法のみで見つかった結果
    const uniqueToTraditional = traditionalIds.filter(id => !fullTextIds.includes(id));
    console.log(`従来の検索方法のみで見つかった結果: ${uniqueToTraditional.length}件`);
  }
  
  await prisma.$disconnect();
}

// スクリプトの実行
main()
  .catch(e => {
    console.error('エラーが発生しました:', e);
    process.exit(1);
  }); 