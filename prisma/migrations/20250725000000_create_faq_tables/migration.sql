-- pg_trgmエクステンションの有効化
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- FAQテーブルの作成
CREATE TABLE "faq_raw" (
    "id" SERIAL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "embedding" vector(1536),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "faq_refined" (
    "id" SERIAL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "embedding" vector(1536),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックスの作成
CREATE INDEX idx_faq_raw_question ON faq_raw USING gin (question gin_trgm_ops);
CREATE INDEX idx_faq_refined_question ON faq_refined USING gin (question gin_trgm_ops);

-- embeddingのHNSWインデックス
CREATE INDEX idx_faq_raw_embedding ON faq_raw USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_faq_refined_embedding ON faq_refined USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 更新時のトリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_faq_raw_updated_at
    BEFORE UPDATE ON faq_raw
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_faq_refined_updated_at
    BEFORE UPDATE ON faq_refined
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at(); 