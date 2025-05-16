const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSearchIndexes() {
  try {
    console.log('=== 検索インデックス修復スクリプト ===');
    
    // 1. データベース内のレコード数を確認
    const totalCount = await prisma.knowledge.count();
    console.log(`データベース内の総ナレッジエントリ数: ${totalCount}`);
    
    // 2. search_vectorフィールドのステータスを確認
    const vectorStatus = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(search_vector) as with_vector,
        COUNT(*) - COUNT(search_vector) as without_vector
      FROM "Knowledge"
    `;
    
    console.log('検索ベクトルのステータス:');
    console.log(`- 総レコード数: ${vectorStatus[0].total}`);
    console.log(`- search_vectorあり: ${vectorStatus[0].with_vector}`);
    console.log(`- search_vectorなし: ${vectorStatus[0].without_vector}`);
    
    // 3. 既存のインデックスの確認
    console.log('\n既存のインデックスを確認中...');
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'Knowledge'
    `;
    
    console.log(`検出されたインデックス数: ${indexes.length}`);
    indexes.forEach(idx => {
      console.log(`- ${idx.indexname}: ${idx.indexdef}`);
    });
    
    // 4. search_vectorフィールドを全レコードに対して更新
    console.log('\n全ナレッジの検索ベクトルを再構築中...');
    await prisma.$executeRaw`
      UPDATE "Knowledge"
      SET search_vector = to_tsvector('japanese', 
                                     COALESCE(answer, '') || ' ' || 
                                     COALESCE(question, '') || ' ' || 
                                     COALESCE(main_category, '') || ' ' || 
                                     COALESCE(sub_category, ''))
    `;
    console.log('検索ベクトルの再構築完了');
    
    // 5. トリガー関数の確認と作成
    console.log('\n検索ベクトル更新トリガーを確認中...');
    const triggerExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'knowledge_search_vector_trigger'
      ) as exists
    `;
    
    if (triggerExists[0].exists) {
      console.log('既存のトリガーを削除中...');
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS knowledge_search_vector_trigger ON "Knowledge"
      `;
    }
    
    // トリガー関数の作成または更新
    console.log('トリガー関数を作成中...');
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
      RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('japanese', 
                                        COALESCE(NEW.answer, '') || ' ' || 
                                        COALESCE(NEW.question, '') || ' ' || 
                                        COALESCE(NEW.main_category, '') || ' ' || 
                                        COALESCE(NEW.sub_category, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    // トリガーの設定
    console.log('トリガーを設定中...');
    await prisma.$executeRaw`
      CREATE TRIGGER knowledge_search_vector_trigger
      BEFORE INSERT OR UPDATE ON "Knowledge"
      FOR EACH ROW
      EXECUTE FUNCTION update_knowledge_search_vector()
    `;
    console.log('検索ベクトル更新トリガーの設定完了');
    
    // 6. PGroongaインデックスの再構築
    console.log('\nPGroongaインデックスを再構築中...');
    
    // 既存のPGroongaインデックスを削除
    console.log('既存のPGroongaインデックスを削除中...');
    await prisma.$executeRaw`
      DROP INDEX IF EXISTS pgroonga_answer_question_index
    `;
    
    // 既存のトリグラムインデックスを削除
    console.log('既存のトリグラムインデックスを削除中...');
    await prisma.$executeRaw`
      DROP INDEX IF EXISTS trgm_answer_question_index
    `;
    
    // PGroongaインデックスを再作成
    console.log('PGroongaインデックスを作成中...');
    try {
      await prisma.$executeRaw`
        CREATE INDEX pgroonga_answer_question_index
        ON "Knowledge"
        USING pgroonga ((answer || ' ' || question))
      `;
      console.log('PGroongaインデックスの作成完了');
    } catch (error) {
      console.error('PGroongaインデックス作成エラー:', error.message);
      console.log('代替インデックスを作成します...');
      
      // 代替としてGIN索引を作成
      try {
        await prisma.$executeRaw`
          CREATE INDEX gin_knowledge_search_vector ON "Knowledge" 
          USING gin(search_vector)
        `;
        console.log('GIN検索ベクトルインデックスの作成完了');
      } catch (ginError) {
        console.error('GINインデックス作成エラー:', ginError.message);
      }
    }
    
    // トリグラムインデックスを再作成
    console.log('トリグラムインデックスを作成中...');
    try {
      await prisma.$executeRaw`
        CREATE INDEX trgm_answer_question_index
        ON "Knowledge"
        USING gin ((answer || ' ' || question) gin_trgm_ops)
      `;
      console.log('トリグラムインデックスの作成完了');
    } catch (error) {
      console.error('トリグラムインデックス作成エラー:', error.message);
    }
    
    // 7. 全テーブルの状態確認
    console.log('\n更新後のナレッジテーブル状態を確認中...');
    const sampleRecords = await prisma.$queryRaw`
      SELECT id, main_category, sub_category, 
             LEFT(question, 30) as question_preview, 
             LEFT(answer, 30) as answer_preview, 
             search_vector IS NOT NULL as has_search_vector
      FROM "Knowledge"
      ORDER BY id DESC
      LIMIT 10
    `;
    
    console.log(`サンプルレコード数: ${sampleRecords.length}`);
    if (sampleRecords.length > 0) {
      console.log('サンプルレコード:');
      sampleRecords.forEach(record => {
        console.log(`- ID: ${record.id}, カテゴリ: ${record.main_category || 'N/A'} > ${record.sub_category || 'N/A'}`);
        console.log(`  質問プレビュー: ${record.question_preview || 'N/A'}`);
        console.log(`  回答プレビュー: ${record.answer_preview || 'N/A'}`);
        console.log(`  検索ベクトルあり: ${record.has_search_vector ? 'はい' : 'いいえ'}`);
      });
    }
    
    // 8. 更新後のインデックスを確認
    console.log('\n更新後のインデックスを確認中...');
    const updatedIndexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'Knowledge'
    `;
    
    console.log(`検出されたインデックス数: ${updatedIndexes.length}`);
    updatedIndexes.forEach(idx => {
      console.log(`- ${idx.indexname}: ${idx.indexdef}`);
    });
    
    console.log('\n=== 検索インデックス修復完了 ===');
    
  } catch (error) {
    console.error('インデックス修復エラー:', error);
    if (error instanceof Error) {
      console.error('エラーメッセージ:', error.message);
      console.error('スタックトレース:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixSearchIndexes(); 