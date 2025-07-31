# スキーマとコードの整合性確保

## 命名規則の統一

### モデル名
- PascalCase: `FaqRaw`, `FaqUsageStats`, `FaqReviewHistory`, `FaqReviewTriggers`

### フィールド名
- camelCase: `originalAnswer`, `refinedAnswer`, `reviewType`, `isActive`, `conditionType`
- データベースカラム名は必要に応じて`@map`で指定（例：`@map("original_answer")`）

## 必須フィールド
- `FaqUsageStats`: `queryHash`, `queryText`, `route`, `latencyMs` は必須
- `FaqReviewHistory`: `originalAnswer`, `refinedAnswer`, `reviewType` は必須
- `FaqReviewTriggers`: `conditionType`, `threshold`, `isActive` は必須

## リレーション
- `FaqRaw` ⇔ `FaqUsageStats`: 1:N
- `FaqRaw` ⇔ `FaqReviewHistory`: 1:N

## バリデーションルール
- `FaqReviewTriggers.threshold`: JSON型、必須フィールドを含む
- `FaqUsageStats.success`: デフォルトはfalse
- `FaqReviewTriggers.isActive`: デフォルトはtrue

## マイグレーション注意点
1. フィールド名の変更は既存データに影響なし
2. インデックスの再作成が必要
3. 外部キー制約は維持

## LangChainバージョン固定
- バージョン: 0.2.11
- 警告: 型エラーは既知の問題、アップグレードは別ブランチで検討

## Edge Function（Deno）
- エディタ警告は無視
- ビルド/実行時の動作を優先
- 型チェックはランタイムで実施 