-- ========================================
-- 駐車場レスポンス生成器 ダッシュボード用SQL
-- Phase3 Shadow/Canary 監視用
-- ========================================

-- 1. 主要KPI（分粒度）
-- 成功率 / Fallback率 / P95
WITH base AS (
  SELECT 
    date_trunc('minute', created_at) AS ts,
    processing_time_ms,
    is_fallback::int AS fb,
    CASE 
      WHEN is_fallback = true THEN 0
      ELSE 1
    END AS success
  FROM "RoutingLogs"
  WHERE created_at > now() - interval '24 hours'
)
SELECT 
  ts,
  COUNT(*) AS total_requests,
  ROUND(AVG(success) * 100, 2) AS success_rate_percent,
  ROUND(AVG(fb) * 100, 2) AS fallback_rate_percent,
  ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY processing_time_ms), 2) AS p95_ms,
  ROUND(AVG(processing_time_ms), 2) AS avg_ms
FROM base
GROUP BY ts
ORDER BY ts DESC
LIMIT 60; -- 直近60分

-- 2. 誤分類トップ（Fallback原因分析）
SELECT 
  detected_category, 
  detected_intent, 
  detected_tone,
  COUNT(*) AS cnt,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM "RoutingLogs"
WHERE is_fallback = true
  AND created_at > now() - interval '24 hours'
GROUP BY detected_category, detected_intent, detected_tone
ORDER BY cnt DESC
LIMIT 20;

-- 3. 処理時間分布（パフォーマンス監視）
SELECT 
  CASE 
    WHEN processing_time_ms < 100 THEN '0-100ms'
    WHEN processing_time_ms < 200 THEN '100-200ms'
    WHEN processing_time_ms < 400 THEN '200-400ms'
    WHEN processing_time_ms < 600 THEN '400-600ms'
    ELSE '600ms+'
  END AS time_bucket,
  COUNT(*) AS request_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM "RoutingLogs"
WHERE created_at > now() - interval '1 hour'
GROUP BY time_bucket
ORDER BY 
  CASE time_bucket
    WHEN '0-100ms' THEN 1
    WHEN '100-200ms' THEN 2
    WHEN '200-400ms' THEN 3
    WHEN '400-600ms' THEN 4
    ELSE 5
  END;

-- 4. カテゴリ別成功率
SELECT 
  detected_category,
  detected_intent,
  detected_tone,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE is_fallback = false) AS successful_requests,
  ROUND(
    COUNT(*) FILTER (WHERE is_fallback = false) * 100.0 / COUNT(*), 
    2
  ) AS success_rate_percent
FROM "RoutingLogs"
WHERE created_at > now() - interval '24 hours'
GROUP BY detected_category, detected_intent, detected_tone
HAVING COUNT(*) >= 5  -- 最低5件以上
ORDER BY success_rate_percent ASC, total_requests DESC;

-- 5. リアルタイム監視（直近5分）
SELECT 
  date_trunc('minute', created_at) AS minute,
  COUNT(*) AS requests,
  COUNT(*) FILTER (WHERE is_fallback = true) AS fallbacks,
  ROUND(AVG(processing_time_ms), 2) AS avg_ms,
  ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY processing_time_ms), 2) AS p95_ms
FROM "RoutingLogs"
WHERE created_at > now() - interval '5 minutes'
GROUP BY minute
ORDER BY minute DESC;

-- 6. エラー率監視（アラート用）
SELECT 
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE is_fallback = true) AS fallback_count,
  ROUND(
    COUNT(*) FILTER (WHERE is_fallback = true) * 100.0 / COUNT(*), 
    2
  ) AS fallback_rate_percent,
  ROUND(AVG(processing_time_ms), 2) AS avg_processing_time_ms
FROM "RoutingLogs"
WHERE created_at > now() - interval '5 minutes';

-- 7. Shadow/Canary トラフィック分析
SELECT 
  CASE 
    WHEN session_id = 'shadow' THEN 'Shadow'
    WHEN session_id = 'canary' THEN 'Canary'
    ELSE 'Production'
  END AS traffic_type,
  COUNT(*) AS requests,
  COUNT(*) FILTER (WHERE is_fallback = true) AS fallbacks,
  ROUND(
    COUNT(*) FILTER (WHERE is_fallback = true) * 100.0 / COUNT(*), 
    2
  ) AS fallback_rate_percent,
  ROUND(AVG(processing_time_ms), 2) AS avg_ms
FROM "RoutingLogs"
WHERE created_at > now() - interval '1 hour'
  AND session_id IN ('shadow', 'canary')
GROUP BY traffic_type
ORDER BY traffic_type;

-- 8. テンプレート使用頻度
SELECT 
  selected_template_id,
  COUNT(*) AS usage_count,
  COUNT(*) FILTER (WHERE is_fallback = false) AS successful_usage,
  ROUND(
    COUNT(*) FILTER (WHERE is_fallback = false) * 100.0 / COUNT(*), 
    2
  ) AS success_rate_percent
FROM "RoutingLogs"
WHERE created_at > now() - interval '24 hours'
  AND selected_template_id IS NOT NULL
GROUP BY selected_template_id
ORDER BY usage_count DESC
LIMIT 20;

-- 9. 時間帯別分析
SELECT 
  EXTRACT(hour FROM created_at) AS hour_of_day,
  COUNT(*) AS requests,
  COUNT(*) FILTER (WHERE is_fallback = true) AS fallbacks,
  ROUND(
    COUNT(*) FILTER (WHERE is_fallback = true) * 100.0 / COUNT(*), 
    2
  ) AS fallback_rate_percent,
  ROUND(AVG(processing_time_ms), 2) AS avg_ms
FROM "RoutingLogs"
WHERE created_at > now() - interval '7 days'
GROUP BY hour_of_day
ORDER BY hour_of_day;

-- 10. アラート条件チェック（運用用）
-- Fallback率 > 2%（5分移動平均）
WITH alert_check AS (
  SELECT 
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE is_fallback = true) AS fallback_count,
    ROUND(
      COUNT(*) FILTER (WHERE is_fallback = true) * 100.0 / COUNT(*), 
      2
    ) AS fallback_rate_percent,
    ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY processing_time_ms), 2) AS p95_ms
  FROM "RoutingLogs"
  WHERE created_at > now() - interval '5 minutes'
)
SELECT 
  CASE 
    WHEN fallback_rate_percent > 2 THEN '🚨 FALLBACK_RATE_HIGH'
    WHEN p95_ms > 600 THEN '🚨 P95_SLOW'
    ELSE '✅ HEALTHY'
  END AS alert_status,
  total_requests,
  fallback_count,
  fallback_rate_percent,
  p95_ms
FROM alert_check; 