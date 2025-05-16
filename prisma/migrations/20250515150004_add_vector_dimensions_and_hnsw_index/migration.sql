-- This is an empty migration.

-- シャドウDBにも vector 型を作成する
CREATE EXTENSION IF NOT EXISTS vector;

-- 1) カラム型を vector(1536) に変更
ALTER TABLE "public"."Knowledge"
  ALTER COLUMN "embedding_vector"
  TYPE vector(1536)
  USING "embedding_vector"::vector(1536);

-- 2) HNSW インデックスを作成
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw
  ON "public"."Knowledge"
  USING HNSW (embedding_vector vector_cosine_ops);