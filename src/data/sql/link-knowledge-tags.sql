-- 既存の関連付けを削除
DELETE FROM knowledge_tag;

-- カテゴリと質問内容に基づいてタグを関連付け（UNIONを使用して重複を排除）
INSERT INTO knowledge_tag (knowledge_id, tag_id)
SELECT DISTINCT k.id, t.id
FROM knowledge k
JOIN tag t ON 
    CASE 
        -- 予約関連
        WHEN k.main_category LIKE '%予約%' OR k.sub_category LIKE '%予約%' OR
             k.question LIKE '%予約%' OR k.answer LIKE '%予約%' THEN t.tag_name = '予約'
        -- 料金関連
        WHEN k.main_category LIKE '%料金%' OR k.sub_category LIKE '%料金%' OR 
             k.main_category LIKE '%支払%' OR k.sub_category LIKE '%支払%' OR
             k.question LIKE '%料金%' OR k.answer LIKE '%料金%' OR 
             k.question LIKE '%価格%' OR k.answer LIKE '%価格%' OR
             k.question LIKE '%費用%' OR k.answer LIKE '%費用%' THEN t.tag_name = '料金'
        -- 駐車場関連
        WHEN k.main_category LIKE '%駐車%' OR k.sub_category LIKE '%駐車%' THEN t.tag_name = '駐車場'
        -- 送迎関連
        WHEN k.main_category LIKE '%送迎%' OR k.sub_category LIKE '%送迎%' THEN t.tag_name = '送迎'
        -- 支払い関連
        WHEN k.main_category LIKE '%支払%' OR k.sub_category LIKE '%支払%' OR
             k.question LIKE '%支払%' OR k.answer LIKE '%支払%' OR
             k.question LIKE '%精算%' OR k.answer LIKE '%精算%' OR
             k.question LIKE '%会計%' OR k.answer LIKE '%会計%' THEN t.tag_name = '支払い'
        -- 車種関連
        WHEN k.main_category LIKE '%車%' OR k.sub_category LIKE '%車%' THEN t.tag_name = '車種'
        -- 繁忙期関連
        WHEN k.main_category LIKE '%繁忙%' OR k.sub_category LIKE '%繁忙%' THEN t.tag_name = '繁忙期'
        -- 国際線関連
        WHEN k.main_category LIKE '%国際%' OR k.sub_category LIKE '%国際%' OR
             k.question LIKE '%国際%' OR k.answer LIKE '%国際%' THEN t.tag_name = '国際線'
        -- 国内線関連
        WHEN k.main_category LIKE '%国内%' OR k.sub_category LIKE '%国内%' OR
             k.question LIKE '%国内%' OR k.answer LIKE '%国内%' THEN t.tag_name = '国内線'
        -- キャンセル関連
        WHEN k.main_category LIKE '%キャンセル%' OR k.sub_category LIKE '%キャンセル%' OR
             k.question LIKE '%キャンセル%' OR k.answer LIKE '%キャンセル%' OR
             k.question LIKE '%解約%' OR k.answer LIKE '%解約%' THEN t.tag_name = 'キャンセル'
        -- 営業時間関連
        WHEN k.main_category LIKE '%営業%' OR k.sub_category LIKE '%営業%' OR
             k.question LIKE '%営業%' OR k.answer LIKE '%営業%' OR
             k.question LIKE '%開店%' OR k.answer LIKE '%開店%' OR
             k.question LIKE '%閉店%' OR k.answer LIKE '%閉店%' THEN t.tag_name = '営業時間'
        -- 領収書関連
        WHEN k.main_category LIKE '%領収%' OR k.sub_category LIKE '%領収%' OR
             k.question LIKE '%領収%' OR k.answer LIKE '%領収%' OR
             k.question LIKE '%レシート%' OR k.answer LIKE '%レシート%' THEN t.tag_name = '領収書'
        -- 割引関連
        WHEN k.main_category LIKE '%割引%' OR k.sub_category LIKE '%割引%' OR
             k.question LIKE '%割引%' OR k.answer LIKE '%割引%' OR
             k.question LIKE '%クーポン%' OR k.answer LIKE '%クーポン%' THEN t.tag_name = '割引'
    END; 