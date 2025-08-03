-- Phase2データ品質向上: NOT NULL制約の整理

-- 1. 必須フィールドのNOT NULL制約
ALTER TABLE "Templates" 
ALTER COLUMN category SET NOT NULL;

ALTER TABLE "Templates" 
ALTER COLUMN intent SET NOT NULL;

ALTER TABLE "Templates" 
ALTER COLUMN tone SET NOT NULL;

ALTER TABLE "Templates" 
ALTER COLUMN title SET NOT NULL;

ALTER TABLE "Templates" 
ALTER COLUMN content SET NOT NULL;

-- 2. デフォルト値の設定（既存データの整合性確保）
UPDATE "Templates" 
SET category = 'general' 
WHERE category IS NULL;

UPDATE "Templates" 
SET intent = 'inquiry' 
WHERE intent IS NULL;

UPDATE "Templates" 
SET tone = 'normal' 
WHERE tone IS NULL;

UPDATE "Templates" 
SET title = 'Untitled Template' 
WHERE title IS NULL;

UPDATE "Templates" 
SET content = 'Template content not specified' 
WHERE content IS NULL;

-- 3. statusのデフォルト値確認
ALTER TABLE "Templates" 
ALTER COLUMN status SET DEFAULT 'draft';

-- 4. versionのデフォルト値確認
ALTER TABLE "Templates" 
ALTER COLUMN version SET DEFAULT 1;

-- 5. is_approvedのデフォルト値確認
ALTER TABLE "Templates" 
ALTER COLUMN is_approved SET DEFAULT false;

-- 制約確認クエリ
SELECT 
  column_name,
  is_nullable,
  column_default,
  data_type
FROM information_schema.columns
WHERE table_name = 'Templates'
  AND column_name IN ('category', 'intent', 'tone', 'title', 'content', 'status', 'version', 'is_approved')
ORDER BY column_name; 