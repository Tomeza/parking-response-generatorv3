-- テーブルの制約を確認
SELECT
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    cc.check_clause
FROM
    information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    LEFT JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
WHERE
    tc.table_name = 'templates'; 