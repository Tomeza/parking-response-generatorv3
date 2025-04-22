const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Knowledgeレコードの総数を取得
    const totalKnowledge = await prisma.knowledge.count();
    console.log('Knowledgeレコード総数:', totalKnowledge);
    
    // タグを持つKnowledgeレコードの数を取得
    const knowledgeWithTags = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT knowledge_id) as count 
      FROM "KnowledgeTag"
    `;
    console.log('タグを持つKnowledgeレコード数:', knowledgeWithTags[0].count);
    
    // タグを持たないKnowledgeレコードのIDを取得（最大10件）
    const knowledgeWithoutTags = await prisma.$queryRaw`
      SELECT k.id 
      FROM "Knowledge" k
      LEFT JOIN "KnowledgeTag" kt ON k.id = kt.knowledge_id
      WHERE kt.knowledge_id IS NULL
      ORDER BY k.id
      LIMIT 10
    `;
    
    console.log('タグのないKnowledgeレコードID（最大10件）:');
    console.log(knowledgeWithoutTags.map(row => row.id));
    
    // ID 132-146のレコードを調査
    const problematicRecords = await prisma.knowledge.findMany({
      where: {
        id: {
          gte: 132,
          lte: 146
        }
      },
      select: {
        id: true,
        main_category: true,
        sub_category: true,
        knowledge_tags: {
          select: {
            tag_id: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    });
    
    console.log('\n問題のあるID 132-146のレコード情報:');
    problematicRecords.forEach(record => {
      console.log(`ID: ${record.id}`);
      console.log(`カテゴリ: ${record.main_category} > ${record.sub_category}`);
      console.log(`タグ数: ${record.knowledge_tags.length}`);
      console.log('---');
    });
    
    // ユニークなカテゴリの一覧を取得
    const categories = await prisma.$queryRaw`
      SELECT DISTINCT main_category, sub_category 
      FROM "Knowledge"
      ORDER BY main_category, sub_category
    `;
    
    console.log('\nユニークなカテゴリ一覧:');
    categories.forEach(cat => {
      console.log(`${cat.main_category || 'なし'} > ${cat.sub_category || 'なし'}`);
    });
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 