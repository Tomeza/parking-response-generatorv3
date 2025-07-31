-- 同じカテゴリ/intentでtone違いのパターン
INSERT INTO templates 
(category, intent, tone, body, variables, importance, frequency, status)
VALUES
-- 同じ制限でもtoneの違いによる表現の変化
(
    'parking',
    'restriction',
    'casual',
    '申し訳ありませんが、この駐車場は国内線専用です。国際線をご利用の方は、お近くの{alternative_parking}をご利用ください。',
    '{"alternative_parking": {"type": "string", "value": "国際線駐車場"}}'::jsonb,
    5,
    15,
    'draft'
),
(
    'parking',
    'restriction',
    'strict',
    '当駐車場は国内線利用者専用です。国際線利用者の駐車は固くお断りいたします。無断駐車の場合は{penalty}の対象となりますのでご注意ください。',
    '{"penalty": {"type": "string", "value": "レッカー移動"}}'::jsonb,
    5,
    5,
    'draft'
),

-- 類似質問パターン（予約変更）
(
    'reservation',
    'change',
    'formal',
    'ご予約の変更は{hours_before}時間前までであれば、{change_fee}円の変更手数料で承ります。それ以降の変更はキャンセル扱いとなりますのでご了承ください。',
    '{"hours_before": {"type": "number", "value": 24}, "change_fee": {"type": "number", "value": 1000}}'::jsonb,
    4,
    12,
    'draft'
),
(
    'reservation',
    'change',
    'polite',
    '予約の変更をご希望の場合は、{contact_point}までお電話でご連絡ください。お客様の予約番号をお手元にご用意の上、お問い合わせをお願いいたします。',
    '{"contact_point": {"type": "string", "value": "予約センター"}}'::jsonb,
    4,
    10,
    'draft'
),

-- エッジケース（特殊な状況）
(
    'parking',
    'restriction',
    'emergency',
    '【緊急告知】台風接近に伴い、{date}より駐車場を閉鎖いたします。すでにご予約いただいているお客様には{contact_method}にてご連絡いたします。',
    '{"date": {"type": "string", "value": "本日15時"}, "contact_method": {"type": "string", "value": "メールまたはSMS"}}'::jsonb,
    5,
    2,
    'draft'
),

-- 複合的な条件を含むパターン
(
    'shuttle',
    'restriction',
    'polite',
    '送迎バスは{max_capacity}名様までご利用可能です。ただし、{special_condition}の場合は、事前に{contact_point}までご相談ください。',
    '{"max_capacity": {"type": "number", "value": 5}, "special_condition": {"type": "string", "value": "大きな荷物をお持ちの場合"}, "contact_point": {"type": "string", "value": "送迎デスク"}}'::jsonb,
    4,
    8,
    'draft'
),

-- 季節性のある制限
(
    'parking',
    'restriction',
    'seasonal',
    'お盆期間（{period}）は駐車場が大変混雑いたします。{alternative_option}のご利用をお勧めいたします。',
    '{"period": {"type": "string", "value": "8月13日～16日"}, "alternative_option": {"type": "string", "value": "公共交通機関"}}'::jsonb,
    4,
    5,
    'draft'
),

-- 複数の選択肢を提示するパターン
(
    'parking',
    'check',
    'informative',
    '現在の空き状況は以下の通りです：\n- 一般車両：{standard_availability}\n- 軽自動車：{light_availability}\n- 障がい者用：{handicap_availability}\n\n詳細は{inquiry_point}にお問い合わせください。',
    '{"standard_availability": {"type": "string", "value": "残りわずか"}, "light_availability": {"type": "string", "value": "空きあり"}, "handicap_availability": {"type": "string", "value": "2台分空きあり"}, "inquiry_point": {"type": "string", "value": "駐車場管理事務所"}}'::jsonb,
    3,
    15,
    'draft'
);

-- 重要度の高いテンプレートを承認済みに更新
UPDATE templates 
SET status = 'approved',
    updated_at = NOW()
WHERE category = 'parking' 
  AND intent = 'restriction'
  AND tone IN ('formal', 'strict', 'emergency'); 