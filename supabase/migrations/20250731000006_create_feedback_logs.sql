-- フィードバックログテーブル
CREATE TABLE IF NOT EXISTS public.feedback_logs (
    id SERIAL PRIMARY KEY,
    routing_log_id INTEGER REFERENCES public.routing_logs(id),
    is_correct BOOLEAN,
    correction_type TEXT, -- 'category', 'intent', 'tone', 'template'
    corrected_value TEXT,
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_feedback_logs_routing_log_id ON public.feedback_logs(routing_log_id);
CREATE INDEX IF NOT EXISTS idx_feedback_logs_created_at ON public.feedback_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_logs_is_correct ON public.feedback_logs(is_correct);

-- RLS有効化
ALTER TABLE public.feedback_logs ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "insert_feedback_logs_authenticated" ON public.feedback_logs
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "select_feedback_logs_admin" ON public.feedback_logs
    FOR SELECT TO authenticated USING (
        EXISTS(
            SELECT 1 FROM jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'roles') as r(role)
            WHERE r.role = 'admin'
        )
    ); 