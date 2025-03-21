const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function searchKnowledge(query) {
  // タグベース検索
  const tags = await prisma.tag.findMany({
    where: {
      OR: [
        { tag_name: { contains: 'キャンセル', mode: 'insensitive' } },
        { tag_synonyms: { some: { synonym: { contains: 'キャンセル', mode: 'insensitive' } } } }
      ]
    }
  });

  const tagIds = tags.map(tag => tag.id);

  // キャンセル関連のナレッジを検索
  const results = await prisma.knowledge.findMany({
    where: {
      OR: [
        { knowledge_tags: { some: { tag_id: { in: tagIds } } } },
        { main_category: { contains: 'キャンセル', mode: 'insensitive' } },
        { sub_category: { contains: 'キャンセル', mode: 'insensitive' } },
        { detail_category: { contains: 'キャンセル', mode: 'insensitive' } },
        { question: { contains: 'キャンセル', mode: 'insensitive' } },
        { question: { contains: query, mode: 'insensitive' } }
      ]
    },
    include: {
      knowledge_tags: {
        include: {
          tag: true
        }
      }
    },
    orderBy: {
      id: 'asc'
    }
  });

  return results;
}

async function testCancelQueries() {
  const queries = [
    "キャンセル料はいくらですか？",
    "キャンセル料の支払い方法を教えてください",
    "部分的なキャンセルはできますか？",
    "天候不良でキャンセルする場合はどうなりますか？",
    "病気でキャンセルする場合は？",
    "予約のキャンセル方法を教えてください",
    "キャンセル料はかかりますか？",
    "キャンセルした場合の返金について教えてください",
    "キャンセルの期限はありますか？"
  ];

  console.log("===== キャンセル関連クエリのテスト =====\n");

  for (const query of queries) {
    try {
      console.log(`\n===================================`);
      console.log(`クエリ: "${query}" の検索結果`);
      console.log(`===================================`);
      
      const results = await searchKnowledge(query);
      
      console.log(`検索結果数: ${results.length}`);
      
      if (results.length > 0) {
        console.log("検索結果:");
        results.slice(0, 2).forEach(result => {
          console.log(`ID: ${result.id}`);
          console.log(`メインカテゴリ: ${result.main_category}`);
          console.log(`サブカテゴリ: ${result.sub_category}`);
          console.log(`質問: ${result.question}`);
          console.log(`回答: ${result.answer}`);
          console.log(`タグ: ${result.knowledge_tags.map(kt => kt.tag.tag_name).join(', ')}`);
          console.log(`-------------------`);
        });
        
        if (results.length > 2) {
          console.log(`... 他 ${results.length - 2} 件の結果があります`);
        }
      } else {
        console.log("検索結果がありません。");
      }
    } catch (error) {
      console.error(`クエリ "${query}" の処理中にエラーが発生しました:`, error);
    }
  }

  await prisma.$disconnect();
}

testCancelQueries(); 