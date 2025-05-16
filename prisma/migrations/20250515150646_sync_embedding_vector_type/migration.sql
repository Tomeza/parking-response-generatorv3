-- もともとの DROP は不要なのでコメントアウト or 削除
-- DROP INDEX "public"."idx_knowledge_embedding_hnsw";

-- HNSW インデックスを（改めて）作成
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw
  ON "public"."Knowledge"
  USING HNSW (embedding_vector vector_cosine_ops);
