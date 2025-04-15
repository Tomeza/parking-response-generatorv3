const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// PGroongaを使った検索関数の簡易版実装
async function searchKnowledge(query) {
  const normalizedQuery = query.trim();
  
  if (!normalizedQuery) {
    return [];
  }
  
  try {
    console.log('検索クエリ:', normalizedQuery);
    
    // --- 基本検索 ---
    // 外車関連の特別検索
    if (normalizedQuery.toLowerCase().includes('外車') || 
        normalizedQuery.toLowerCase().includes('レクサス') ||
        normalizedQuery.toLowerCase().includes('bmw') ||
        normalizedQuery.toLowerCase().includes('ベンツ') ||
        normalizedQuery.toLowerCase().includes('高級車')) {
      
      console.log('外車関連の専用検索を実行中...');
      
      const results = await prisma.knowledge.findMany({
        where: {
          OR: [
            { main_category: { contains: '利用制限', mode: 'insensitive' } },
            { sub_category: { contains: '車両制限', mode: 'insensitive' } },
            { sub_category: { contains: '保険対象', mode: 'insensitive' } },
            { question: { contains: '外車', mode: 'insensitive' } },
            { question: { contains: 'レクサス', mode: 'insensitive' } },
            { answer: { contains: '外車', mode: 'insensitive' } },
            { answer: { contains: 'レクサス', mode: 'insensitive' } },
            { answer: { contains: '高級車', mode: 'insensitive' } }
          ]
        },
        orderBy: {
          id: 'asc'
        },
        take: 10
      });
      
      const enhancedResults = results.map(r => ({
        ...r,
        score: 0.9,
        note: '外車関連の専用検索で見つかりました'
      }));
      
      return enhancedResults;
    }
    
    // 国際線関連の特別検索
    if (normalizedQuery.toLowerCase().includes('国際線') || 
        normalizedQuery.toLowerCase().includes('インターナショナル') ||
        normalizedQuery.toLowerCase().includes('海外便')) {
      
      console.log('国際線関連の専用検索を実行中...');
      
      const results = await prisma.knowledge.findMany({
        where: {
          OR: [
            { main_category: { contains: '利用制限', mode: 'insensitive' } },
            { sub_category: { contains: '利用範囲', mode: 'insensitive' } },
            { detail_category: { contains: '国際線', mode: 'insensitive' } },
            { question: { contains: '国際線', mode: 'insensitive' } },
            { answer: { contains: '国際線', mode: 'insensitive' } },
            { answer: { contains: '国内線', mode: 'insensitive' } }
          ]
        },
        orderBy: {
          id: 'asc'
        },
        take: 10
      });
      
      const enhancedResults = results.map(r => ({
        ...r,
        score: 0.9,
        note: '国際線関連の専用検索で見つかりました'
      }));
      
      return enhancedResults;
    }
    
    // 一般的な検索（外車/国際線以外）
    const results = await prisma.knowledge.findMany({
      where: {
        OR: [
          { question: { contains: normalizedQuery, mode: 'insensitive' } },
          { answer: { contains: normalizedQuery, mode: 'insensitive' } },
          { main_category: { contains: normalizedQuery, mode: 'insensitive' } },
          { sub_category: { contains: normalizedQuery, mode: 'insensitive' } }
        ]
      },
      take: 10
    });
    
    const enhancedResults = results.map(r => ({
      ...r,
      score: 0.7,
      note: '基本検索で見つかりました'
    }));
    
    return enhancedResults;
    
  } catch (error) {
    console.error('検索エラー:', error);
    return [];
  }
}

async function testSpecialQueries() {
  const specialQueries = [
    // 外車関連のクエリ
    '外車の駐車は可能ですか？',
    'レクサスは駐車できますか？',
    'BMWで駐車場を利用できますか？',
    '高級車でも駐車できますか？',
    '外車でも使えますか？',
    
    // 国際線関連のクエリ
    '国際線を利用したいのですが？',
    '国際線ターミナルまで送迎してもらえますか？',
    'インターナショナルの飛行機に乗る予定です',
    '海外便を利用したいです',
    '国際線利用者でも予約できますか？',
    
    // 混合クエリ
    '外車で国際線利用の場合は可能ですか？',
    'レクサスで国際線を利用したいのですが'
  ];
  
  console.log('===== 特別テストクエリの検索結果 =====\n');
  
  for (const query of specialQueries) {
    console.log(`\n----- クエリ: "${query}" -----`);
    
    try {
      const results = await searchKnowledge(query);
      
      console.log(`検索結果数: ${results.length}`);
      
      if (results.length > 0) {
        // 最初の3件の結果を表示
        results.slice(0, 3).forEach((result, index) => {
          console.log(`\n[${index + 1}] ID: ${result.id}`);
          console.log(`カテゴリ: ${result.main_category} > ${result.sub_category}`);
          console.log(`質問: ${result.question}`);
          console.log(`回答: ${result.answer}`);
          console.log(`スコア: ${result.score || 'N/A'}`);
          console.log(`注釈: ${result.note || 'なし'}`);
        });
      } else {
        console.log('該当する検索結果はありませんでした');
      }
    } catch (error) {
      console.error(`エラー発生: ${error.message}`);
    }
  }
  
  // テスト終了後にPrismaを切断
  await prisma.$disconnect();
}

testSpecialQueries(); 