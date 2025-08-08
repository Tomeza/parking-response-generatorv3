-- RLS Policy Drift Detection Script
-- Run this in Supabase SQL Editor to check if policies match expected state

-- 1. Check if RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity = true THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('Templates', 'ResponseLog', 'RoutingLogs', 'FeedbackLogs')
ORDER BY tablename;

-- 2. Check if Force RLS is enabled
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity = true AND pg_get_expr(relrowsecurity, oid) = 'true' THEN '✅ Force RLS'
    WHEN rowsecurity = true THEN '⚠️ RLS Enabled (not forced)'
    ELSE '❌ RLS Disabled'
  END as force_rls_status
FROM pg_tables t
JOIN pg_class c ON t.tablename = c.relname
WHERE schemaname = 'public' 
  AND tablename IN ('Templates', 'ResponseLog', 'RoutingLogs', 'FeedbackLogs')
ORDER BY tablename;

-- 3. Check policies exist
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  roles, 
  cmd,
  permissive,
  CASE 
    WHEN policyname IS NOT NULL THEN '✅ Policy Exists'
    ELSE '❌ No Policy'
  END as policy_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('Templates', 'ResponseLog', 'RoutingLogs', 'FeedbackLogs')
ORDER BY tablename, policyname;

-- 4. Check permissions for anon/authenticated
SELECT 
  table_schema,
  table_name,
  privilege_type,
  grantee,
  CASE 
    WHEN privilege_type = 'SELECT' AND grantee IN ('anon', 'authenticated') THEN '✅ Select Granted'
    WHEN privilege_type = 'USAGE' AND grantee IN ('anon', 'authenticated') THEN '✅ Usage Granted'
    WHEN grantee IN ('anon', 'authenticated') THEN '⚠️ Other Permission'
    ELSE '❌ No Permission'
  END as permission_status
FROM information_schema.table_privileges 
WHERE table_schema = 'public'
  AND table_name IN ('Templates', 'ResponseLog', 'RoutingLogs', 'FeedbackLogs')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 5. Check schema permissions
SELECT 
  schema_name,
  privilege_type,
  grantee,
  CASE 
    WHEN privilege_type = 'USAGE' AND grantee IN ('anon', 'authenticated') THEN '✅ Schema Usage Granted'
    ELSE '❌ Schema Usage Missing'
  END as schema_permission_status
FROM information_schema.usage_privileges 
WHERE schema_name = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- 6. Summary check (expected state)
WITH expected_state AS (
  SELECT 
    'Templates' as table_name,
    true as should_have_rls,
    true as should_have_policy,
    true as should_grant_select,
    'read_approved_templates' as expected_policy
  UNION ALL
  SELECT 
    'ResponseLog' as table_name,
    true as should_have_rls,
    false as should_have_policy,
    false as should_grant_select,
    NULL as expected_policy
  UNION ALL
  SELECT 
    'RoutingLogs' as table_name,
    true as should_have_rls,
    false as should_have_policy,
    false as should_grant_select,
    NULL as expected_policy
  UNION ALL
  SELECT 
    'FeedbackLogs' as table_name,
    true as should_have_rls,
    false as should_have_policy,
    false as should_grant_select,
    NULL as expected_policy
)
SELECT 
  es.table_name,
  CASE 
    WHEN t.rowsecurity = es.should_have_rls THEN '✅ RLS Correct'
    ELSE '❌ RLS Mismatch'
  END as rls_status,
  CASE 
    WHEN es.should_have_policy AND p.policyname IS NOT NULL THEN '✅ Policy Correct'
    WHEN NOT es.should_have_policy AND p.policyname IS NULL THEN '✅ No Policy Correct'
    ELSE '❌ Policy Mismatch'
  END as policy_status,
  CASE 
    WHEN es.should_grant_select AND tp.privilege_type = 'SELECT' THEN '✅ Select Correct'
    WHEN NOT es.should_grant_select AND tp.privilege_type IS NULL THEN '✅ No Select Correct'
    ELSE '❌ Select Mismatch'
  END as select_status
FROM expected_state es
LEFT JOIN pg_tables t ON t.tablename = es.table_name AND t.schemaname = 'public'
LEFT JOIN pg_policies p ON p.tablename = es.table_name AND p.schemaname = 'public' AND p.policyname = es.expected_policy
LEFT JOIN information_schema.table_privileges tp ON tp.table_name = es.table_name AND tp.table_schema = 'public' AND tp.grantee IN ('anon', 'authenticated') AND tp.privilege_type = 'SELECT'
ORDER BY es.table_name; 