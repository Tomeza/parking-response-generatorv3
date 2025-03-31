/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPgroongaSearch() {
  try {
    // 利用可能なテキスト検索設定を確認
    console.log('PostgreSQL拡張機能の確認:');
    const extensions = await prisma.$queryRaw`
      SELECT extname, extversion FROM pg_extension
    `;
    console.log(extensions);
    
    // pgroongaが利用可能か確認
    const hasPgroonga = extensions.some(ext => ext.extname === 'pgroonga');
    if (!hasPgroonga) {
      console.log('pgroonga拡張機能がインストールされていません');
      return;
    }
    
    console.log('\npgroonga拡張機能が利用可能です。各種検索方法を試します。');
    
    // テスト用の検索キーワード
    const testKeywords = ['予約', '営業時間', 'キャンセル'];
    
    for (const keyword of testKeywords) {
      console.log(`\n=== "${keyword}" に関する検索 ===`);
      
      // 1. &@ 演算子を使った全文検索（単語の完全一致）
      console.log('\n1. &@ 演算子を使った全文検索（単語の完全一致）:');
      try {
        const exactMatches = await prisma.$queryRaw`
          SELECT 
            id, question, answer, main_category, sub_category
          FROM 
            "Knowledge"
          WHERE 
            answer &@ ${keyword}
          LIMIT 2
        `;
        
        console.log(`&@ 演算子での検索結果: ${exactMatches.length}件`);
        if (exactMatches.length > 0) {
          exactMatches.forEach(result => {
            console.log(`ID: ${result.id}, カテゴリ: ${result.main_category || 'N/A'} > ${result.sub_category || 'N/A'}`);
            console.log(`質問: ${result.question || 'N/A'}`);
            console.log(`回答: ${result.answer.substring(0, 100)}...`);
          });
        }
      } catch (e) {
        console.log('&@ 演算子でのエラー:', e.message);
      }
      
      // 2. &@~ 演算子を使った全文検索（クエリ構文）
      console.log('\n2. &@~ 演算子を使った全文検索（クエリ構文）:');
      try {
        const queryMatches = await prisma.$queryRaw`
          SELECT 
            id, question, answer, main_category, sub_category
          FROM 
            "Knowledge"
          WHERE 
            answer &@~ ${keyword}
          LIMIT 2
        `;
        
        console.log(`&@~ 演算子での検索結果: ${queryMatches.length}件`);
        if (queryMatches.length > 0) {
          queryMatches.forEach(result => {
            console.log(`ID: ${result.id}, カテゴリ: ${result.main_category || 'N/A'} > ${result.sub_category || 'N/A'}`);
            console.log(`質問: ${result.question || 'N/A'}`);
            console.log(`回答: ${result.answer.substring(0, 100)}...`);
          });
        }
      } catch (e) {
        console.log('&@~ 演算子でのエラー:', e.message);
      }
      
      // 3. &@| 演算子を使った全文検索（OR検索）
      console.log('\n3. &@| 演算子を使った全文検索（OR検索）:');
      try {
        const orMatches = await prisma.$queryRaw`
          SELECT 
            id, question, answer, main_category, sub_category
          FROM 
            "Knowledge"
          WHERE 
            answer &@| ARRAY[${keyword}, '方法', '利用']
          LIMIT 2
        `;
        
        console.log(`&@| 演算子での検索結果: ${orMatches.length}件`);
        if (orMatches.length > 0) {
          orMatches.forEach(result => {
            console.log(`ID: ${result.id}, カテゴリ: ${result.main_category || 'N/A'} > ${result.sub_category || 'N/A'}`);
            console.log(`質問: ${result.question || 'N/A'}`);
            console.log(`回答: ${result.answer.substring(0, 100)}...`);
          });
        }
      } catch (e) {
        console.log('&@| 演算子でのエラー:', e.message);
      }
      
      // 4. %% 演算子を使った類似度検索
      console.log('\n4. %% 演算子を使った類似度検索:');
      try {
        const similarityMatches = await prisma.$queryRaw`
          SELECT 
            id, question, answer, main_category, sub_category,
            answer %% ${keyword} AS similarity
          FROM 
            "Knowledge"
          WHERE 
            answer %% ${keyword}
          ORDER BY 
            similarity DESC
          LIMIT 2
        `;
        
        console.log(`%% 演算子での検索結果: ${similarityMatches.length}件`);
        if (similarityMatches.length > 0) {
          similarityMatches.forEach(result => {
            console.log(`ID: ${result.id}, 類似度: ${result.similarity}, カテゴリ: ${result.main_category || 'N/A'} > ${result.sub_category || 'N/A'}`);
            console.log(`質問: ${result.question || 'N/A'}`);
            console.log(`回答: ${result.answer.substring(0, 100)}...`);
          });
        }
      } catch (e) {
        console.log('%% 演算子でのエラー:', e.message);
      }
      
      // 5. @@ 演算子を使った標準PostgreSQL全文検索との比較
      console.log('\n5. @@ 演算子を使った標準PostgreSQL全文検索との比較:');
      try {
        const pgMatches = await prisma.$queryRaw`
          SELECT 
            id, question, answer, main_category, sub_category
          FROM 
            "Knowledge"
          WHERE 
            to_tsvector('japanese', answer) @@ plainto_tsquery('japanese', ${keyword})
          LIMIT 2
        `;
        
        console.log(`@@ 演算子での検索結果: ${pgMatches.length}件`);
        if (pgMatches.length > 0) {
          pgMatches.forEach(result => {
            console.log(`ID: ${result.id}, カテゴリ: ${result.main_category || 'N/A'} > ${result.sub_category || 'N/A'}`);
            console.log(`質問: ${result.question || 'N/A'}`);
            console.log(`回答: ${result.answer.substring(0, 100)}...`);
          });
        }
      } catch (e) {
        console.log('@@ 演算子でのエラー:', e.message);
      }
    }
    
    // pgroonga _score関数のテスト
    console.log('\n=== pgroonga _score関数のテスト ===');
    try {
      const scoreResults = await prisma.$queryRaw`
        SELECT 
          id, question, main_category, sub_category,
          pgroonga_score(tableoid, ctid) AS score
        FROM 
          "Knowledge"
        WHERE 
          answer &@~ '予約'
        ORDER BY 
          score DESC
        LIMIT 3
      `;
      
      console.log(`_score関数での検索結果: ${scoreResults.length}件`);
      scoreResults.forEach(result => {
        console.log(`ID: ${result.id}, スコア: ${result.score}, カテゴリ: ${result.main_category || 'N/A'} > ${result.sub_category || 'N/A'}`);
        console.log(`質問: ${result.question || 'N/A'}`);
      });
    } catch (e) {
      console.log('_score関数でのエラー:', e.message);
    }
    
  } catch (e) {
    console.error('全体エラー:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkPgroongaSearch(); 