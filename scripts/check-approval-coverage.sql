-- Phase2.5: 承認カバレッジ監査

-- 1. カテゴリ別の承認件数
SELECT 
  category, 
  COUNT(*) as approved_count,
  COUNT(*) FILTER (WHERE intent = 'check') as check_count,
  COUNT(*) FILTER (WHERE intent = 'inquiry') as inquiry_count,
  COUNT(*) FILTER (WHERE intent = 'create') as create_count,
  COUNT(*) FILTER (WHERE intent = 'modify') as modify_count,
  COUNT(*) FILTER (WHERE intent = 'cancel') as cancel_count,
  COUNT(*) FILTER (WHERE intent = 'report') as report_count
FROM "Templates" 
WHERE status = 'approved' 
GROUP BY category 
ORDER BY approved_count DESC;

-- 2. access/vehicle のドラフトから一次候補を確認
SELECT 
  id,
  title,
  category,
  intent,
  tone,
  usageLabel,
  updated_at,
  replyTypeTags,
  infoSourceTags,
  situationTags
FROM "Templates" 
WHERE status = 'draft' 
  AND category IN ('access', 'vehicle')
ORDER BY 
  COALESCE(usageLabel, '') DESC, 
  updated_at DESC
LIMIT 20;

-- 3. 承認済みテンプレートの詳細確認
SELECT 
  id,
  title,
  category,
  intent,
  tone,
  usageLabel,
  updated_at
FROM "Templates" 
WHERE status = 'approved'
  AND category IN ('access', 'vehicle')
ORDER BY category, intent, tone; 