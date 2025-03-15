-- 日本語形態素解析のための拡張機能を確認
CREATE EXTENSION IF NOT EXISTS pgroonga;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 日本語テキスト検索設定の強化
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'japanese_enhanced') THEN
    CREATE TEXT SEARCH CONFIGURATION japanese_enhanced (COPY = simple);
    COMMENT ON TEXT SEARCH CONFIGURATION japanese_enhanced IS '日本語検索用の拡張設定';
  END IF;
END $$;

-- 既存のトリガー関数を更新して日本語形態素解析を強化
CREATE OR REPLACE FUNCTION knowledge_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.question, '')), 'A') ||
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.answer, '')), 'B') ||
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.main_category, '')), 'C') ||
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.sub_category, '')), 'C') ||
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.detail_category, '')), 'C') ||
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.note, '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 既存のレコードに対して全文検索ベクトルを更新
UPDATE "Knowledge"
SET question = question,
    answer = answer;

-- 同義語辞書の初期データ
INSERT INTO "SearchSynonym" ("word", "synonym")
VALUES 
  ('駐車', '駐車場'),
  ('駐車', 'パーキング'),
  ('予約', '予約方法'),
  ('予約', '予約手続き'),
  ('料金', '価格'),
  ('料金', '費用'),
  ('支払', '支払い'),
  ('支払', '精算'),
  ('車種', '自動車'),
  ('車種', '車')
ON CONFLICT DO NOTHING;

-- 同義語検索用の関数
CREATE OR REPLACE FUNCTION search_with_synonyms(search_term TEXT) 
RETURNS TABLE(word TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT search_term
  UNION
  SELECT synonym FROM "SearchSynonym" WHERE word = search_term
  UNION
  SELECT word FROM "SearchSynonym" WHERE synonym = search_term;
END;
$$ LANGUAGE plpgsql; 