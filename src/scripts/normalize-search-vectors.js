/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 検索用ベクトルを正規化するスクリプト
 * 全てのKnowledgeエントリのsearch_vectorフィールドを再構築します
 */
async function normalizeSearchVectors() {
  console.log('🔄 検索用ベクトルの正規化を開始します...');

  try {
    // 1. データベース内のナレッジエントリ数を確認
    const totalCount = await prisma.knowledge.count();
    console.log(`📊 データベース内の総ナレッジエントリ数: ${totalCount}`);

    // 2. search_vectorフィールドのステータスを確認
    console.log('📝 search_vectorフィールドのステータスを確認中...');
    
    const nonEmptyVectors = await prisma.$queryRaw`
      SELECT COUNT(*) AS count
      FROM "Knowledge"
      WHERE search_vector IS NOT NULL
    `;
    
    const emptyCount = totalCount - Number(nonEmptyVectors[0]?.count || 0);
    console.log(`⚠️ search_vectorがNULLのエントリ数: ${emptyCount}`);
    
    // 3. search_vectorフィールドを更新
    console.log('🔄 search_vectorフィールドを更新中...');
    
    // PostgreSQLのto_tsvectorを使用してsearch_vectorを更新
    const updateResult = await prisma.$executeRaw`
      UPDATE "Knowledge"
      SET search_vector = to_tsvector('japanese', 
        COALESCE(question, '') || ' ' || 
        COALESCE(answer, '') || ' ' || 
        COALESCE(main_category, '') || ' ' || 
        COALESCE(sub_category, '') || ' ' ||
        COALESCE(detail_category, '')
      )
    `;
    
    console.log(`✅ ${updateResult}件のエントリを更新しました`);
    
    // 4. PGroongaのインデックスを更新
    console.log('🔄 PGroongaのインデックスを再構築中...');
    
    try {
      // answer, question, main_category, sub_categoryのPGroongaインデックスを再構築
      await prisma.$executeRaw`
        REINDEX INDEX pgroonga_knowledge_answer_index
      `;
      console.log('✅ answer列のPGroongaインデックスを再構築しました');
      
      await prisma.$executeRaw`
        REINDEX INDEX pgroonga_knowledge_question_index
      `;
      console.log('✅ question列のPGroongaインデックスを再構築しました');
      
      await prisma.$executeRaw`
        REINDEX INDEX pgroonga_knowledge_main_category_index
      `;
      console.log('✅ main_category列のPGroongaインデックスを再構築しました');
      
      await prisma.$executeRaw`
        REINDEX INDEX pgroonga_knowledge_sub_category_index
      `;
      console.log('✅ sub_category列のPGroongaインデックスを再構築しました');
      
    } catch (indexError) {
      console.error('⚠️ インデックスの再構築中にエラーが発生しました:', indexError);
      console.log('📝 注意: インデックスが存在しない場合は手動でインデックスを作成してください');
    }
    
    // 5. 更新後の状態を確認
    console.log('📝 更新後のsearch_vectorフィールドのステータスを確認中...');
    
    const afterUpdate = await prisma.$queryRaw`
      SELECT COUNT(*) AS count
      FROM "Knowledge"
      WHERE search_vector IS NOT NULL
    `;
    
    const afterEmptyCount = totalCount - Number(afterUpdate[0]?.count || 0);
    console.log(`✅ 更新後: search_vectorがNULLのエントリ数: ${afterEmptyCount}`);
    
    // 6. テスト検索を実行してみる
    console.log('\n🔍 テスト検索を実行中...');
    
    const testQueries = ['予約', '営業時間', 'キャンセル', '外車'];
    for (const query of testQueries) {
      console.log(`\n📝 テストクエリ: "${query}"`);
      
      // 標準全文検索
      try {
        const tsResults = await prisma.$queryRaw`
          SELECT id, question
          FROM "Knowledge"
          WHERE search_vector @@ plainto_tsquery('japanese', ${query})
          LIMIT 3
        `;
        console.log(`✅ 標準全文検索結果数: ${tsResults.length}`);
      } catch (tsError) {
        console.error('⚠️ 標準全文検索エラー:', tsError.message);
      }
      
      // PGroonga検索
      try {
        const pgroongaResults = await prisma.$queryRaw`
          SELECT id, question
          FROM "Knowledge"
          WHERE answer &@~ ${query} OR question &@~ ${query}
          LIMIT 3
        `;
        console.log(`✅ PGroonga検索結果数: ${pgroongaResults.length}`);
      } catch (pgroongaError) {
        console.error('⚠️ PGroonga検索エラー:', pgroongaError.message);
      }
    }
    
    console.log('\n✅ 検索用ベクトルの正規化が完了しました');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトを実行
normalizeSearchVectors()
  .catch(error => {
    console.error('致命的なエラーが発生しました:', error);
    process.exit(1);
  }); 