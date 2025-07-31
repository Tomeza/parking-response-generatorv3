# テンプレートAPI テストコマンド集

## 環境変数

```bash
# ローカル開発環境の認証情報
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

## 基本的な検索パターン

### 1. カテゴリとintentによる検索

```bash
# parking/restriction の検索（承認済みのみ）
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking&intent=restriction" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# reservation/change の検索（承認済みのみ）
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=reservation&intent=change" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### 2. トーンを指定した検索

```bash
# parking/restriction + formal トーン
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking&intent=restriction&tone=formal" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# parking/restriction + casual トーン（draft状態なので結果は空）
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking&intent=restriction&tone=casual" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### 3. エッジケース

```bash
# 緊急時用テンプレート
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking&intent=restriction&tone=emergency" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# 存在しないカテゴリ
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=nonexistent" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# パラメータなし
curl -i "$SUPABASE_URL/functions/v1/get-templates" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

## 期待される結果パターン

1. **正常系（承認済み）**
   - `parking/restriction/formal`: 1件取得
   - `parking/restriction/strict`: 1件取得
   - `parking/restriction/emergency`: 1件取得

2. **正常系（未承認）**
   - `parking/restriction/casual`: 0件（draft状態）
   - `parking/restriction/seasonal`: 0件（draft状態）

3. **エッジケース**
   - 存在しないカテゴリ: 空配列
   - パラメータなし: 全承認済みテンプレート

## エラーケース確認

```bash
# 不正なJWT
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking" \
  -H "Authorization: Bearer invalid.token"

# 認証ヘッダなし
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking"
```

## エラーケーステスト

### 1. 認証エラー

```bash
# 認証ヘッダなし
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking"

# 不正なJWT
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking" \
  -H "Authorization: Bearer invalid.token"
```

### 2. パラメータバリデーション

```bash
# カテゴリ名が長すぎる
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=this-is-a-very-very-very-very-very-very-very-long-category-name-that-exceeds-fifty-characters" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# 未定義のトーン
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking&tone=undefined_tone" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# パラメータ形式エラー（スペース含む）
curl -i "$SUPABASE_URL/functions/v1/get-templates?category=parking service" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### 3. 期待されるエラーレスポンス

```json
// 認証エラー (401)
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authorization header"
  }
}

// パラメータ長エラー (400)
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Category name is too long (max 50 characters)",
    "details": {
      "param": "category",
      "value": "..."
    }
  }
}

// 未定義トーン (400)
{
  "success": false,
  "error": {
    "code": "INVALID_TONE",
    "message": "Invalid tone specified",
    "details": {
      "param": "tone",
      "value": "undefined_tone",
      "validTones": ["formal", "casual", "strict", "polite", "emergency", "seasonal", "informative"]
    }
  }
}
```

### 4. エラー時の動作確認ポイント

1. **HTTPステータスコード**
   - 認証エラー: 401
   - バリデーションエラー: 400
   - サーバーエラー: 500

2. **レスポンスヘッダ**
   - `Content-Type: application/json`
   - CORS関連ヘッダの存在

3. **エラーメッセージ**
   - 具体的な問題の説明
   - エラーコードの一貫性
   - デバッグに役立つ詳細情報

4. **セキュリティ**
   - スタックトレースの非公開
   - センシティブ情報の非露出

## 運用コマンド例

### テンプレートステータス変更

```sql
-- draft → approved
UPDATE templates 
SET status = 'approved', 
    updated_at = NOW() 
WHERE category = 'parking' 
  AND intent = 'restriction' 
  AND tone = 'casual' 
RETURNING id, category, intent, tone, status;

-- approved → archived
UPDATE templates 
SET status = 'archived', 
    updated_at = NOW() 
WHERE category = 'parking' 
  AND intent = 'restriction' 
  AND tone = 'formal' 
RETURNING id, category, intent, tone, status;
```

## 注意点

1. **認証**
   - 匿名ユーザーは承認済み（approved）テンプレートのみ閲覧可能
   - 認証済みユーザーは全テンプレート閲覧可能

2. **パラメータ**
   - `category`: 必須ではない
   - `intent`: 必須ではない
   - `tone`: 必須ではない
   - 全てのパラメータが省略された場合は、承認済みの全テンプレートを返却

3. **ステータス管理**
   - `draft` → `approved` → `archived` の順に遷移
   - `archived` からの復帰は想定しない
   - 重要な制限テンプレートは複数のトーンを持つ可能性あり 

## 運用上の注意点

1. **エラー監視**
   - 頻発するエラーパターンの把握
   - バリデーションルールの調整要否確認

2. **エラーレスポンスの活用**
   - フロントエンドでの適切なエラーハンドリング
   - ユーザーへの分かりやすいメッセージ表示

3. **デバッグ支援**
   - エラーコードとメッセージの対応表管理
   - トラブルシューティングガイドの整備 

## ステータス更新APIテスト

### 1. 基本的なステータス更新

```bash
# draft → approved
curl -i -X PATCH "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/status" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "comment": "内容を確認し、問題ないため承認"
  }'

# approved → draft（差し戻し）
curl -i -X PATCH "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/status" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "draft",
    "comment": "トーンの調整が必要"
  }'

# approved → archived（アーカイブ）
curl -i -X PATCH "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/status" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "archived",
    "comment": "新バージョンに置き換えのため"
  }'
```

### 2. エラーケース

```bash
# 不正な遷移（archived → draft）
curl -i -X PATCH "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/status" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "draft",
    "comment": "アーカイブからの復帰"
  }'

# 存在しないテンプレート
curl -i -X PATCH "$SUPABASE_URL/functions/v1/templates/non-existent-id/status" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "comment": "承認テスト"
  }'

# 不正なステータス値
curl -i -X PATCH "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/status" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "invalid_status",
    "comment": "不正なステータス"
  }'
```

### 3. 期待されるレスポンス

```json
// 成功時
{
  "success": true,
  "data": {
    "template": {
      "id": "...",
      "status": "approved",
      "updated_at": "2025-07-31T12:00:00Z",
      // ... その他のテンプレート情報
    },
    "approval": {
      "id": "...",
      "template_id": "...",
      "old_status": "draft",
      "new_status": "approved",
      "comment": "内容を確認し、問題ないため承認",
      "created_by": "...",
      "created_at": "2025-07-31T12:00:00Z"
    }
  }
}

// エラー時（不正な遷移）
{
  "success": false,
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Invalid status transition from archived to draft. Allowed transitions: ",
    "details": {
      "current_status": "archived",
      "requested_status": "draft",
      "allowed_transitions": []
    }
  }
}

// エラー時（テンプレート未存在）
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Template not found"
  }
}
```

### 4. テスト実行手順

1. **準備**
   ```bash
   # 環境変数の設定
   export TEMPLATE_ID=$(supabase db query "SELECT id FROM templates WHERE status = 'draft' LIMIT 1" -q | tail -n 1)
   ```

2. **ステータス遷移テスト**
   ```bash
   # draft → approved → draft → archived の順でテスト
   for status in "approved" "draft" "archived"; do
     curl -i -X PATCH "$SUPABASE_URL/functions/v1/templates/$TEMPLATE_ID/status" \
       -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
       -H "Content-Type: application/json" \
       -d "{\"status\": \"$status\", \"comment\": \"Automated test: $status\"}"
     echo "\n---\n"
     sleep 1
   done
   ```

3. **承認履歴確認**
   ```bash
   # 履歴の取得
   curl -i "$SUPABASE_URL/functions/v1/templates/$TEMPLATE_ID/approval-history" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY"
   ```

### 5. 運用上の注意点

1. **承認フロー**
   - 承認は必ずコメントを付ける
   - 差し戻し時は具体的な理由を記載
   - アーカイブ時は代替テンプレートの有無を明記

2. **エラー対応**
   - 不正な遷移は即座にエラーとなる
   - アーカイブ後の復帰は新規作成で対応
   - 権限エラーは管理者に連絡

3. **監視ポイント**
   - 承認待ち時間
   - 差し戻し頻度
   - アーカイブ理由の傾向 

## 承認履歴取得APIテスト

### 1. 基本的な履歴取得

```bash
# デフォルトのページネーション（1ページ目、20件）
curl -i "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/approval-history" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# ページサイズ指定
curl -i "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/approval-history?pageSize=5" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# ページ指定
curl -i "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/approval-history?page=2&pageSize=10" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### 2. エラーケース

```bash
# 存在しないテンプレート
curl -i "$SUPABASE_URL/functions/v1/templates/non-existent-id/approval-history" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# 不正なページネーションパラメータ
curl -i "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/approval-history?page=0&pageSize=1000" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# 認証なし
curl -i "$SUPABASE_URL/functions/v1/templates/[TEMPLATE_ID]/approval-history"
```

### 3. 期待されるレスポンス

```json
// 成功時
{
  "success": true,
  "data": {
    "total": 15,
    "history": [
      {
        "id": "...",
        "old_status": "draft",
        "new_status": "approved",
        "comment": "内容を確認し、問題ないため承認",
        "created_by": "...",
        "created_at": "2025-07-31T12:00:00Z",
        "user_details": {
          "email": "approver@example.com",
          "role": "approver"
        }
      },
      // ... 他の履歴エントリ
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalPages": 1
    }
  }
}

// エラー時（テンプレート未存在）
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Template not found"
  }
}

// エラー時（認証エラー）
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authorization header"
  }
}
```

### 4. テスト実行手順

1. **準備**
   ```bash
   # 環境変数の設定
   export TEMPLATE_ID=$(supabase db query "SELECT id FROM templates WHERE status = 'approved' LIMIT 1" -q | tail -n 1)
   ```

2. **履歴データの作成**
   ```bash
   # ステータス変更を実行して履歴を生成
   for status in "draft" "approved" "draft" "approved"; do
     curl -i -X PATCH "$SUPABASE_URL/functions/v1/templates/$TEMPLATE_ID/status" \
       -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
       -H "Content-Type: application/json" \
       -d "{\"status\": \"$status\", \"comment\": \"Test: Change to $status\"}"
     echo "\n---\n"
     sleep 1
   done
   ```

3. **履歴の確認**
   ```bash
   # 全履歴の取得
   curl -i "$SUPABASE_URL/functions/v1/templates/$TEMPLATE_ID/approval-history" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY"

   # 最新の5件のみ取得
   curl -i "$SUPABASE_URL/functions/v1/templates/$TEMPLATE_ID/approval-history?pageSize=5" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY"
   ```

### 5. 運用上の注意点

1. **データ取得**
   - 履歴は新しい順（created_at DESC）
   - ページサイズは最大100件
   - 不正なページ番号は自動的に1に補正

2. **権限管理**
   - 履歴の閲覧には認証が必要
   - ユーザー詳細は管理者のみ表示

3. **パフォーマンス**
   - 大量データの場合はページネーション必須
   - インデックスによる最適化（template_id, created_at）

4. **監視ポイント**
   - 履歴取得の応答時間
   - エラー発生率
   - データ量の増加傾向 