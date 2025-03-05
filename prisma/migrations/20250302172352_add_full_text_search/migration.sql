-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "Knowledge" ADD COLUMN     "search_vector" tsvector;

-- CreateIndex
CREATE INDEX "Knowledge_search_vector_idx" ON "Knowledge" USING GIN ("search_vector");

-- 日本語全文検索用の設定
CREATE TEXT SEARCH CONFIGURATION japanese (COPY = pg_catalog.simple);

-- 全文検索用のトリガー関数を作成
CREATE OR REPLACE FUNCTION knowledge_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('japanese', COALESCE(NEW.question, '')), 'A') ||
    setweight(to_tsvector('japanese', COALESCE(NEW.answer, '')), 'B') ||
    setweight(to_tsvector('japanese', COALESCE(NEW.main_category, '')), 'C') ||
    setweight(to_tsvector('japanese', COALESCE(NEW.sub_category, '')), 'C') ||
    setweight(to_tsvector('japanese', COALESCE(NEW.detail_category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成
CREATE TRIGGER knowledge_search_vector_trigger
BEFORE INSERT OR UPDATE ON "Knowledge"
FOR EACH ROW
EXECUTE FUNCTION knowledge_search_vector_update();

-- 既存のデータに対して全文検索用のカラムを更新
UPDATE "Knowledge" SET search_vector = 
  setweight(to_tsvector('japanese', COALESCE(question, '')), 'A') ||
  setweight(to_tsvector('japanese', COALESCE(answer, '')), 'B') ||
  setweight(to_tsvector('japanese', COALESCE(main_category, '')), 'C') ||
  setweight(to_tsvector('japanese', COALESCE(sub_category, '')), 'C') ||
  setweight(to_tsvector('japanese', COALESCE(detail_category, '')), 'C');
