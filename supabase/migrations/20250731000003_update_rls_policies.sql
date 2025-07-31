-- RLSポリシーの更新
DROP POLICY IF EXISTS "select_templates_authenticated" ON templates;

CREATE POLICY "select_approved_templates_anon" ON templates
    FOR SELECT
    TO anon
    USING (status = 'approved');

CREATE POLICY "select_all_templates_authenticated" ON templates
    FOR SELECT
    TO authenticated
    USING (true);

-- 権限の付与
GRANT SELECT ON templates TO anon;
GRANT SELECT ON templates TO authenticated; 