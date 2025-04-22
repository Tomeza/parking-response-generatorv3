/*
  Warnings:

  - The primary key for the `FeedbackWeight` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[query_pattern,knowledge_id]` on the table `FeedbackWeight` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "FeedbackWeight" DROP CONSTRAINT "FeedbackWeight_pkey",
ADD CONSTRAINT "FeedbackWeight_pkey" PRIMARY KEY ("query_pattern", "knowledge_id");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackWeight_query_pattern_knowledge_id_key" ON "FeedbackWeight"("query_pattern", "knowledge_id");
