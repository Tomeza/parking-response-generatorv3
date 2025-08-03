-- ルーティングログテーブル
CREATE TABLE IF NOT EXISTS public.routing_logs (
    id SERIAL PRIMARY KEY,
    query_text TEXT NOT NULL,
    detected_category TEXT NOT NULL,
    detected_intent TEXT NOT NULL,
    detected_tone TEXT NOT NULL,
    selected_template_id INTEGER REFERENCES public.templates(id),
    confidence_score FLOAT,
    is_fallback BOOLEAN DEFAULT false,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT,
    user_id UUID REFERENCES auth.users(id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_routing_logs_created_at ON public.routing_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_logs_category ON public.routing_logs(detected_category);
CREATE INDEX IF NOT EXISTS idx_routing_logs_template_id ON public.routing_logs(selected_template_id);

-- RLS有効化
ALTER TABLE public.routing_logs ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "insert_routing_logs_authenticated" ON public.routing_logs
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "select_routing_logs_admin" ON public.routing_logs
    FOR SELECT TO authenticated USING (
        EXISTS(
            SELECT 1 FROM jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'roles') as r(role)
            WHERE r.role = 'admin'
        )
    ); 