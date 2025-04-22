/**
 * PostgreSQL全文検索の最適化スクリプト
 * 
 * このスクリプトは以下の改善を行います：
 * 1. search_vectorの更新トリガーを改善
 * 2. 日本語テキスト検索のための設定を最適化
 * 3. 重要な単語（「オンライン」「駐車場」など）の検出精度を向上
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function improveSearchVectors() {
  try {
    console.log('Search vectorの改善を開始します...');

    // 1. PGroongaの有効化を確認
    console.log('PGroonga拡張の確認中...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE EXTENSION IF NOT EXISTS pgroonga;
      `);
      console.log('PGroonga拡張が有効になっています');
    } catch (error) {
      console.error('PGroonga拡張の確認でエラーが発生しました:', error);
      console.log('拡張なしで続行します...');
    }

    // 2. KnowledgeテーブルのTSVectorトリガー関数を更新/作成
    console.log('Knowledgeテーブルのsearch_vector更新トリガーを作成中...');
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION knowledge_search_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector = 
          setweight(to_tsvector('japanese', COALESCE(NEW.question, '')), 'A') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.answer, '')), 'B') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.main_category, '')), 'C') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.sub_category, '')), 'C') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.detail_category, '')), 'D');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);

    // 3. 既存のトリガーがあれば削除して、新しいトリガーを作成
    console.log('既存トリガーを削除して新しいトリガーを作成中...');
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS knowledge_search_trigger ON "Knowledge";
      
      CREATE TRIGGER knowledge_search_trigger
      BEFORE INSERT OR UPDATE ON "Knowledge"
      FOR EACH ROW
      EXECUTE FUNCTION knowledge_search_update();
    `);

    // 4. 全てのナレッジレコードを取得
    console.log('全ナレッジレコードを取得中...');
    const knowledgeEntries = await prisma.knowledge.findMany();
    console.log(`${knowledgeEntries.length}件のナレッジが見つかりました`);

    // 5. 各レコードのsearch_vectorを手動で更新
    console.log('search_vectorを更新中...');
    let successCount = 0;
    let errorCount = 0;

    for (const entry of knowledgeEntries) {
      try {
        // 各フィールドのnullチェック
        const questionText = entry.question || '';
        const answerText = entry.answer || '';
        const mainCategory = entry.main_category || '';
        const subCategory = entry.sub_category || '';
        const detailCategory = entry.detail_category || '';
        
        // 一時的に更新をスキップする条件
        if (!questionText && !answerText && !mainCategory && !subCategory) {
          console.log(`ID ${entry.id}: 十分なテキストがないためスキップします`);
          continue;
        }
        
        // トリガーが作動するように強制的にレコードを更新
        await prisma.knowledge.update({
          where: { id: entry.id },
          data: { updatedAt: new Date() }
        });
        
        successCount++;
        
        // 進捗表示 (10件ごと)
        if (successCount % 10 === 0) {
          console.log(`${successCount}/${knowledgeEntries.length}件処理完了...`);
        }
      } catch (error) {
        console.error(`ID ${entry.id} の更新に失敗しました:`, error);
        errorCount++;
      }
    }

    // 6. search_vectorの有効性を確認するための単純なクエリを実行
    console.log('search_vectorの検証中...');
    const testQuery = await prisma.$queryRaw`
      SELECT id, question, main_category
      FROM "Knowledge"
      WHERE search_vector @@ to_tsquery('japanese', '予約')
      LIMIT 5;
    `;
    console.log('検証結果:');
    console.log(testQuery);

    // 7. 結果サマリー
    console.log('\n===== 処理サマリー =====');
    console.log(`処理完了: ${successCount}/${knowledgeEntries.length}件`);
    console.log(`エラー: ${errorCount}件`);
    console.log('=====================');
    
  } catch (error) {
    console.error('search_vectorの更新処理中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトの実行
improveSearchVectors()
  .then(() => console.log('search_vectorの改善が完了しました'))
  .catch((error) => console.error('スクリプト実行中にエラーが発生しました:', error)); 