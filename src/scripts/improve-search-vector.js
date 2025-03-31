/* eslint-env node */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * search_vectorを改善するスクリプト
 * PostgreSQLのTSVectorを使った全文検索のインデックスを最適化する
 */

// CommonJSスタイルに修正
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
    
    // トリガー関数を作成（改善版）
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION knowledge_search_vector_update() RETURNS trigger AS $$
      BEGIN
        -- 日本語テキストの正規化と重み付け
        NEW.search_vector = 
          setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.question, ''), '[[:space:]]+', ' ', 'g')), 'A') ||
          setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.answer, ''), '[[:space:]]+', ' ', 'g')), 'B') ||
          setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.main_category, ''), '[[:space:]]+', ' ', 'g')), 'C') ||
          setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.sub_category, ''), '[[:space:]]+', ' ', 'g')), 'C') ||
          setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.detail_category, ''), '[[:space:]]+', ' ', 'g')), 'D');
        
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
    } catch {
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
        await prisma.$executeRawUnsafe(`
          UPDATE "Knowledge"
          SET "updatedAt" = NOW()
          WHERE id = ${record.id}
        `);
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
    
    // インデックスの最適化
    console.log('インデックスの最適化中...');
    try {
      // GINインデックスを作成（tsvectorの標準的な方法）
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS knowledge_search_vector_gin_idx ON "Knowledge" USING GIN (search_vector);
      `);
      console.log('GINインデックスを作成しました');
      
      // PGroongaインデックスを作成
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS knowledge_pgroonga_question_idx ON "Knowledge" 
        USING pgroonga (question);
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS knowledge_pgroonga_answer_idx ON "Knowledge" 
        USING pgroonga (answer);
      `);
      console.log('PGroongaインデックスを作成しました');
    } catch (error) {
      console.error('インデックス作成中にエラーが発生しました:', error);
    }
    
    // search_vectorの有効性を確認するためのテストクエリを実行
    console.log('search_vectorの有効性をテスト中...');
    
    // テストクエリを再拡張
    const testQueries = [
      '予約方法', 
      'キャンセル料',
      '営業時間',   
      '外車'       
    ];
    
    for (const testQuery of testQueries) {
      try {
        // combined_score を導入してスコアを統合
        const testResults = await prisma.$queryRaw`
          WITH ranked_results AS (
            SELECT 
              k.id, 
              k.question,
              k.answer,
              k.main_category,
              k.sub_category,
              k.detail_category,
              pgroonga_score(k.tableoid, k.ctid) as pgroonga_score,
              ts_rank_cd(
                k.search_vector::tsvector,
                to_tsquery('japanese', ${testQuery}),
                16  -- normalization factor
              ) as score,
              ts_headline(
                'japanese',
                k.question,
                plainto_tsquery('japanese', ${testQuery}),
                'StartSel = <mark>, StopSel = </mark>, MaxFragments=5, MinWords=1, MaxWords=10, FragmentDelimiter=" ... ", HighlightAll=TRUE'
              ) as question_headline,
              ts_headline(
                'japanese',
                k.answer,
                plainto_tsquery('japanese', ${testQuery}),
                'StartSel = <mark>, StopSel = </mark>, MaxFragments=5, MinWords=1, MaxWords=10, FragmentDelimiter=" ... ", HighlightAll=TRUE'
              ) as answer_headline
            FROM "Knowledge" k
            WHERE k.search_vector::tsvector @@ to_tsquery('japanese', ${testQuery})
               OR k.question &@~ ${testQuery}
               OR k.answer &@~ ${testQuery}
          )
          SELECT 
            id,
            question,
            answer,
            main_category,
            sub_category,
            detail_category,
            pgroonga_score, 
            score,
            question_headline,
            answer_headline,
            -- スコアを統合 (PGroongaスコアを5倍、ts_rank_cdを1倍で加算)
            (COALESCE(pgroonga_score, 0) * 5 + score) as combined_score
          FROM ranked_results
          ORDER BY combined_score DESC -- 統合スコアで順位付け
          LIMIT 5
        `;
        
        console.log(`\nテストクエリ「${testQuery}」の結果: ${testResults.length}件`);
        
        if (testResults.length > 0) {
          console.log('テスト結果のサンプル:');
          testResults.forEach((result, index) => {
            console.log(`${index + 1}. ID=${result.id}`);
            console.log(`   計算スコア (Combined): ${result.combined_score.toFixed(6)}`); // combined_score表示
            console.log(`   (内訳) PGroonga: ${result.pgroonga_score ? result.pgroonga_score.toFixed(6) : 'N/A'}, ts_rank_cd: ${result.score.toFixed(6)}`); // 内訳表示
            console.log(`   質問: "${result.question}"`);
            if (result.question_headline) {
              console.log(`   質問ハイライト: "${result.question_headline}"`);
            }
            if (result.answer_headline) {
              console.log(`   回答ハイライト: "${result.answer_headline}"`);
            }
            console.log(`   カテゴリ: ${result.main_category} > ${result.sub_category} > ${result.detail_category}`);
          });
        } else {
          console.log('テストクエリで結果が見つかりませんでした。');
        }
      } catch (error) {
        console.error('テストクエリ実行中にエラーが発生しました:', error);
      }
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

// CommonJSエクスポートに修正
module.exports = { improveSearchVectors }; 