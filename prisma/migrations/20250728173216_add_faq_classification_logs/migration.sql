/*
  Warnings:

  - Made the column `usedAt` on table `faq_usage_stats` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."faq_raw" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "complexity" DROP NOT NULL,
ALTER COLUMN "complexity" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."faq_usage_stats" ALTER COLUMN "usedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."FaqClassificationLog" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqClassificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FaqClassificationLog_faqId_idx" ON "public"."FaqClassificationLog"("faqId");

-- CreateIndex
CREATE INDEX "FaqClassificationLog_category_idx" ON "public"."FaqClassificationLog"("category");

-- CreateIndex
CREATE INDEX "FaqClassificationLog_createdAt_idx" ON "public"."FaqClassificationLog"("createdAt");
