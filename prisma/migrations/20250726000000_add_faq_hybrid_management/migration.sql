-- FAQ管理用の拡張テーブル

-- 複雑度とレビュー要否を管理するカラムを追加
ALTER TABLE "faq_raw" 
  ADD COLUMN "category" TEXT,
  ADD COLUMN "tags" TEXT[],
  ADD COLUMN "complexity" INTEGER DEFAULT 1,  -- 1: 基本的, 2: 中程度, 3: 複雑
  ADD COLUMN "requires_review" BOOLEAN DEFAULT false,
  ADD COLUMN "review_reason" TEXT;

-- レビュー履歴テーブル
CREATE TABLE "faq_review_history" (
  "id" SERIAL PRIMARY KEY,
  "faq_id" INTEGER NOT NULL,
  "original_answer" TEXT NOT NULL,
  "refined_answer" TEXT NOT NULL,
  "review_type" TEXT NOT NULL,  -- 'quality_check', 'refinement', 'correction'
  "reviewer" TEXT,
  "review_date" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("faq_id") REFERENCES "faq_raw" ("id") ON DELETE CASCADE
);

-- レビュートリガー条件テーブル
CREATE TABLE "faq_review_triggers" (
  "id" SERIAL PRIMARY KEY,
  "condition_type" TEXT NOT NULL,  -- 'complexity', 'feedback', 'usage_frequency'
  "threshold" JSONB NOT NULL,  -- 条件のしきい値
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 使用統計テーブル
CREATE TABLE "faq_usage_stats" (
  "id" SERIAL PRIMARY KEY,
  "faq_id" INTEGER NOT NULL,
  "query_count" INTEGER DEFAULT 0,  -- 質問回数
  "feedback_positive" INTEGER DEFAULT 0,  -- 肯定的フィードバック数
  "feedback_negative" INTEGER DEFAULT 0,  -- 否定的フィードバック数
  "last_used_at" TIMESTAMP WITH TIME ZONE,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("faq_id") REFERENCES "faq_raw" ("id") ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX idx_faq_raw_category ON "faq_raw" ("category");
CREATE INDEX idx_faq_raw_complexity ON "faq_raw" ("complexity");
CREATE INDEX idx_faq_raw_requires_review ON "faq_raw" ("requires_review");
CREATE INDEX idx_faq_review_history_faq_id ON "faq_review_history" ("faq_id");
CREATE INDEX idx_faq_usage_stats_faq_id ON "faq_usage_stats" ("faq_id");
CREATE INDEX idx_faq_usage_stats_query_count ON "faq_usage_stats" ("query_count" DESC);

-- レビュートリガー用のトリガー
CREATE OR REPLACE FUNCTION update_faq_review_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_faq_review_triggers_updated_at
  BEFORE UPDATE ON "faq_review_triggers"
  FOR EACH ROW
  EXECUTE FUNCTION update_faq_review_triggers_updated_at();

-- デフォルトのレビュートリガー条件を設定
INSERT INTO "faq_review_triggers" 
  (condition_type, threshold) 
VALUES 
  ('complexity', '{"min_level": 3}'::jsonb),
  ('feedback', '{"negative_count": 2, "timeframe_hours": 24}'::jsonb),
  ('usage_frequency', '{"min_queries": 100, "timeframe_days": 7}'::jsonb); 