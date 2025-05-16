# データベース接続の問題と明日の作業の注意点

## データベース接続エラー

テスト実行時に以下のエラーが発生しています:

```
Can't reach database server at `localhost:5433`
Please make sure your database server is running at `localhost:5433`.
```

## 明日の作業の流れ

1. **データベース接続の確認と修正**
   - PostgreSQLサーバーが実行されているかを確認（5433ポート）
   - 環境変数の設定確認（.env ファイル）
   - 必要に応じてデータベースを起動

2. **検索機能改善の実装**
   - `src/lib/search.ts` の修正
     - 段階的な検索戦略の実装
     - クエリ前処理の強化
     - スコアリングの改善
   
3. **特定トピックの専用検索ロジックの実装**
   - 外車駐車関連のクエリに対する特別処理
   - 予約変更関連の特別処理
   - 国際線関連の特別処理

4. **テスト手順**
   - 既存の `test-search.js` でベースラインを確認
   - 改善版 `test-improved-search.js` で改善後の結果を確認
   - 結果の比較と評価

## 必要な設定

### データベース接続設定

`.env` ファイルに以下の設定があるか確認:

```
DATABASE_URL="postgresql://username:password@localhost:5433/parking_db?schema=public"
```

実際のデータベース名、ユーザー名、パスワード、ポートに合わせて修正が必要です。

### Docker環境の場合

Docker を使用している場合、以下のコマンドでコンテナの状態を確認:

```bash
docker ps
docker-compose ps
```

Dockerコンテナを再起動する場合:

```bash
docker-compose down
docker-compose up -d
```

## 検索関連のファイル

- **src/lib/search.ts**: メインの検索ロジック
- **src/lib/tag-search.ts**: タグベースの検索機能
- **src/scripts/test-search.js**: 現在の検索機能テスト
- **src/scripts/test-improved-search.js**: 改善版検索機能テスト

## その他の注意点

- 型エラーに注意（特に `QueryMode` のインポート問題）
- PGroongaスコアが常に0.0000と表示される問題の解決
- 外車駐車関連のクエリに対する改善が重要 