-- Phase2 DBハードニング: CHECK制約とトリガー
-- このマイグレーションは手動で適用済みのため、空のファイルとして記録

-- 適用済みの変更:
-- 1. status の CHECK 制約
-- ALTER TABLE "Templates" 
-- ADD CONSTRAINT "templates_status_check" 
-- CHECK (status IN ('draft', 'pending', 'approved', 'archived'));

-- 2. updated_at の自動更新トリガー
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = NOW();
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- CREATE TRIGGER update_templates_updated_at 
--     BEFORE UPDATE ON "Templates"
--     FOR EACH ROW
--     EXECUTE FUNCTION update_updated_at_column();

-- このマイグレーションは手動で適用済みのため、ここでは何もしません
-- 将来のドリフト検出の安定化のため、適用済みとして記録 