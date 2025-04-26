# Prismaマイグレーションリセットガイド

## 現在の問題: Prisma Migrateが混乱している

**現状の問題点:**
1. Supabaseデータベースには、すでにテーブルや拡張機能（全文検索用のPGroongaなど）が設定されています。
2. 一方で、`prisma/migrations`フォルダには古いマイグレーション履歴が存在します。
3. Prismaは「このマイグレーション履歴を順番に適用したら、こういうデータベース構造になるはず」と期待しています。
4. しかし実際のデータベース構造は全く異なるため、大きな「Drift（ずれ）」が検出されて「リセットしますか？」と聞かれます。

これは、多くの場合「データベースが手動で変更された」か「Prismaの外部で構造が変更された」か「`db push`コマンドを使って履歴を残さずに変更を加えた」などの状況で発生します。

## 解決策: マイグレーション履歴をリセットする

解決策は、Prismaのマイグレーション**履歴**をリセットし、「現在のデータベース状態」を新しい出発点として設定することです。

**具体的な手順:**

1. **古いマイグレーション履歴をすべて削除する:**
   ```bash
   # 移行ロックファイル以外をすべて削除
   rm -rf prisma/migrations/*/
   ```

2. **新しいベースラインを作成する:**
   ```bash
   # ベースラインフォルダを作成
   mkdir -p prisma/migrations/000000000000_baseline

   # 現在のスキーマをSQLとして出力
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/000000000000_baseline/migration.sql

   # このベースラインを「適用済み」としてマーク
   npx prisma migrate resolve --applied 000000000000_baseline
   ```

3. **次元数変更のマイグレーションを実行する:**
   ```bash
   npx prisma migrate dev --name update_vector_dimension
   ```

**重要:** これはデータベースの**テーブルやデータを削除するわけではありません**。Prismaが持つ「変更履歴」をリセットするだけです。

**なぜこの方法が良いか:**
- 既存のデータベース構造とデータは保持されます（リセットされません）
- 新しいベースラインから、Prismaはデータベースの変更を正しく追跡できるようになります
- ベクトル次元の変更（384→1536）のみが適用され、他の構造は保たれます

## 注意点

- このプロセスは特に開発環境やデータベース構造の変更が頻繁に行われた環境で有効です
- 本番環境でマイグレーション履歴をリセットする場合は、事前にバックアップを取ることを強く推奨します
- この方法を適用した後は、以降のスキーマ変更は `prisma migrate dev` で管理するのがベストプラクティスです

## ベクトル検索の次元数変更について

OpenAIのEmbeddingモデル（`text-embedding-3-small`）の出力次元数はデフォルトで1536次元です。
そのため、Prismaスキーマ内の定義を `vector(384)` から `vector(1536)` に変更する必要があります。

```prisma
// 変更前
embedding_vector Unsupported("vector(384)")?

// 変更後
embedding_vector Unsupported("vector(1536)")?
```

この変更により、生成されるEmbeddingベクトルとデータベースのカラム型が正しく一致するようになります。 