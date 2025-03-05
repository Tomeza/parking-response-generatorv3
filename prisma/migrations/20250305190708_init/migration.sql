-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateTable
CREATE TABLE "Knowledge" (
    "id" SERIAL NOT NULL,
    "main_category" VARCHAR(50) NOT NULL,
    "sub_category" VARCHAR(50) NOT NULL,
    "detail_category" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "usage" VARCHAR(10),
    "note" TEXT,
    "issue" TEXT,
    "search_vector" tsvector,
    "answer_tsv" tsvector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "question_tsv" tsvector,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(50) NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeTag" (
    "knowledge_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL,

    CONSTRAINT "KnowledgeTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertWord" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(50) NOT NULL,
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

    CONSTRAINT "FeedbackWeight_pkey" PRIMARY KEY ("query_pattern")
);

-- CreateTable
CREATE TABLE "TagSynonym" (
    "id" SERIAL NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "synonym" VARCHAR(50) NOT NULL,

    CONSTRAINT "TagSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusyPeriod" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusyPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LargeVehicleSeason" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LargeVehicleSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryWeight" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagWeight" (
    "id" SERIAL NOT NULL,
    "tag" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "ts_query" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "analysis" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Knowledge_main_category_sub_category_idx" ON "Knowledge"("main_category", "sub_category");

-- CreateIndex
CREATE INDEX "Knowledge_search_vector_idx" ON "Knowledge" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "Knowledge_question_tsv_idx" ON "Knowledge" USING GIN ("question_tsv");

-- CreateIndex
CREATE INDEX "Knowledge_answer_tsv_idx" ON "Knowledge" USING GIN ("answer_tsv");

-- CreateIndex
CREATE INDEX "knowledge_answer_tsv_idx" ON "Knowledge" USING GIN ("answer_tsv");

-- CreateIndex
CREATE INDEX "knowledge_question_tsv_idx" ON "Knowledge" USING GIN ("question_tsv");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTag_knowledge_id_tag_id_key" ON "KnowledgeTag"("knowledge_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "AlertWord_word_key" ON "AlertWord"("word");

-- CreateIndex
CREATE UNIQUE INDEX "TagSynonym_tag_id_synonym_key" ON "TagSynonym"("tag_id", "synonym");

-- CreateIndex
CREATE INDEX "BusyPeriod_startDate_endDate_idx" ON "BusyPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "BusyPeriod_year_idx" ON "BusyPeriod"("year");

-- CreateIndex
CREATE INDEX "LargeVehicleSeason_startDate_endDate_idx" ON "LargeVehicleSeason"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "LargeVehicleSeason_year_idx" ON "LargeVehicleSeason"("year");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryWeight_category_key" ON "CategoryWeight"("category");

-- CreateIndex
CREATE UNIQUE INDEX "TagWeight_tag_key" ON "TagWeight"("tag");

-- CreateIndex
CREATE INDEX "SearchCache_query_idx" ON "SearchCache"("query");

-- CreateIndex
CREATE INDEX "SearchCache_expires_at_idx" ON "SearchCache"("expires_at");

-- CreateIndex
CREATE INDEX "SearchHistory_query_idx" ON "SearchHistory"("query");

-- CreateIndex
CREATE INDEX "SearchHistory_category_idx" ON "SearchHistory"("category");

-- CreateIndex
CREATE INDEX "SearchHistory_tags_idx" ON "SearchHistory"("tags");

-- AddForeignKey
ALTER TABLE "KnowledgeTag" ADD CONSTRAINT "KnowledgeTag_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "Knowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeTag" ADD CONSTRAINT "KnowledgeTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertWord" ADD CONSTRAINT "AlertWord_related_tag_id_fkey" FOREIGN KEY ("related_tag_id") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackWeight" ADD CONSTRAINT "FeedbackWeight_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "Knowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagSynonym" ADD CONSTRAINT "TagSynonym_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
