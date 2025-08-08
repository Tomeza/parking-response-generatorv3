-- RLS: Initial Security Policies (Fixed)
-- Date: 2025-08-08
-- Purpose: Enable RLS and apply minimal policies for templates and logs
-- Note: Using correct table names and PostgreSQL syntax

-- === 1) Templates: 承認済みのみ公開読み取り ===
alter table public."Templates" enable row level security;
alter table public."Templates" force row level security;

-- 権限の初期化と読み取りだけ付与
revoke all on table public."Templates" from anon, authenticated;
grant select on table public."Templates" to anon, authenticated;

-- 既存ポリシーを落としてから作り直し
drop policy if exists read_approved_templates on public."Templates";

create policy read_approved_templates
on public."Templates"
as permissive
for select
to anon, authenticated
using (status = 'approved');

-- === 2) ResponseLog: クライアントからは一切不可 ===
alter table public."ResponseLog" enable row level security;
alter table public."ResponseLog" force row level security;
revoke all on table public."ResponseLog" from anon, authenticated;
drop policy if exists write_response_log on public."ResponseLog";

-- === 3) RoutingLogs: クライアントからは一切不可 ===
alter table public."RoutingLogs" enable row level security;
alter table public."RoutingLogs" force row level security;
revoke all on table public."RoutingLogs" from anon, authenticated;
drop policy if exists write_routing_logs on public."RoutingLogs";

-- === 4) FeedbackLogs: クライアントからは一切不可 ===
alter table public."FeedbackLogs" enable row level security;
alter table public."FeedbackLogs" force row level security;
revoke all on table public."FeedbackLogs" from anon, authenticated;
drop policy if exists write_feedback_logs on public."FeedbackLogs";

-- === 5) Knowledge: クライアントからは一切不可 ===
alter table public."Knowledge" enable row level security;
alter table public."Knowledge" force row level security;
revoke all on table public."Knowledge" from anon, authenticated;
drop policy if exists write_knowledge on public."Knowledge";

-- === 6) その他のテーブル: 全閉（必要に応じて個別開放） ===
-- Tag, KnowledgeTag, AlertWord, SeasonalInfo, FeedbackWeight, TagSynonym, SearchHistory, AdminUser, SearchSynonym, KnowledgeQuestionVariation, FaqRaw, FaqReviewHistory, FaqReviewTriggers, FaqUsageStats, FaqClassificationLog

-- === ロールバック用（必要になったら） ===
/*
drop policy if exists read_approved_templates on public."Templates";
alter table public."Templates" disable row level security;
alter table public."ResponseLog" disable row level security;
alter table public."RoutingLogs" disable row level security;
alter table public."FeedbackLogs" disable row level security;
alter table public."Knowledge" disable row level security;
*/ 