-- pgvector拡張が存在するか確認
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 存在しない場合は拡張を作成（コメントを外して実行）
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 確認クエリ
-- SELECT typname FROM pg_type WHERE typname = 'vector'; 