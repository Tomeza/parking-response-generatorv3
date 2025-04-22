# データベースセットアップ手順

## 1. Dockerコンテナの起動

```bash
# Dockerコンテナの起動
docker-compose up -d

# 起動確認
docker ps
```

正常に起動すると以下のように表示されます：
```
CONTAINER ID   IMAGE                     COMMAND                  STATUS          PORTS                    NAMES
d49b986e2e23   groonga/pgroonga:latest  "docker-entrypoint.s…"  Up 2 minutes   0.0.0.0:5433->5432/tcp  parking-response-generatorv3-db-1
```

## 2. ナレッジデータのインポート

以下の順序でデータをインポートします。各ステップでインポート後にタグ付けを行います。

### 2.1 基本ナレッジデータ（knowledge.csv）

1. `import-data.ts`の編集
```typescript
const csvPath = path.join(__dirname, 'src', 'data', 'csv', 'production', 'knowledge.csv');
```

2. データのインポートとタグ付け
```bash
npm run import-data  # 107件のデータがインポートされます
npm run import-tags  # タグ付けが実行されます
```

### 2.2 キャンセル関連データ（knowledge_cancel.csv）

1. `import-data.ts`の編集
```typescript
const csvPath = path.join(__dirname, 'src', 'data', 'csv', 'production', 'knowledge_cancel.csv');
```

2. データのインポートとタグ付け
```bash
npm run import-data  # 5件のデータがインポートされます
npm run import-tags  # タグ付けが実行されます
```

### 2.3 営業時間関連データ（knowledge_hours.csv）

1. `import-data.ts`の編集
```typescript
const csvPath = path.join(__dirname, 'src', 'data', 'csv', 'production', 'knowledge_hours.csv');
```

2. データのインポートとタグ付け
```bash
npm run import-data  # 1件のデータがインポートされます
npm run import-tags  # タグ付けが実行されます
```

### 2.4 クレーム関連データ（knowledge_complaint.csv）

1. `import-data.ts`の編集
```typescript
const csvPath = path.join(__dirname, 'src', 'data', 'csv', 'production', 'knowledge_complaint.csv');
```

2. データのインポートとタグ付け
```bash
npm run import-data  # 15件のデータがインポートされます
npm run import-tags  # タグ付けが実行されます
```

### 2.5 クレームテンプレート（knowledge_complaint_template.csv）

1. `import-data.ts`の編集
```typescript
const csvPath = path.join(__dirname, 'src', 'data', 'csv', 'production', 'knowledge_complaint_template.csv');
```

2. データのインポートとタグ付け
```bash
npm run import-data  # 3件のデータがインポートされます
npm run import-tags  # タグ付けが実行されます
```

## 3. データ確認方法

### 3.1 ナレッジデータの確認
```bash
docker exec -it parking-response-generatorv3-db-1 psql -U postgres -d parking_response -c "SELECT COUNT(*) FROM \"Knowledge\";"
```
期待される結果: 131件

### 3.2 タグ付けの確認
```bash
docker exec -it parking-response-generatorv3-db-1 psql -U postgres -d parking_response -c "SELECT COUNT(*) FROM \"KnowledgeTag\";"
```
期待される結果: 104件

## 4. エラー対応

### 4.1 Experimental Loader Warning
```
ExperimentalWarning: `--experimental-loader` may be removed in the future
```

対応方法:
1. `package.json`の修正
```json
{
  "scripts": {
    "import-data": "node --loader ts-node/esm import-data.ts",
    "import-tags": "node --loader ts-node/esm import-tags.ts"
  }
}
```

### 4.2 TypeScript Linter Errors

1. 型定義の追加
```typescript
// import-data.ts
interface KnowledgeData {
  main_category?: string;
  sub_category?: string;
  detail_category?: string;
  question?: string;
  answer: string;
  is_template?: boolean;
  usage?: string;
  note?: string;
  issue?: string;
}
```

2. `tsconfig.json`の設定確認
```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "target": "es2020",
    "module": "esnext"
  }
}
```

## 5. トラブルシューティング

### 5.1 データベース接続エラー
- ポート番号（5433）が正しく設定されているか確認
- Dockerコンテナが起動しているか確認
- 環境変数（DATABASE_URL）が正しく設定されているか確認

### 5.2 CSVファイルが見つからない場合
- ファイルパスが正しいか確認
- ファイル名の大文字小文字を確認
- 文字コード（UTF-8）を確認

### 5.3 タグ付けエラー
- 基本タグが正しく作成されているか確認
- 重複するタグがないか確認 