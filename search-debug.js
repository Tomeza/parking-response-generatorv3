const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 特定のキーワードを含むナレッジを検索するヘルパー関数
 */
async function findKnowledgeWithKeyword(keyword) {
  const results = await prisma.knowledge.findMany({
    where: {
      OR: [
        { question: { contains: keyword, mode: 'insensitive' } },
        { answer: { contains: keyword, mode: 'insensitive' } },
        { main_category: { contains: keyword, mode: 'insensitive' } },
        { sub_category: { contains: keyword, mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      main_category: true,
      sub_category: true,
      question: true,
      answer: true,
      knowledge_tags: {
        include: {
          tag: true
        }
      }
    },
    take: 10
  });
  
  return results;
}

/**
 * 特定のカテゴリのナレッジを検索するヘルパー関数
 */
async function findKnowledgeByCategory(mainCategory, subCategory = null) {
  const whereCondition = {
    main_category: { contains: mainCategory, mode: 'insensitive' }
  };
  
  if (subCategory) {
    whereCondition.sub_category = { contains: subCategory, mode: 'insensitive' };
  }
  
  const results = await prisma.knowledge.findMany({
    where: whereCondition,
    select: {
      id: true,
      main_category: true,
      sub_category: true,
      question: true,
      answer: true,
      knowledge_tags: {
        include: {
          tag: true
        }
      }
    },
    take: 10
  });
  
  return results;
}

/**
 * クエリを個別のキーワードに分解する関数
 */
function extractKeywords(query) {
  // 日本語のストップワードリスト
  const stopwords = [
    'です', 'ます', 'した', 'して', 'ください', 'お願い', 'どう', 'はどう', 'したい', 'なり', 'ある', 'ない',
    'いる', 'える', 'れる', 'られる', 'せる', 'ので', 'から', 'まで', 'より', 'ため', 'よう', 'ような', 'れば',
    'なら', 'ならば', 'すれば', 'すか', 'ますか', 'ですか', 'をし', 'をさ', 'をす', 'した', 'して', 'する',
    'なる', 'いる', 'それ', 'これ', 'あれ', 'どれ', 'その', 'この', 'あの', 'どの', 'もの', 'こと', 'ところ',
    'ほど', 'くらい', 'がた', 'など', 'いう', 'おり', 'よい', 'いい', 'ない', 'の', 'に', 'と', 'が', 'は', 'を', 'へ', 'で', 'や', 'も'
  ];
  
  // まず単語に分解
  const words = query.split(/[\s、。．！？!?.]+/);
  
  // 各単語をさらに助詞で分解
  let allTerms = [];
  words.forEach(word => {
    // 助詞で分解
    const subTerms = word.split(/[はがのにへでとやもを]/);
    allTerms.push(...subTerms.filter(t => t.length >= 2));
    
    // 元の単語も追加（複合語として重要な場合があるため）
    if (word.length >= 2) {
      allTerms.push(word);
    }
  });
  
  // 特殊ケース：予約関連の複合語
  const specialTerms = [];
  if (query.includes('予約') && query.includes('変更')) {
    specialTerms.push('予約変更');
  }
  if (query.includes('予約') && query.includes('確認')) {
    specialTerms.push('予約確認');
  }
  if (query.includes('外車') || query.includes('輸入車')) {
    specialTerms.push('外車');
    specialTerms.push('輸入車');
  }
  
  // ストップワードを除去し、長い単語を優先
  const filteredTerms = allTerms
    .filter(t => t.length >= 2)
    .filter(t => !stopwords.includes(t))
    .sort((a, b) => b.length - a.length);
  
  // 重複排除
  const uniqueTerms = [...new Set([...specialTerms, ...filteredTerms])];
  
  // 重要な単語を先頭に
  const priorityTerms = ['予約', '変更', '確認', '外車', '駐車', '料金', '時間', '営業'];
  const sortedTerms = uniqueTerms.sort((a, b) => {
    const aIndex = priorityTerms.findIndex(p => a.includes(p));
    const bIndex = priorityTerms.findIndex(p => b.includes(p));
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });
  
  return sortedTerms.slice(0, 10); // 最大10個のキーワードを返す
}

/**
 * 検索とデバッグを実行する関数
 */
async function runSearchDebug() {
  try {
    // 1. よく使われる検索クエリをテスト
    const testQueries = [
      "予約はどのように行えますか？",
      "予約を変更したい",
      "予約の変更方法を教えてください",
      "外車を駐車できますか",
      "予約確認はどうすればよいですか"
    ];
    
    console.log("===== 検索クエリの診断を開始 =====\n");
    
    for (const query of testQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      
      // 1. キーワード抽出
      const keywords = extractKeywords(query);
      console.log(`抽出されたキーワード: ${keywords.join(', ')}`);
      
      // 2. 個別キーワードでの検索
      console.log("\n1. 個々のキーワードでの検索結果:");
      
      let foundAnyResults = false;
      for (const keyword of keywords) {
        console.log(`\nキーワード「${keyword}」での検索:`);
        const keywordResults = await findKnowledgeWithKeyword(keyword);
        
        if (keywordResults.length > 0) {
          foundAnyResults = true;
          console.log(`${keywordResults.length}件のナレッジが見つかりました`);
          keywordResults.slice(0, 3).forEach((result, index) => {
            console.log(`- ID=${result.id}, ${result.main_category} > ${result.sub_category}`);
            console.log(`  質問: ${result.question}`);
            console.log(`  タグ: ${result.knowledge_tags.map(kt => kt.tag?.tag_name).join(', ') || 'なし'}`);
          });
        } else {
          console.log("ナレッジが見つかりませんでした");
        }
      }
      
      if (!foundAnyResults) {
        console.log("\n全てのキーワードで検索しましたが、結果が見つかりませんでした。");
      }
      
      // 3. カテゴリベースで検索
      console.log("\n2. 関連カテゴリの検索:");
      const categoryKeywords = {
        "予約": "予約関連",
        "変更": "予約変更",
        "外車": "車両関連",
        "駐車": "車両関連",
        "確認": "予約確認",
        "料金": "料金関連",
        "時間": "営業時間"
      };
      
      const relevantCategories = keywords
        .filter(k => Object.keys(categoryKeywords).some(ck => k.includes(ck)))
        .map(k => {
          // キーワードに一致するカテゴリを探す
          for (const [key, value] of Object.entries(categoryKeywords)) {
            if (k.includes(key)) return value;
          }
          return null;
        })
        .filter(Boolean);
      
      if (relevantCategories.length > 0) {
        console.log(`関連カテゴリ: ${[...new Set(relevantCategories)].join(', ')}`);
        
        for (const category of [...new Set(relevantCategories)]) {
          console.log(`\nカテゴリ「${category}」での検索:`);
          const categoryResults = await findKnowledgeByCategory(category);
          
          if (categoryResults.length > 0) {
            console.log(`${categoryResults.length}件のナレッジが見つかりました`);
            categoryResults.slice(0, 3).forEach((result, index) => {
              console.log(`- ID=${result.id}, ${result.main_category} > ${result.sub_category}`);
              console.log(`  質問: ${result.question}`);
              console.log(`  タグ: ${result.knowledge_tags.map(kt => kt.tag?.tag_name).join(', ') || 'なし'}`);
            });
          } else {
            console.log("ナレッジが見つかりませんでした");
          }
        }
      } else {
        console.log("関連カテゴリが特定できませんでした");
      }
      
      // 4. search_vectorの状態
      if (keywords.length > 0) {
        console.log("\n3. 検索インデックス（search_vector）の状態:");
        
        // 各キーワードでsearch_vectorを検索
        for (const keyword of keywords.slice(0, 3)) { // 最初の3つのキーワードのみ
          console.log(`\nキーワード「${keyword}」でのsearch_vector検索:`);
          
          const vectorMatches = await prisma.$queryRaw`
            SELECT id, main_category, sub_category, question, 
                   LEFT(search_vector::text, 100) as vector_preview
            FROM "Knowledge"
            WHERE search_vector @@ plainto_tsquery('japanese', ${keyword})
            LIMIT 3
          `;
          
          if (vectorMatches.length > 0) {
            console.log(`${vectorMatches.length}件の一致がありました`);
            vectorMatches.forEach(k => {
              console.log(`- ID=${k.id}, ${k.main_category} > ${k.sub_category}`);
              console.log(`  質問: ${k.question}`);
              console.log(`  search_vector: ${k.vector_preview}...`);
            });
          } else {
            console.log(`一致するsearch_vectorが見つかりませんでした`);
          }
        }
      }
      
      // 5. 検索インデックスの統計情報
      console.log("\n4. 検索インデックスの統計情報:");
      
      const tagStats = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "Tag"
      `;
      console.log(`タグの総数: ${tagStats[0].count}`);
      
      const knowledgeTagStats = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "KnowledgeTag"
      `;
      console.log(`KnowledgeTagの総数: ${knowledgeTagStats[0].count}`);
      
      const knowledgeWithTagsStats = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT knowledge_id) as count FROM "KnowledgeTag"
      `;
      console.log(`タグ付けされたKnowledgeの数: ${knowledgeWithTagsStats[0].count}`);
      
      const searchVectorStats = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "Knowledge" WHERE search_vector IS NOT NULL
      `;
      console.log(`search_vectorが設定されたKnowledgeの数: ${searchVectorStats[0].count}`);
      
      console.log("\n-----------------------------------");
    }
    
    console.log("\n===== 検索クエリの診断を終了 =====");
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 診断を実行
runSearchDebug(); 