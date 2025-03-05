-- This is an empty migration.

-- CreateFunction
CREATE OR REPLACE FUNCTION knowledge_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.question_tsv = to_tsvector('japanese', NEW.question);
  NEW.answer_tsv = to_tsvector('japanese', NEW.answer);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTrigger
DROP TRIGGER IF EXISTS knowledge_tsvector_update ON "Knowledge";
CREATE TRIGGER knowledge_tsvector_update
  BEFORE INSERT OR UPDATE ON "Knowledge"
  FOR EACH ROW
  EXECUTE FUNCTION knowledge_tsvector_trigger();

-- Update existing records
UPDATE "Knowledge"
SET
  question_tsv = to_tsvector('japanese', question),
  answer_tsv = to_tsvector('japanese', answer)
WHERE question_tsv IS NULL OR answer_tsv IS NULL;