-- AlterTable
ALTER TABLE "ResponseLog" ADD COLUMN     "knowledge_id" INTEGER;

-- AddForeignKey
ALTER TABLE "ResponseLog" ADD CONSTRAINT "ResponseLog_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "Knowledge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
