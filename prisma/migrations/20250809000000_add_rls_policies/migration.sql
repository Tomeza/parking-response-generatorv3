-- CreateTable
-- This migration adds RLS policies to existing tables

-- Enable RLS on all tables
ALTER TABLE "public"."Templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ResponseLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RoutingLogs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FeedbackLogs" ENABLE ROW LEVEL SECURITY;

-- Force RLS (prevent owner bypass)
ALTER TABLE "public"."Templates" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."ResponseLog" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."RoutingLogs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."FeedbackLogs" FORCE ROW LEVEL SECURITY;

-- Grant schema usage permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant select permission on Templates table
GRANT SELECT ON TABLE "public"."Templates" TO anon, authenticated;

-- Create RLS policy for Templates (approved only)
DROP POLICY IF EXISTS read_approved_templates ON "public"."Templates";
CREATE POLICY read_approved_templates
ON "public"."Templates"
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (status = 'approved');

-- Revoke all permissions from log tables (client access denied)
REVOKE ALL ON TABLE "public"."ResponseLog" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."RoutingLogs" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."FeedbackLogs" FROM anon, authenticated;

-- Create index for status filtering (performance optimization)
CREATE INDEX IF NOT EXISTS idx_templates_status ON "public"."Templates"(status); 