/*
  Warnings:

  - You are about to drop the column `description` on the `AlertWord` table. All the data in the column will be lost.
  - The primary key for the `KnowledgeTag` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `tag_name` on the `Tag` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[knowledge_id,tag_id]` on the table `KnowledgeTag` will be added. If there are existing duplicate values, this will fail.
  - Made the column `main_category` on table `Knowledge` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sub_category` on table `Knowledge` required. This step will fail if there are existing NULL values in that column.
  - Made the column `question` on table `Knowledge` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Tag_tag_name_key";

-- AlterTable
ALTER TABLE "AlertWord" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "Knowledge" ADD COLUMN     "answer_tsv" tsvector,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "question_tsv" tsvector,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "main_category" SET NOT NULL,
ALTER COLUMN "sub_category" SET NOT NULL,
ALTER COLUMN "detail_category" SET DATA TYPE TEXT,
ALTER COLUMN "question" SET NOT NULL;

-- AlterTable
ALTER TABLE "KnowledgeTag" DROP CONSTRAINT "KnowledgeTag_pkey",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "KnowledgeTag_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "tag_name",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "name" VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Knowledge_main_category_sub_category_idx" ON "Knowledge"("main_category", "sub_category");

-- CreateIndex
CREATE INDEX "Knowledge_question_tsv_idx" ON "Knowledge" USING GIN ("question_tsv");

-- CreateIndex
CREATE INDEX "Knowledge_answer_tsv_idx" ON "Knowledge" USING GIN ("answer_tsv");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTag_knowledge_id_tag_id_key" ON "KnowledgeTag"("knowledge_id", "tag_id");
