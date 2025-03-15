-- CreateTable
CREATE TABLE "SearchSynonym" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(50) NOT NULL,
    "synonym" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchSynonym_word_synonym_key" ON "SearchSynonym"("word", "synonym"); 