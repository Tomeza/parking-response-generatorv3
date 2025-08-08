-- Complete RLS permissions setup
-- 2025-08-08: Complete permissions for proper RLS testing

-- 1. Grant schema usage permissions (required for REST API access)
grant usage on schema public to anon, authenticated;

-- 2. Grant select permission on Templates table
grant select on table public."Templates" to anon, authenticated;

-- 3. Drop and recreate the RLS policy for Templates
drop policy if exists read_approved_templates on public."Templates";

create policy read_approved_templates
on public."Templates"
as permissive
for select
to anon, authenticated
using (status = 'approved');

-- 4. Ensure RLS is enabled and forced on all tables
alter table public."Templates" enable row level security;
alter table public."Templates" force row level security;

alter table public."ResponseLog" enable row level security;
alter table public."ResponseLog" force row level security;

alter table public."RoutingLogs" enable row level security;
alter table public."RoutingLogs" force row level security;

alter table public."FeedbackLogs" enable row level security;
alter table public."FeedbackLogs" force row level security;

-- 5. Revoke all permissions from log tables (client access denied)
revoke all on table public."ResponseLog" from anon, authenticated;
revoke all on table public."RoutingLogs" from anon, authenticated;
revoke all on table public."FeedbackLogs" from anon, authenticated;

-- 6. Verify policies exist
select 
  schemaname, 
  tablename, 
  policyname, 
  roles, 
  cmd,
  permissive
from pg_policies
where schemaname='public' 
  and tablename in ('Templates','ResponseLog','RoutingLogs','FeedbackLogs')
order by tablename, policyname; 