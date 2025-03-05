/*
  Warnings:

  - You are about to drop the column `category` on the `SearchHistory` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `SearchHistory` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `SearchHistory` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SearchHistory` table. All the data in the column will be lost.
  - Added the required column `clicked_knowledge_id` to the `SearchHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clicked_position` to the `SearchHistory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SearchHistory_category_idx";

-- DropIndex
DROP INDEX "SearchHistory_query_idx";

-- DropIndex
DROP INDEX "SearchHistory_tags_idx";

-- AlterTable
ALTER TABLE "SearchHistory" DROP COLUMN "category",
DROP COLUMN "createdAt",
DROP COLUMN "tags",
DROP COLUMN "updatedAt",
ADD COLUMN     "clicked_knowledge_id" INTEGER NOT NULL,
ADD COLUMN     "clicked_position" INTEGER NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
