-- CreateTable
CREATE TABLE "public"."Templates" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "variables" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector,

    CONSTRAINT "Templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoutingLogs" (
    "id" SERIAL NOT NULL,
    "query_text" TEXT NOT NULL,
    "detected_category" TEXT NOT NULL,
    "detected_intent" TEXT NOT NULL,
    "detected_tone" TEXT NOT NULL,
    "selected_template_id" INTEGER,
    "confidence_score" DOUBLE PRECISION,
    "is_fallback" BOOLEAN NOT NULL DEFAULT false,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "RoutingLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedbackLogs" (
    "id" SERIAL NOT NULL,
    "routing_log_id" INTEGER,
    "is_correct" BOOLEAN,
    "correction_type" TEXT,
    "corrected_value" TEXT,
    "feedback_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,

    CONSTRAINT "FeedbackLogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Templates_category_intent_tone_idx" ON "public"."Templates"("category", "intent", "tone");

-- CreateIndex
CREATE INDEX "Templates_is_approved_idx" ON "public"."Templates"("is_approved");

-- CreateIndex
CREATE INDEX "RoutingLogs_created_at_idx" ON "public"."RoutingLogs"("created_at");

-- CreateIndex
CREATE INDEX "RoutingLogs_detected_category_idx" ON "public"."RoutingLogs"("detected_category");

-- CreateIndex
CREATE INDEX "RoutingLogs_selected_template_id_idx" ON "public"."RoutingLogs"("selected_template_id");

-- CreateIndex
CREATE INDEX "FeedbackLogs_routing_log_id_idx" ON "public"."FeedbackLogs"("routing_log_id");

-- CreateIndex
CREATE INDEX "FeedbackLogs_created_at_idx" ON "public"."FeedbackLogs"("created_at");

-- CreateIndex
CREATE INDEX "FeedbackLogs_is_correct_idx" ON "public"."FeedbackLogs"("is_correct");
