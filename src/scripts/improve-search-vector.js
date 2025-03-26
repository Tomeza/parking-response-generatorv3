/**
 * search_vectorを改善するスクリプト
 * PostgreSQLのTSVectorを使った全文検索のインデックスを最適化する
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 検索ベクトルを改善する関数
 */
async function improveSearchVectors() {
  console.log('Search vectorの改善を開始します...');

  try {
    // PGroonga拡張をチェック
    console.log('PGroonga拡張の確認中...');
    const pgExtension = await prisma.$queryRaw`
      SELECT * FROM pg_extension WHERE extname = 'pgroonga'
    `;

    if (pgExtension && pgExtension.length > 0) {
      console.log('PGroonga拡張が有効になっています');
    } else {
      console.log('PGroonga拡張を作成します...');
      await prisma.$executeRawUnsafe(`
        CREATE EXTENSION pgroonga
      `);
      console.log('PGroonga拡張を作成しました');
    }

    // トリガー関数を作成/更新
    console.log('Knowledgeテーブルのsearch_vector更新トリガーを作成中...');
    
    // トリガー関数を作成
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION knowledge_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector = 
          setweight(to_tsvector('japanese', COALESCE(NEW.question, '')), 'A') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.answer, '')), 'B') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.main_category, '')), 'C') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.sub_category, '')), 'C') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.detail_category, '')), 'D');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    // 既存のトリガーを削除して新しいトリガーを作成
    console.log('既存トリガーを削除して新しいトリガーを作成中...');
    
    // 既存のトリガーを削除
    try {
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS knowledge_search_vector_trigger ON "Knowledge"
      `);
    } catch (error) {
      console.log('既存トリガーの削除中にエラーが発生しました (無視して続行します)');
    }
    
    // 新しいトリガーを作成
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER knowledge_search_vector_trigger
      BEFORE INSERT OR UPDATE ON "Knowledge"
      FOR EACH ROW
      EXECUTE FUNCTION knowledge_search_vector_update()
    `);

    // すべてのナレッジ記録を取得してsearch_vectorを更新
    console.log('既存のレコードのsearch_vectorを更新中...');
    
    const knowledgeRecords = await prisma.knowledge.findMany({
      select: { id: true }
    });
    
    console.log(`${knowledgeRecords.length}件のレコードを処理します...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // 各レコードを更新
    for (const record of knowledgeRecords) {
      try {
        // 空のupdateを実行して、トリガーが発火するようにする
        await prisma.knowledge.update({
          where: { id: record.id },
          data: { updatedAt: new Date() } // updatedAtフィールドがある場合
        });
        successCount++;
        
        if (successCount % 100 === 0) {
          console.log(`${successCount}件処理完了...`);
        }
      } catch (error) {
        console.error(`ID ${record.id} の更新中にエラーが発生しました:`, error);
        errorCount++;
      }
    }
    
    console.log(`更新完了: 成功=${successCount}, 失敗=${errorCount}`);
    
    // search_vectorの有効性を確認するためのテストクエリを実行
    console.log('search_vectorの有効性をテスト中...');
    
    // 予約|駐車場 のような形式でtsqueryを作成
    const testQuery = '予約 | 駐車場';
    try {
      const testResults = await prisma.$queryRaw`
        SELECT id, question 
        FROM "Knowledge"
        WHERE search_vector @@ to_tsquery('japanese', ${testQuery})
        ORDER BY id
        LIMIT 5
      `;
      
      console.log(`テストクエリ「${testQuery}」の結果: ${testResults.length}件`);
      
      if (testResults.length > 0) {
        console.log('テスト結果のサンプル:');
        testResults.forEach((result, index) => {
          console.log(`${index + 1}. ID=${result.id}, 質問="${result.question}"`);
        });
      } else {
        console.log('テストクエリで結果が見つかりませんでした。');
      }
    } catch (error) {
      console.error('テストクエリ実行中にエラーが発生しました:', error);
    }
    
  } catch (error) {
    console.error('search_vectorの更新処理中にエラーが発生しました:', error);
  } finally {
    console.log('search_vectorの改善が完了しました');
  }
}

// スクリプトを実行
improveSearchVectors()
  .catch(e => {
    console.error('エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 