# デプロイメントチェックリスト

## 前日チェック

### バックアップ
- [ ] pg_dumpの実行と保存確認
- [ ] CSVエクスポートの実行と保存確認
- [ ] バックアップファイルのパーミッション確認

### 環境変数
- [ ] 本番環境の環境変数一覧の出力と保存
- [ ] シークレットキーの有効期限確認
- [ ] Edge Function用の環境変数の確認

### 依存サービス
- [ ] Supabaseプロジェクトの設定確認
- [ ] Edge Functionのデプロイ状態確認
- [ ] RLSポリシーの出力と保存

## 直前チェック

### プロセス状態
- [ ] アクティブセッション数の確認
- [ ] 長時間クエリの有無確認
- [ ] メンテナンスページの準備

### ストレージ
- [ ] ディスク使用量の確認
- [ ] WALサイズの確認
- [ ] テンポラリファイルの削除

### パフォーマンス
- [ ] 現在のレスポンスタイム記録
- [ ] キャッシュヒット率の記録
- [ ] コネクションプール状態の確認

## 即時ストップ条件

### 前日フェーズ
- [ ] 権限不一致（期待値との差異）
- [ ] アクティブセッション異常（通常の3倍以上）
- [ ] インデックス未使用（スキャン数0）

### 直前フェーズ
- [ ] ロック競合の検出
- [ ] ディスク使用率80%超
- [ ] 無効化されたトリガーの存在

### マイグレーション実行フェーズ
- [ ] トランザクション実行時間30秒超過
- [ ] テーブル件数不一致
- [ ] Edge Function応答コード500

### 確認フェーズ
- [ ] レスポンスタイム50%以上増加
- [ ] エラーレート1%超過
- [ ] キャッシュヒット率30%以下

## 確認コマンド

```sql
-- 権限確認
SELECT r.rolname, r.rolsuper, r.rolinherit,
       r.rolcreaterole, r.rolcreatedb, r.rolcanlogin,
       r.rolconnlimit, r.rolvaliduntil
FROM pg_roles r
WHERE r.rolname IN ('api_user', 'anon', 'authenticated');

-- 接続数・プロセス確認
SELECT count(*) as connection_count,
       state,
       wait_event_type
FROM pg_stat_activity
GROUP BY state, wait_event_type;

-- インデックス使用状況
SELECT schemaname, tablename,
       indexname, idx_scan,
       idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('faq_raw', 'faq_usage_stats');
``` 