const { Client } = require('pg');

async function searchKnowledge(query) {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    database: 'parking_response',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();
    
    // タグベースの検索
    const tagSearchQuery = `
      SELECT DISTINCT k.*, 
        CASE WHEN t.tag_name IS NOT NULL THEN 1 ELSE 0 END as tag_score
      FROM "Knowledge" k
      LEFT JOIN "KnowledgeTag" kt ON k.id = kt.knowledge_id
      LEFT JOIN "Tag" t ON kt.tag_id = t.id
      LEFT JOIN "TagSynonym" ts ON t.id = ts.tag_id
      WHERE t.tag_name ILIKE $1 OR ts.synonym ILIKE $1
      ORDER BY tag_score DESC, k.id
      LIMIT 10;
    `;
    
    const result = await client.query(tagSearchQuery, [`%${query}%`]);
    
    console.log(`検索クエリ: "${query}"`);
    console.log(`検索結果: ${result.rows.length}件`);
    
    result.rows.forEach(row => {
      console.log('-----------------------------------');
      console.log(`ID: ${row.id}`);
      console.log(`カテゴリ: ${row.main_category} > ${row.sub_category} > ${row.detail_category}`);
      console.log(`質問: ${row.question}`);
      console.log(`回答: ${row.answer}`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('検索エラー:', error);
    return [];
  } finally {
    await client.end();
  }
}

// クレーム対応に関するクエリをテスト
async function runTests() {
  const queries = [
    'クレーム',
    '苦情',
    '不満',
    '問題',
    '特殊対応',
    'トラブル'
  ];
  
  for (const query of queries) {
    await searchKnowledge(query);
    console.log('\n');
  }
}

runTests(); 