-- FaqReviewHistory フィールド名の修正
ALTER TABLE "public"."faq_review_history"
RENAME COLUMN "original_answer" TO "originalAnswer";

ALTER TABLE "public"."faq_review_history"
RENAME COLUMN "refined_answer" TO "refinedAnswer";

ALTER TABLE "public"."faq_review_history"
RENAME COLUMN "review_type" TO "reviewType";

-- FaqReviewTriggers フィールド名の修正
ALTER TABLE "public"."faq_review_triggers"
RENAME COLUMN "is_active" TO "isActive";

ALTER TABLE "public"."faq_review_triggers"
RENAME COLUMN "condition_type" TO "conditionType";

-- インデックスの更新
DROP INDEX IF EXISTS "faq_review_triggers_is_active_idx";
CREATE INDEX "faq_review_triggers_isActive_idx" ON "public"."faq_review_triggers" ("isActive");

-- コメント
COMMENT ON COLUMN "public"."faq_review_history"."originalAnswer" IS 'Original answer before review';
COMMENT ON COLUMN "public"."faq_review_history"."refinedAnswer" IS 'Refined answer after review';
COMMENT ON COLUMN "public"."faq_review_history"."reviewType" IS 'Type of review performed';
COMMENT ON COLUMN "public"."faq_review_triggers"."isActive" IS 'Whether this trigger is currently active';
COMMENT ON COLUMN "public"."faq_review_triggers"."conditionType" IS 'Type of condition for triggering review'; 