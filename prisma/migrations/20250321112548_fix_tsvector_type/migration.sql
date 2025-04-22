/*
  Warnings:

  - You are about to alter the column `search_vector` on the `Knowledge` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("tsvector")` to `Text`.

*/
-- DropIndex
DROP INDEX "Knowledge_search_vector_idx";

-- AlterTable
ALTER TABLE "Knowledge" ALTER COLUMN "search_vector" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Knowledge_search_vector_idx" ON "Knowledge"("search_vector");
