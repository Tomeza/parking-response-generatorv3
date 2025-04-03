CREATE EXTENSION IF NOT EXISTS pgroonga;

/*
  Warnings:

  - You are about to alter the column `search_vector` on the `Knowledge` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Unsupported("tsvector")`.

*/
-- DropIndex
DROP INDEX "Knowledge_search_vector_idx";

-- AlterTable
ALTER TABLE "Knowledge" ALTER COLUMN "search_vector" SET DATA TYPE tsvector USING search_vector::tsvector;

-- AlterTable
ALTER TABLE "ResponseLog" ADD COLUMN     "response_count" INTEGER NOT NULL DEFAULT 1;

-- Drop existing default PGroonga indexes if they exist (optional but safe)
DROP INDEX IF EXISTS "knowledge_pgroonga_question_idx";
DROP INDEX IF EXISTS "knowledge_pgroonga_answer_idx";
DROP INDEX IF EXISTS "knowledge_pgroonga_main_category_idx";
DROP INDEX IF EXISTS "knowledge_pgroonga_sub_category_idx";
DROP INDEX IF EXISTS "knowledge_pgroonga_detail_category_idx";

-- Create PGroonga index for question (using default tokenizer)
CREATE INDEX "knowledge_pgroonga_question_idx" ON "Knowledge" USING pgroonga (question);

-- Create PGroonga index for answer (using default tokenizer)
CREATE INDEX "knowledge_pgroonga_answer_idx" ON "Knowledge" USING pgroonga (answer);

-- Create PGroonga index for main_category (using default tokenizer)
CREATE INDEX "knowledge_pgroonga_main_category_idx" ON "Knowledge" USING pgroonga (main_category);

-- Create PGroonga index for sub_category (using default tokenizer)
CREATE INDEX "knowledge_pgroonga_sub_category_idx" ON "Knowledge" USING pgroonga (sub_category);

-- Create PGroonga index for detail_category (using default tokenizer)
CREATE INDEX "knowledge_pgroonga_detail_category_idx" ON "Knowledge" USING pgroonga (detail_category);

-- CreateIndex
CREATE INDEX "knowledge_search_vector_gin_idx" ON "Knowledge" USING GIN ("search_vector");
