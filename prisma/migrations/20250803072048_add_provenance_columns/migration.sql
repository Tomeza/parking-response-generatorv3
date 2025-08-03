/*
  Warnings:

  - You are about to drop the column `embedding` on the `Templates` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Templates_category_intent_tone_idx";

-- DropIndex
DROP INDEX "public"."Templates_is_approved_idx";

-- AlterTable
ALTER TABLE "public"."Templates" DROP COLUMN "embedding",
ADD COLUMN     "infoSourceTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "note" TEXT,
ADD COLUMN     "replyTypeTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "situationTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "source" TEXT,
ADD COLUMN     "sourceHash" TEXT,
ADD COLUMN     "sourceRowId" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'approved',
ADD COLUMN     "usageLabel" TEXT,
ALTER COLUMN "is_approved" SET DEFAULT true;

-- CreateIndex
CREATE INDEX "Templates_category_intent_tone_status_idx" ON "public"."Templates"("category", "intent", "tone", "status");
