/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * PGroongaインデックスを作成または再構築するスクリプト
 */
async function createPGroongaIndexes() {
  console.log('🔄 PGroongaインデックスの作成/再構築を開始します...');

  try {
    // 1. 現在のインデックスを確認
    console.log('📝 現在のインデックスを確認中...');
    
    const currentIndexes = await prisma.$queryRaw`
      SELECT 
        indexname, 
        indexdef 
      FROM 
        pg_indexes 
      WHERE 
        tablename = 'Knowledge' 
        AND indexdef LIKE '%pgroonga%'
    `;
    
    console.log(`📊 現在のPGroongaインデックス数: ${currentIndexes.length}`);
    
    if (currentIndexes.length > 0) {
      console.log('📋 現在のPGroongaインデックス一覧:');
      currentIndexes.forEach(index => {
        console.log(`- ${index.indexname}: ${index.indexdef}`);
      });
      
      // 2. 既存のインデックスを削除
      console.log('\n🗑️ 既存のPGroongaインデックスを削除中...');
      
      for (const index of currentIndexes) {
        try {
          await prisma.$executeRaw`
            DROP INDEX IF EXISTS ${prisma.$raw`${index.indexname}`}
          `;
          console.log(`✅ インデックス '${index.indexname}' を削除しました`);
        } catch (dropError) {
          console.error(`⚠️ インデックス '${index.indexname}' の削除中にエラーが発生しました:`, dropError.message);
        }
      }
    }
    
    // 3. 各列にPGroongaインデックスを作成
    console.log('\n🔧 新しいPGroongaインデックスを作成中...');
    
    // question列のインデックス
    try {
      await prisma.$executeRaw`
        CREATE INDEX pgroonga_knowledge_question_index ON "Knowledge" 
        USING pgroonga (question)
      `;
      console.log('✅ question列のPGroongaインデックスを作成しました');
    } catch (error) {
      console.error('⚠️ question列のインデックス作成中にエラーが発生しました:', error.message);
    }
    
    // answer列のインデックス
    try {
      await prisma.$executeRaw`
        CREATE INDEX pgroonga_knowledge_answer_index ON "Knowledge" 
        USING pgroonga (answer)
      `;
      console.log('✅ answer列のPGroongaインデックスを作成しました');
    } catch (error) {
      console.error('⚠️ answer列のインデックス作成中にエラーが発生しました:', error.message);
    }
    
    // main_category列のインデックス
    try {
      await prisma.$executeRaw`
        CREATE INDEX pgroonga_knowledge_main_category_index ON "Knowledge" 
        USING pgroonga (main_category)
      `;
      console.log('✅ main_category列のPGroongaインデックスを作成しました');
    } catch (error) {
      console.error('⚠️ main_category列のインデックス作成中にエラーが発生しました:', error.message);
    }
    
    // sub_category列のインデックス
    try {
      await prisma.$executeRaw`
        CREATE INDEX pgroonga_knowledge_sub_category_index ON "Knowledge" 
        USING pgroonga (sub_category)
      `;
      console.log('✅ sub_category列のPGroongaインデックスを作成しました');
    } catch (error) {
      console.error('⚠️ sub_category列のインデックス作成中にエラーが発生しました:', error.message);
    }
    
    // 複合インデックス（answer, question, main_category, sub_category）
    try {
      await prisma.$executeRaw`
        CREATE INDEX pgroonga_knowledge_combined_index ON "Knowledge" 
        USING pgroonga (answer, question, main_category, sub_category)
      `;
      console.log('✅ 複合列のPGroongaインデックスを作成しました');
    } catch (error) {
      console.error('⚠️ 複合列のインデックス作成中にエラーが発生しました:', error.message);
    }
    
    // 4. 作成後のインデックスを確認
    console.log('\n📝 作成後のインデックスを確認中...');
    
    const newIndexes = await prisma.$queryRaw`
      SELECT 
        indexname, 
        indexdef 
      FROM 
        pg_indexes 
      WHERE 
        tablename = 'Knowledge' 
        AND indexdef LIKE '%pgroonga%'
    `;
    
    console.log(`📊 作成後のPGroongaインデックス数: ${newIndexes.length}`);
    
    if (newIndexes.length > 0) {
      console.log('📋 作成後のPGroongaインデックス一覧:');
      newIndexes.forEach(index => {
        console.log(`- ${index.indexname}: ${index.indexdef}`);
      });
    }
    
    // 5. テスト検索を実行
    console.log('\n🔍 テスト検索を実行中...');
    
    const testQueries = ['予約', '営業時間', 'キャンセル', '外車'];
    for (const query of testQueries) {
      console.log(`\n📝 テストクエリ: "${query}"`);
      
      // PGroonga検索（&@~演算子）
      try {
        const queryResults = await prisma.$queryRaw`
          SELECT id, question
          FROM "Knowledge"
          WHERE answer &@~ ${query} OR question &@~ ${query}
          LIMIT 3
        `;
        console.log(`✅ PGroonga &@~検索結果数: ${queryResults.length}`);
      } catch (queryError) {
        console.error('⚠️ PGroonga &@~検索エラー:', queryError.message);
      }
      
      // PGroonga検索（&@演算子）
      try {
        const exactResults = await prisma.$queryRaw`
          SELECT id, question
          FROM "Knowledge"
          WHERE answer &@ ${query} OR question &@ ${query}
          LIMIT 3
        `;
        console.log(`✅ PGroonga &@検索結果数: ${exactResults.length}`);
      } catch (exactError) {
        console.error('⚠️ PGroonga &@検索エラー:', exactError.message);
      }
    }
    
    console.log('\n✅ PGroongaインデックスの作成/再構築が完了しました');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトを実行
createPGroongaIndexes()
  .catch(error => {
    console.error('致命的なエラーが発生しました:', error);
    process.exit(1);
  }); 