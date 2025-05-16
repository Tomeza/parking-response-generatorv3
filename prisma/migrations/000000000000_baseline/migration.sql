-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "extensions";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "public"."Knowledge" (
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "embedding_vector" vector,

    CONSTRAINT "Knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" SERIAL NOT NULL,
    "tag_name" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KnowledgeTag" (
    "knowledge_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "KnowledgeTag_pkey" PRIMARY KEY ("knowledge_id","tag_id")
);

-- CreateTable
CREATE TABLE "public"."AlertWord" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "related_tag_id" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "AlertWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResponseLog" (
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
CREATE TABLE "public"."SeasonalInfo" (
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
CREATE TABLE "public"."FeedbackWeight" (
    "query_pattern" VARCHAR(100) NOT NULL,
    "knowledge_id" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "positive_count" INTEGER NOT NULL DEFAULT 0,
    "negative_count" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackWeight_pkey" PRIMARY KEY ("query_pattern","knowledge_id")
);

-- CreateTable
CREATE TABLE "public"."TagSynonym" (
    "id" SERIAL NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "synonym" VARCHAR(50) NOT NULL,

    CONSTRAINT "TagSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SearchHistory" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminUser" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SearchSynonym" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(50) NOT NULL,
    "synonym" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KnowledgeQuestionVariation" (
    "id" SERIAL NOT NULL,
    "knowledge_id" INTEGER NOT NULL,
    "variation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeQuestionVariation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Knowledge_question_answer_idx" ON "public"."Knowledge"("question", "answer");

-- CreateIndex
CREATE INDEX "Knowledge_main_category_sub_category_idx" ON "public"."Knowledge"("main_category", "sub_category");

-- CreateIndex
CREATE INDEX "Knowledge_detail_category_idx" ON "public"."Knowledge"("detail_category");

-- CreateIndex
CREATE INDEX "knowledge_pgroonga_answer_idx" ON "public"."Knowledge"("answer");

-- CreateIndex
CREATE INDEX "knowledge_pgroonga_question_idx" ON "public"."Knowledge"("question");

-- CreateIndex
CREATE INDEX "knowledge_pgroonga_main_category_idx" ON "public"."Knowledge"("main_category");

-- CreateIndex
CREATE INDEX "knowledge_pgroonga_sub_category_idx" ON "public"."Knowledge"("sub_category");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tag_name_key" ON "public"."Tag"("tag_name");

-- CreateIndex
CREATE UNIQUE INDEX "AlertWord_word_key" ON "public"."AlertWord"("word");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackWeight_query_pattern_knowledge_id_key" ON "public"."FeedbackWeight"("query_pattern", "knowledge_id");

-- CreateIndex
CREATE UNIQUE INDEX "TagSynonym_tag_id_synonym_key" ON "public"."TagSynonym"("tag_id", "synonym");

-- CreateIndex
CREATE INDEX "SearchHistory_query_idx" ON "public"."SearchHistory"("query");

-- CreateIndex
CREATE INDEX "SearchHistory_category_idx" ON "public"."SearchHistory"("category");

-- CreateIndex
CREATE INDEX "SearchHistory_tags_idx" ON "public"."SearchHistory"("tags");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "public"."AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "public"."AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SearchSynonym_word_synonym_key" ON "public"."SearchSynonym"("word", "synonym");

-- CreateIndex
CREATE INDEX "KnowledgeQuestionVariation_variation_idx" ON "public"."KnowledgeQuestionVariation"("variation");

-- CreateIndex
CREATE INDEX "KnowledgeQuestionVariation_knowledge_id_idx" ON "public"."KnowledgeQuestionVariation"("knowledge_id");

-- AddForeignKey
ALTER TABLE "public"."KnowledgeTag" ADD CONSTRAINT "KnowledgeTag_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "public"."Knowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KnowledgeTag" ADD CONSTRAINT "KnowledgeTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlertWord" ADD CONSTRAINT "AlertWord_related_tag_id_fkey" FOREIGN KEY ("related_tag_id") REFERENCES "public"."Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResponseLog" ADD CONSTRAINT "ResponseLog_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "public"."Knowledge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackWeight" ADD CONSTRAINT "FeedbackWeight_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "public"."Knowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagSynonym" ADD CONSTRAINT "TagSynonym_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KnowledgeQuestionVariation" ADD CONSTRAINT "KnowledgeQuestionVariation_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "public"."Knowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

