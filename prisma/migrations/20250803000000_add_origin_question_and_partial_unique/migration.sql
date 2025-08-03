-- Add originQuestion column
ALTER TABLE "public"."Templates" ADD COLUMN "originQuestion" TEXT;

-- Add partial unique constraint for approved templates
CREATE UNIQUE INDEX IF NOT EXISTS "uq_templates_approved_unique" ON "public"."Templates"("category", "intent", "tone") WHERE "status" = 'approved'; 