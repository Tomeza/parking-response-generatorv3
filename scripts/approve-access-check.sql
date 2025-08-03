-- Phase2.5: access/check/normal テンプレートの承認

-- 1. 対象テンプレートの確認
SELECT id, title, category, intent, tone, status, usageLabel
FROM "Templates" 
WHERE id = 188;

-- 2. テンプレートの承認とintent変更
UPDATE "Templates" 
SET intent = 'check', status = 'approved', updated_at = NOW()
WHERE id = 188;

-- 3. 更新後の確認
SELECT id, title, category, intent, tone, status, usageLabel
FROM "Templates" 
WHERE id = 188;

-- 4. access/vehicle の承認済みテンプレート確認
SELECT 
  category,
  intent,
  tone,
  COUNT(*) as count
FROM "Templates" 
WHERE status = 'approved' 
  AND category IN ('access', 'vehicle')
GROUP BY category, intent, tone
ORDER BY category, intent, tone; 