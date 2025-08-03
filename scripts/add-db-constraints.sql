-- Phase2 DBハードニング: CHECK制約とトリガー

-- 1. status の CHECK 制約
ALTER TABLE "Templates" 
ADD CONSTRAINT "templates_status_check" 
CHECK (status IN ('draft', 'pending', 'approved', 'archived'));

-- 2. updated_at の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_templates_updated_at 
    BEFORE UPDATE ON "Templates"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. version の正数制約（既存の確認）
-- ALTER TABLE "Templates" 
-- ADD CONSTRAINT "templates_version_positive" 
-- CHECK (version > 0);

-- 4. 部分ユニーク制約の確認（既存）
-- CREATE UNIQUE INDEX uq_templates_approved_unique
--   ON "Templates"(category, intent, tone)
--   WHERE status = 'approved';

-- 5. 検索インデックスの確認（既存）
-- CREATE INDEX "Templates_category_intent_tone_status_idx"
--   ON "Templates"(category, intent, tone, status);

-- 6. 制約確認クエリ
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public."Templates"'::regclass
ORDER BY conname;

-- 7. トリガー確認クエリ
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Templates'
ORDER BY trigger_name; 