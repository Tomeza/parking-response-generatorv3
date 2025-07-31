-- テーブルの存在確認
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'templates'
);

-- RLSポリシーの確認
SELECT * FROM pg_policies WHERE tablename = 'templates';

-- データの存在確認
SELECT COUNT(*) FROM templates;

-- カテゴリごとの件数
SELECT category, COUNT(*) 
FROM templates 
GROUP BY category 
ORDER BY COUNT(*) DESC;

-- テスト用のクエリ
SELECT * FROM templates 
WHERE category = 'parking' 
AND intent = 'restriction' 
LIMIT 1; 