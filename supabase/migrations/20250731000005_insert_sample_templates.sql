-- サンプルテンプレートの投入
-- 5カテゴリ × 4intent × 3tone = 60件の組み合わせ（一部のみ実装）

-- 予約関連テンプレート
INSERT INTO public.templates (title, content, category, intent, tone, variables, version, is_approved, created_at, updated_at) VALUES
('予約確認_通常', 'ご予約の確認をいたします。予約番号をご確認ください。', 'reservation', 'check', 'normal', '{"reservation_number": "string"}', 1, true, NOW(), NOW()),
('予約作成_緊急', '緊急のご予約を承ります。至急対応いたします。', 'reservation', 'create', 'urgent', '{"customer_name": "string", "vehicle_number": "string"}', 1, true, NOW(), NOW()),
('予約変更_通常', 'ご予約の変更を承ります。変更内容をご確認ください。', 'reservation', 'modify', 'normal', '{"reservation_number": "string", "new_date": "date"}', 1, true, NOW(), NOW()),
('予約キャンセル_通常', 'ご予約のキャンセルを承ります。キャンセル手数料についてご案内いたします。', 'reservation', 'cancel', 'normal', '{"reservation_number": "string"}', 1, true, NOW(), NOW()),
('予約確認_将来', '将来のご予約についてご案内いたします。', 'reservation', 'check', 'future', '{"future_date": "date"}', 1, true, NOW(), NOW());

-- 支払い関連テンプレート
INSERT INTO public.templates (title, content, category, intent, tone, variables, version, is_approved, created_at, updated_at) VALUES
('支払い確認_通常', 'お支払い状況をご確認いたします。', 'payment', 'check', 'normal', '{"invoice_number": "string"}', 1, true, NOW(), NOW()),
('支払い方法_通常', 'お支払い方法についてご案内いたします。', 'payment', 'inquiry', 'normal', '{}', 1, true, NOW(), NOW()),
('支払い報告_緊急', '支払いに関する緊急事態を報告いたします。', 'payment', 'report', 'urgent', '{"issue_type": "string"}', 1, true, NOW(), NOW()),
('料金確認_将来', '将来の料金体系についてご案内いたします。', 'payment', 'check', 'future', '{"service_type": "string"}', 1, true, NOW(), NOW());

-- 送迎関連テンプレート
INSERT INTO public.templates (title, content, category, intent, tone, variables, version, is_approved, created_at, updated_at) VALUES
('送迎確認_通常', '送迎サービスのご確認をいたします。', 'shuttle', 'check', 'normal', '{"pickup_location": "string", "dropoff_location": "string"}', 1, true, NOW(), NOW()),
('送迎予約_緊急', '緊急の送迎サービスを承ります。', 'shuttle', 'create', 'urgent', '{"customer_name": "string", "urgent_reason": "string"}', 1, true, NOW(), NOW()),
('送迎変更_通常', '送迎サービスの変更を承ります。', 'shuttle', 'modify', 'normal', '{"reservation_number": "string", "new_time": "time"}', 1, true, NOW(), NOW()),
('送迎キャンセル_通常', '送迎サービスのキャンセルを承ります。', 'shuttle', 'cancel', 'normal', '{"reservation_number": "string"}', 1, true, NOW(), NOW());

-- 設備関連テンプレート
INSERT INTO public.templates (title, content, category, intent, tone, variables, version, is_approved, created_at, updated_at) VALUES
('設備確認_通常', '設備の利用状況をご確認いたします。', 'facility', 'check', 'normal', '{"facility_type": "string"}', 1, true, NOW(), NOW()),
('設備予約_通常', '設備のご予約を承ります。', 'facility', 'create', 'normal', '{"facility_type": "string", "usage_date": "date"}', 1, true, NOW(), NOW()),
('設備故障_緊急', '設備の故障を報告いたします。緊急対応いたします。', 'facility', 'report', 'urgent', '{"facility_type": "string", "issue_description": "string"}', 1, true, NOW(), NOW()),
('設備案内_将来', '新設備についてご案内いたします。', 'facility', 'inquiry', 'future', '{"new_facility": "string"}', 1, true, NOW(), NOW());

-- トラブル関連テンプレート
INSERT INTO public.templates (title, content, category, intent, tone, variables, version, is_approved, created_at, updated_at) VALUES
('トラブル報告_緊急', 'トラブルを報告いたします。緊急対応いたします。', 'trouble', 'report', 'urgent', '{"trouble_type": "string", "description": "string"}', 1, true, NOW(), NOW()),
('トラブル確認_通常', 'トラブルの状況をご確認いたします。', 'trouble', 'check', 'normal', '{"trouble_id": "string"}', 1, true, NOW(), NOW()),
('トラブル対応_通常', 'トラブルへの対応についてご案内いたします。', 'trouble', 'inquiry', 'normal', '{"trouble_type": "string"}', 1, true, NOW(), NOW());

-- その他関連テンプレート
INSERT INTO public.templates (title, content, category, intent, tone, variables, version, is_approved, created_at, updated_at) VALUES
('営業時間_通常', '営業時間についてご案内いたします。', 'other', 'inquiry', 'normal', '{}', 1, true, NOW(), NOW()),
('問い合わせ_通常', 'お問い合わせを承ります。', 'other', 'inquiry', 'normal', '{"inquiry_type": "string"}', 1, true, NOW(), NOW()),
('緊急連絡_緊急', '緊急のご連絡を承ります。', 'other', 'report', 'urgent', '{"emergency_type": "string"}', 1, true, NOW(), NOW()); 