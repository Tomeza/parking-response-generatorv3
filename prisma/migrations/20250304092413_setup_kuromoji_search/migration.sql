-- This is an empty migration.

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS knowledge_tsvector_update ON "Knowledge";
DROP FUNCTION IF EXISTS knowledge_tsvector_trigger();

-- Install required extensions
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create improved Japanese text search configuration
DO $$
BEGIN
  -- Create Japanese text search configuration if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'japanese_custom'
  ) THEN
    -- Create a new text search configuration with default parser
    CREATE TEXT SEARCH CONFIGURATION japanese_custom (COPY = simple);
    
    -- Add support for standard tokens with stemming
    ALTER TEXT SEARCH CONFIGURATION japanese_custom
      ALTER MAPPING FOR asciiword, asciihword, hword_asciipart,
                      word, hword, hword_part
      WITH simple, english_stem;
  END IF;
END
$$;

-- Create new function with improved Japanese search support
CREATE OR REPLACE FUNCTION knowledge_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  -- 重み付けを行いながらtsvectorを生成
  -- question (title): weight A
  -- answer (content): weight B
  -- main_category, sub_category: weight C
  NEW.question_tsv = setweight(to_tsvector('japanese_custom', COALESCE(NEW.question, '')), 'A') ||
                    setweight(to_tsvector('japanese_custom', COALESCE(NEW.answer, '')), 'B') ||
                    setweight(to_tsvector('japanese_custom', 
                      COALESCE(NEW.main_category, '') || ' ' || 
                      COALESCE(NEW.sub_category, '') || ' ' || 
                      COALESCE(NEW.detail_category, '')
                    ), 'C');
  
  -- answer用の個別のtsvector（長文検索用）
  NEW.answer_tsv = to_tsvector('japanese_custom', COALESCE(NEW.answer, ''));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger
CREATE TRIGGER knowledge_tsvector_update
  BEFORE INSERT OR UPDATE ON "Knowledge"
  FOR EACH ROW
  EXECUTE FUNCTION knowledge_tsvector_trigger();

-- Create GIN indexes with specific opclasses for better performance
DROP INDEX IF EXISTS knowledge_question_tsv_idx;
DROP INDEX IF EXISTS knowledge_answer_tsv_idx;

CREATE INDEX knowledge_question_tsv_idx ON "Knowledge" USING GIN (question_tsv);
CREATE INDEX knowledge_answer_tsv_idx ON "Knowledge" USING GIN (answer_tsv);

-- Update existing records
UPDATE "Knowledge"
SET
  question = question,  -- This will trigger the update function
  answer = answer;