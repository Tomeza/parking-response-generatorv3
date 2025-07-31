-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    intent TEXT NOT NULL,
    tone TEXT NOT NULL,
    body TEXT NOT NULL,
    importance INT NOT NULL DEFAULT 3,
    frequency INT NOT NULL DEFAULT 0,
    variables JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'approved', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Create basic SELECT policy for authenticated users
CREATE POLICY "select_templates_authenticated" ON templates
    FOR SELECT TO authenticated
    USING (true);

-- Grant necessary permissions
GRANT SELECT ON templates TO authenticated;
GRANT SELECT ON templates TO anon;

-- Insert initial 10 test cases
INSERT INTO templates (category, intent, tone, body, importance, variables)
VALUES
    ('Billing', 'due_date', 'polite', '支払い期限は{due_date}です。ご確認ください。', 5, '{"due_date": {"type": "date", "required": true}}'::jsonb),
    
    ('Request', 'info', 'casual', 'お問い合わせありがとうございます。{service}についての詳細をお知らせください。', 4, '{"service": {"type": "string", "required": true}}'::jsonb),
    
    ('Complaint', 'overcharge', 'formal', '請求書番号{invoice_no}のご請求金額に誤りがありました。{correction_amount}円の訂正をさせていただきます。ご確認をお願いいたします。', 5, '{"invoice_no": {"type": "string", "required": true}, "correction_amount": {"type": "number", "required": true}}'::jsonb),
    
    ('Reservation', 'confirm', 'polite', '{date}の{service}のご予約を承りました。予約番号は{booking_no}です。', 4, '{"date": {"type": "date", "required": true}, "service": {"type": "string", "required": true}, "booking_no": {"type": "string", "required": true}}'::jsonb),
    
    ('Reservation', 'cancel', 'formal', '予約番号{booking_no}のキャンセルを承りました。キャンセル手数料は{cancel_fee}円となります。', 4, '{"booking_no": {"type": "string", "required": true}, "cancel_fee": {"type": "number", "required": true}}'::jsonb),
    
    ('Support', 'status', 'casual', 'お問い合わせ番号{ticket_no}の対応状況をお知らせします。現在「{status}」となっております。', 3, '{"ticket_no": {"type": "string", "required": true}, "status": {"type": "string", "required": true}}'::jsonb),
    
    ('Billing', 'reminder', 'formal', '請求書番号{invoice_no}（{amount}円）の支払期限が{days_left}日後に迫っております。お早めのお支払いをお願いいたします。', 4, '{"invoice_no": {"type": "string", "required": true}, "amount": {"type": "number", "required": true}, "days_left": {"type": "number", "required": true}}'::jsonb),
    
    ('Request', 'document', 'polite', '{document_type}のご提出ありがとうございます。内容を確認させていただきます。', 3, '{"document_type": {"type": "string", "required": true}}'::jsonb),
    
    ('Support', 'maintenance', 'formal', '{start_date}から{end_date}までの間、システムメンテナンスを実施いたします。ご不便をおかけしますが、ご理解のほどよろしくお願いいたします。', 5, '{"start_date": {"type": "datetime", "required": true}, "end_date": {"type": "datetime", "required": true}}'::jsonb),
    
    ('Notification', 'update', 'casual', 'サービスの新機能「{feature_name}」の提供を開始しました。{description}', 3, '{"feature_name": {"type": "string", "required": true}, "description": {"type": "string", "required": true}}'::jsonb); 