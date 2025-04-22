/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPostgresConfig() {
  try {
    // 利用可能なテキスト検索設定を確認
    console.log('利用可能なテキスト検索設定:');
    const tsConfigs = await prisma.$queryRaw`SELECT cfgname FROM pg_ts_config`;
    console.log(tsConfigs);
    
    // 簡単なテスト - キーワードを含む知識の検索
    const testKeywords = ['予約', '営業時間', 'キャンセル'];
    
    for (const keyword of testKeywords) {
      console.log(`\n"${keyword}" を含む知識を検索:`);
      
      // 単純なILIKE検索
      const ilikeResults = await prisma.knowledge.findMany({
        where: {
          OR: [
            { answer: { contains: keyword, mode: 'insensitive' } },
            { question: { contains: keyword, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          question: true,
          answer: true,
          main_category: true,
          sub_category: true
        },
        take: 2
      });
      
      console.log(`ILIKE検索結果 (${ilikeResults.length}件):`);
      ilikeResults.forEach(item => {
        console.log(`ID: ${item.id}, カテゴリ: ${item.main_category || 'N/A'} > ${item.sub_category || 'N/A'}`);
        console.log(`質問: ${item.question || 'N/A'}`);
        console.log(`回答: ${item.answer.substring(0, 100)}...`);
        console.log('---');
      });
      
      // search_vector の確認
      if (ilikeResults.length > 0) {
        const itemWithVector = await prisma.knowledge.findUnique({
          where: { id: ilikeResults[0].id },
          select: { id: true, search_vector: true }
        });
        
        if (itemWithVector && itemWithVector.search_vector) {
          console.log(`ID ${itemWithVector.id} の search_vector:`, 
            itemWithVector.search_vector.substring(0, 100) + '...');
        }
      }
    }
    
    // 日本語トークナイズのテスト
    console.log('\n日本語トークナイズのテスト:');
    try {
      const tokenTest = await prisma.$queryRaw`
        SELECT to_tsquery('japanese', '予約') as ts_query_result
      `;
      console.log('to_tsquery(予約) =', tokenTest);
    } catch (e) {
      console.log('トークナイズテストエラー:', e.message);
    }
    
    // PostgreSQL拡張機能の確認
    console.log('\nPostgreSQL拡張機能:');
    const extensions = await prisma.$queryRaw`SELECT * FROM pg_extension`;
    console.log('インストールされている拡張機能:', extensions.map(ext => ext.extname).join(', '));
    
  } catch (e) {
    console.error('エラー:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkPostgresConfig(); 