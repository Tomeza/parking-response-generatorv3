-- Phase3管理UI向けインデックス追加

-- 1. ドラフト閲覧向けインデックス（status, category, intent, tone）
CREATE INDEX IF NOT EXISTS "Templates_status_category_intent_tone_idx"
  ON "Templates"(status, category, intent, tone);

-- 2. 更新日時順インデックス（status, updated_at DESC）
CREATE INDEX IF NOT EXISTS "Templates_status_updated_at_desc_idx"
  ON "Templates"(status, updated_at DESC);

-- 3. 管理画面検索向けインデックス（status, title）
CREATE INDEX IF NOT EXISTS "Templates_status_title_idx"
  ON "Templates"(status, title);

-- 4. 承認者別インデックス（status, approved_by）
CREATE INDEX IF NOT EXISTS "Templates_status_approved_by_idx"
  ON "Templates"(status, approved_by);

-- 5. ソース別インデックス（status, source）
CREATE INDEX IF NOT EXISTS "Templates_status_source_idx"
  ON "Templates"(status, source);

-- インデックス確認クエリ
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'Templates'
  AND indexname LIKE '%status%'
ORDER BY indexname; 