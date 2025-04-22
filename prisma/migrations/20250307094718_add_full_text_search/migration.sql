-- AlterTable
ALTER TABLE "Knowledge" ADD COLUMN     "search_vector" tsvector;

-- CreateIndex
CREATE INDEX "Knowledge_search_vector_idx" ON "Knowledge" USING GIN ("search_vector");

-- 日本語全文検索用の設定を作成
CREATE TEXT SEARCH CONFIGURATION japanese (COPY = simple);

-- 全文検索用の関数を作成
CREATE OR REPLACE FUNCTION knowledge_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('japanese', COALESCE(NEW.question, '')), 'A') ||
    setweight(to_tsvector('japanese', COALESCE(NEW.answer, '')), 'B') ||
    setweight(to_tsvector('japanese', COALESCE(NEW.main_category, '')), 'C') ||
    setweight(to_tsvector('japanese', COALESCE(NEW.sub_category, '')), 'C') ||
    setweight(to_tsvector('japanese', COALESCE(NEW.detail_category, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- トリガーを作成
CREATE TRIGGER knowledge_vector_update
  BEFORE INSERT OR UPDATE ON "Knowledge"
  FOR EACH ROW
  EXECUTE FUNCTION knowledge_search_trigger();

-- 既存のレコードに対して全文検索ベクトルを更新
UPDATE "Knowledge"
SET question = question,
    answer = answer;
