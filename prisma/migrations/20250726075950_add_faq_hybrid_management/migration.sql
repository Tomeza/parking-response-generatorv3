/*
  Warnings:

  - You are about to drop the `faq_refined` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[faq_id]` on the table `faq_usage_stats` will be added. If there are existing duplicate values, this will fail.
  - Made the column `created_at` on table `faq_raw` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `faq_raw` required. This step will fail if there are existing NULL values in that column.
  - Made the column `complexity` on table `faq_raw` required. This step will fail if there are existing NULL values in that column.
  - Made the column `requires_review` on table `faq_raw` required. This step will fail if there are existing NULL values in that column.
  - Made the column `review_date` on table `faq_review_history` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_active` on table `faq_review_triggers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `faq_review_triggers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `faq_review_triggers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `query_count` on table `faq_usage_stats` required. This step will fail if there are existing NULL values in that column.
  - Made the column `feedback_positive` on table `faq_usage_stats` required. This step will fail if there are existing NULL values in that column.
  - Made the column `feedback_negative` on table `faq_usage_stats` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `faq_usage_stats` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."faq_review_history" DROP CONSTRAINT "faq_review_history_faq_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."faq_usage_stats" DROP CONSTRAINT "faq_usage_stats_faq_id_fkey";

-- DropIndex
DROP INDEX "public"."idx_knowledge_embedding_hnsw";

-- DropIndex
DROP INDEX "public"."idx_faq_raw_category";

-- DropIndex
DROP INDEX "public"."idx_faq_raw_complexity";

-- DropIndex
DROP INDEX "public"."idx_faq_raw_embedding";

-- DropIndex
DROP INDEX "public"."idx_faq_raw_question";

-- DropIndex
DROP INDEX "public"."idx_faq_raw_requires_review";

-- DropIndex
DROP INDEX "public"."idx_faq_review_history_faq_id";

-- DropIndex
DROP INDEX "public"."idx_faq_usage_stats_faq_id";

-- DropIndex
DROP INDEX "public"."idx_faq_usage_stats_query_count";

-- AlterTable
ALTER TABLE "public"."faq_raw" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "complexity" SET NOT NULL,
ALTER COLUMN "requires_review" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."faq_review_history" ALTER COLUMN "review_date" SET NOT NULL,
ALTER COLUMN "review_date" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."faq_review_triggers" ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."faq_usage_stats" ALTER COLUMN "query_count" SET NOT NULL,
ALTER COLUMN "feedback_positive" SET NOT NULL,
ALTER COLUMN "feedback_negative" SET NOT NULL,
ALTER COLUMN "last_used_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."faq_refined";

-- CreateIndex
CREATE UNIQUE INDEX "faq_usage_stats_faq_id_key" ON "public"."faq_usage_stats"("faq_id");

-- AddForeignKey
ALTER TABLE "public"."faq_review_history" ADD CONSTRAINT "faq_review_history_faq_id_fkey" FOREIGN KEY ("faq_id") REFERENCES "public"."faq_raw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."faq_usage_stats" ADD CONSTRAINT "faq_usage_stats_faq_id_fkey" FOREIGN KEY ("faq_id") REFERENCES "public"."faq_raw"("id") ON DELETE CASCADE ON UPDATE CASCADE;
