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

async function main() {
  console.log('PostgreSQL全文検索の最適化を開始します...');

  try {
    // 1. 現在のPostgreSQLバージョンを確認
    const pgVersionResult = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
    console.log('PostgreSQLバージョン:', pgVersionResult[0].version);

    // 2. 既存のトリガーを削除
    console.log('既存のトリガーを削除します...');
    await prisma.$executeRaw`DROP TRIGGER IF EXISTS knowledge_vector_update ON "Knowledge"`;
    await prisma.$executeRaw`DROP FUNCTION IF EXISTS knowledge_search_trigger()`;
    
    // 3. 改善されたトリガー関数を作成
    console.log('改善されたトリガー関数を作成します...');
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION knowledge_search_trigger() RETURNS trigger AS $$
      BEGIN
        -- 基本的な重み付きベクトル
        NEW.search_vector = 
          setweight(to_tsvector('japanese', COALESCE(NEW.question, '')), 'A') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.answer, '')), 'B') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.main_category, '')), 'C') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.sub_category, '')), 'C') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.detail_category, '')), 'C');
        
        -- 重要な単語を個別に追加（特に「オンライン」「駐車場」などの検出を改善）
        -- 質問と回答から重要な単語を抽出して追加
        IF NEW.question IS NOT NULL THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.question, ''), '[\\s,.。、]+', ' ', 'g')), 'A');
        END IF;
        
        IF NEW.answer IS NOT NULL THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.answer, ''), '[\\s,.。、]+', ' ', 'g')), 'B');
        END IF;
        
        -- カテゴリ情報を強化
        IF NEW.main_category IS NOT NULL THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.main_category, ''), '[\\s,.。、]+', ' ', 'g')), 'C');
        END IF;
        
        IF NEW.sub_category IS NOT NULL THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.sub_category, ''), '[\\s,.。、]+', ' ', 'g')), 'C');
        END IF;
        
        -- 特定の重要キーワードを明示的に追加
        -- 「オンライン」「駐車場」などの重要な単語が検出されるように
        IF NEW.question ~* 'オンライン|駐車場|予約|キャンセル|料金|支払い|送迎|車種|サイズ' OR 
           NEW.answer ~* 'オンライン|駐車場|予約|キャンセル|料金|支払い|送迎|車種|サイズ' THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', 
              (CASE WHEN NEW.question ~* 'オンライン' OR NEW.answer ~* 'オンライン' THEN 'オンライン ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '駐車場' OR NEW.answer ~* '駐車場' THEN '駐車場 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '予約' OR NEW.answer ~* '予約' THEN '予約 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* 'キャンセル' OR NEW.answer ~* 'キャンセル' THEN 'キャンセル ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '料金' OR NEW.answer ~* '料金' THEN '料金 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '支払い' OR NEW.answer ~* '支払い' THEN '支払い ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '送迎' OR NEW.answer ~* '送迎' THEN '送迎 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '車種' OR NEW.answer ~* '車種' THEN '車種 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* 'サイズ' OR NEW.answer ~* 'サイズ' THEN 'サイズ' ELSE '' END)
            ), 'A');
        END IF;
        
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `;
    
    // 4. トリガーを再作成
    console.log('トリガーを再作成します...');
    await prisma.$executeRaw`
      CREATE TRIGGER knowledge_vector_update
      BEFORE INSERT OR UPDATE ON "Knowledge"
      FOR EACH ROW
      EXECUTE FUNCTION knowledge_search_trigger();
    `;
    
    // 5. 既存のレコードに対してsearch_vectorを更新
    console.log('既存のレコードのsearch_vectorを更新します...');
    const updateResult = await prisma.$executeRaw`
      UPDATE "Knowledge"
      SET "updatedAt" = NOW()
      WHERE id > 0
    `;
    console.log(`${updateResult}件のレコードを更新しました`);
    
    // 6. 検索インデックスを再作成
    console.log('検索インデックスを再作成します...');
    await prisma.$executeRaw`
      REINDEX INDEX "Knowledge_search_vector_idx"
    `;
    
    // 7. 日本語テキスト検索の設定を確認
    console.log('日本語テキスト検索の設定を確認します...');
    const dictionaries = await prisma.$queryRaw<{ dictname: string }[]>`
      SELECT dictname FROM pg_ts_dict WHERE dictname LIKE '%japanese%'
    `;
    console.log('利用可能な日本語辞書:', dictionaries.map(d => d.dictname).join(', '));
    
    console.log('PostgreSQL全文検索の最適化が完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 