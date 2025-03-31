-- CreateTable
CREATE TABLE "KnowledgeQuestionVariation" (
    "id" SERIAL NOT NULL,
    "knowledge_id" INTEGER NOT NULL,
    "variation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeQuestionVariation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeQuestionVariation_variation_idx" ON "KnowledgeQuestionVariation"("variation");

-- CreateIndex
CREATE INDEX "KnowledgeQuestionVariation_knowledge_id_idx" ON "KnowledgeQuestionVariation"("knowledge_id");

-- AddForeignKey
ALTER TABLE "KnowledgeQuestionVariation" ADD CONSTRAINT "KnowledgeQuestionVariation_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "Knowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
