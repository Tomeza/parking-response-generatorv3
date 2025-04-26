-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgroonga";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "Knowledge" (
    "id" SERIAL NOT NULL,
    "main_category" VARCHAR(50),
    "sub_category" VARCHAR(50),
    "detail_category" VARCHAR(50),
    "question" TEXT,
    "answer" TEXT NOT NULL,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "usage" VARCHAR(10),
    "note" TEXT,
    "issue" TEXT,
    "embedding_vector" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "Knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "tag_name" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeTag" (
    "knowledge_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "KnowledgeTag_pkey" PRIMARY KEY ("knowledge_id","tag_id")
);

-- CreateTable
CREATE TABLE "AlertWord" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "related_tag_id" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "AlertWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseLog" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "used_knowledge_ids" INTEGER[],
    "missing_tags" TEXT[],
    "missing_alerts" TEXT[],
    "feedback" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "knowledge_id" INTEGER,
    "response_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ResponseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalInfo" (
    "id" SERIAL NOT NULL,
    "info_type" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonalInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackWeight" (
    "query_pattern" VARCHAR(100) NOT NULL,
    "knowledge_id" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "positive_count" INTEGER NOT NULL DEFAULT 0,
    "negative_count" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackWeight_pkey" PRIMARY KEY ("query_pattern","knowledge_id")
);

-- CreateTable
CREATE TABLE "TagSynonym" (
    "id" SERIAL NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "synonym" VARCHAR(50) NOT NULL,

    CONSTRAINT "TagSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchSynonym" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(50) NOT NULL,
    "synonym" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeQuestionVariation" (
    "id" SERIAL NOT NULL,
    "knowledge_id" INTEGER NOT NULL,
    "variation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeQuestionVariation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Knowledge_question_answer_idx" ON "Knowledge"("question", "answer");

-- CreateIndex
CREATE INDEX "Knowledge_main_category_sub_category_idx" ON "Knowledge"("main_category", "sub_category");

-- CreateIndex
CREATE INDEX "Knowledge_detail_category_idx" ON "Knowledge"("detail_category");

-- CreateIndex
CREATE INDEX "knowledge_pgroonga_answer_idx" ON "Knowledge"("answer");

-- CreateIndex
CREATE INDEX "knowledge_pgroonga_question_idx" ON "Knowledge"("question");

-- CreateIndex
CREATE INDEX "knowledge_search_vector_gin_idx" ON "Knowledge" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "knowledge_pgroonga_detail_category_idx" ON "Knowledge"("detail_category");

-- CreateIndex
CREATE INDEX "knowledge_pgroonga_main_category_idx" ON "Knowledge"("main_category");

-- CreateIndex
CREATE INDEX "knowledge_pgroonga_sub_category_idx" ON "Knowledge"("sub_category");

-- CreateIndex
CREATE INDEX "knowledge_embedding_vector_idx" ON "Knowledge"("embedding_vector");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tag_name_key" ON "Tag"("tag_name");

-- CreateIndex
CREATE UNIQUE INDEX "AlertWord_word_key" ON "AlertWord"("word");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackWeight_query_pattern_knowledge_id_key" ON "FeedbackWeight"("query_pattern", "knowledge_id");

-- CreateIndex
CREATE UNIQUE INDEX "TagSynonym_tag_id_synonym_key" ON "TagSynonym"("tag_id", "synonym");

-- CreateIndex
CREATE INDEX "SearchHistory_query_idx" ON "SearchHistory"("query");

-- CreateIndex
CREATE INDEX "SearchHistory_category_idx" ON "SearchHistory"("category");

-- CreateIndex
CREATE INDEX "SearchHistory_tags_idx" ON "SearchHistory"("tags");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SearchSynonym_word_synonym_key" ON "SearchSynonym"("word", "synonym");

-- CreateIndex
CREATE INDEX "KnowledgeQuestionVariation_variation_idx" ON "KnowledgeQuestionVariation"("variation");

-- CreateIndex
CREATE INDEX "KnowledgeQuestionVariation_knowledge_id_idx" ON "KnowledgeQuestionVariation"("knowledge_id");

-- AddForeignKey
ALTER TABLE "KnowledgeTag" ADD CONSTRAINT "KnowledgeTag_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "Knowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeTag" ADD CONSTRAINT "KnowledgeTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertWord" ADD CONSTRAINT "AlertWord_related_tag_id_fkey" FOREIGN KEY ("related_tag_id") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseLog" ADD CONSTRAINT "ResponseLog_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "Knowledge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackWeight" ADD CONSTRAINT "FeedbackWeight_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "Knowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagSynonym" ADD CONSTRAINT "TagSynonym_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeQuestionVariation" ADD CONSTRAINT "KnowledgeQuestionVariation_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "Knowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

