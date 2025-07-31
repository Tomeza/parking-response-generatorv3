-- 承認履歴テーブル
CREATE TABLE template_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(id),
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    comment TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK (old_status IN ('draft', 'approved', 'archived')),
    CHECK (new_status IN ('draft', 'approved', 'archived'))
);

-- RLSポリシーの更新
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- 一般ユーザー向けポリシー（承認済みのみ閲覧可能）
CREATE POLICY "view_approved_templates" ON templates
    FOR SELECT
    TO authenticated
    USING (status = 'approved');

-- 管理者向けポリシー（全テンプレート閲覧可能）
CREATE POLICY "view_all_templates_admin" ON templates
    FOR SELECT
    TO authenticated
    USING (
        auth.jwt() ->> 'role' IN ('admin', 'editor', 'approver')
    );

-- 編集者向けポリシー（draft状態のみ編集可能）
CREATE POLICY "edit_draft_templates" ON templates
    FOR UPDATE
    TO authenticated
    USING (
        status = 'draft' AND
        auth.jwt() ->> 'role' IN ('admin', 'editor')
    )
    WITH CHECK (
        status = 'draft' AND
        auth.jwt() ->> 'role' IN ('admin', 'editor')
    );

-- 承認者向けポリシー（ステータス変更可能）
CREATE POLICY "change_template_status" ON templates
    FOR UPDATE
    TO authenticated
    USING (
        auth.jwt() ->> 'role' IN ('admin', 'approver')
    )
    WITH CHECK (
        auth.jwt() ->> 'role' IN ('admin', 'approver')
    );

-- 承認履歴のRLSポリシー
ALTER TABLE template_approval_history ENABLE ROW LEVEL SECURITY;

-- 承認履歴閲覧ポリシー（管理者のみ）
CREATE POLICY "view_approval_history" ON template_approval_history
    FOR SELECT
    TO authenticated
    USING (
        auth.jwt() ->> 'role' IN ('admin', 'editor', 'approver')
    );

-- 承認履歴作成ポリシー（承認者のみ）
CREATE POLICY "create_approval_history" ON template_approval_history
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.jwt() ->> 'role' IN ('admin', 'approver')
    );

-- インデックス
CREATE INDEX idx_templates_status ON templates(status);
CREATE INDEX idx_templates_category_intent ON templates(category, intent);
CREATE INDEX idx_approval_history_template_id ON template_approval_history(template_id);
CREATE INDEX idx_approval_history_created_at ON template_approval_history(created_at);

-- 権限付与
GRANT SELECT ON templates TO authenticated;
GRANT UPDATE ON templates TO authenticated;
GRANT SELECT ON template_approval_history TO authenticated;
GRANT INSERT ON template_approval_history TO authenticated;

-- ステータス変更関数
CREATE OR REPLACE FUNCTION change_template_status(
    template_id UUID,
    new_status TEXT,
    comment TEXT DEFAULT NULL
)
RETURNS templates
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    template_record templates;
    user_role TEXT;
    user_id UUID;
BEGIN
    -- ユーザー情報の取得
    user_role := auth.jwt() ->> 'role';
    user_id := auth.uid();
    
    -- 権限チェック
    IF user_role NOT IN ('admin', 'approver') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    -- テンプレートの取得と存在チェック
    SELECT * INTO template_record
    FROM templates
    WHERE id = template_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
    END IF;

    -- ステータス遷移の検証
    IF (template_record.status = 'draft' AND new_status NOT IN ('approved', 'archived')) OR
       (template_record.status = 'approved' AND new_status NOT IN ('draft', 'archived')) OR
       (template_record.status = 'archived') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', template_record.status, new_status;
    END IF;

    -- ステータス更新
    UPDATE templates
    SET status = new_status,
        updated_at = now()
    WHERE id = template_id
    RETURNING * INTO template_record;

    -- 承認履歴の記録
    INSERT INTO template_approval_history
        (template_id, old_status, new_status, comment, created_by)
    VALUES
        (template_id, template_record.status, new_status, comment, user_id);

    RETURN template_record;
END;
$$; 