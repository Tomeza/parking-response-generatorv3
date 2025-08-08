---
title: 緊急ローテ & 再セット チェックリスト
description: 漏えい前提で"全部ローテして再セット"するためのチェックリスト
author: Security Team
date: 2025-08-08
category: Security
tags:
  - emergency-rotation
  - security-reset
  - key-rotation
  - vercel-env
  - supabase-security
  - api-security
status: ready
references:
  - 250806-api-security-rotation-guide.md
---

# 🔒 緊急ローテ & 再セット チェックリスト（IDEにそのまま投げてOK）

```
# === 0) 前提 ===
# ・このチャットに秘密値を貼らない
# ・.env に echo しない（履歴に残る）
# ・必要なら Preview でも同手順（Production優先）

# === 1) Supabase: DBパスワードを Reset → Vercel 反映 ===
# Supabase → Project Settings → Database → Reset password
# 取得した接続文字列を以下に反映（CLIはプロンプト入力）:

npx vercel env add DATABASE_URL production
# 例: ...:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require

npx vercel env add DIRECT_URL production
# 例: ...:5432/postgres?sslmode=require

# === 2) Supabase: API キーを Rotate → 反映 ===
# Supabase → Project Settings → API → Rotate keys
# ・service_role → SUPABASE_SERVICE_ROLE_KEY
# ・anon        → NEXT_PUBLIC_SUPABASE_ANON_KEY

npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# === 3) OpenAI / Anthropic: 新キー発行 → 反映（使っていれば） ===
npx vercel env add OPENAI_API_KEY production
npx vercel env add ANTHROPIC_API_KEY production   # 使っている場合のみ

# === 4) 任意: Kill switch も用意（障害時に即遮断） ===
npx vercel env add DISABLE_PUBLIC_API production   # 通常は "false"

# === 5) ローカル同期（値は .env.local に書き出される。チャットに貼らない） ===
npx vercel env pull .env.local

# === 6) 事前ガード & ビルド ===
NODE_ENV=production npm run prebuild
npm run build

# === 7) 本番デプロイ ===
npx vercel --prod

# === 8) スモークテスト（期待値をコメントに記載） ===
curl -I https://<your-app>.vercel.app/ | head -n1                     # 200/304
curl -I https://<your-app>.vercel.app/auth/login | head -n1            # 200
curl -I https://<your-app>.vercel.app/admin | head -n1                  # 302/307 → /admin/login
curl -I https://<your-app>.vercel.app/api/admin/response-history | head -n1  # 401

# === 9) 旧キーの無効化（回線切替が安定したら即） ===
# ・OpenAI/Anthropic の旧キーを Revoke
# ・Supabase の旧 service_role/anon は Rotate 済みで無効化済み

# === 10) 後片付け（再発防止） ===
# ・.env は実値を置かず、.env.example に鍵名だけを残す
# ・.gitignore に .env* が入っていることを確認
# ・.env.local のみで運用（開発は .env.development.local 推奨）
# ・check-env はマスク表示のみ（ログに値を出さない）
```

---

## 追加メモ（事故を二度と起こさないための最小運用）

* **値確認が必要なとき**は、存在だけをマスク表示で：

  ```bash
  grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|OPENAI_API_KEY|ANTHROPIC_API_KEY)=' .env.local \
    | sed -E 's/=(.*)/=<redacted>/'
  ```
* **Prisma の接続先**

  * `DATABASE_URL` は **6543 + pgbouncer**
  * `DIRECT_URL` は **5432（migrate用）**
* **RLSはこの後でOK**（デプロイ安定後に "全閉→必要だけ開放" を適用）

---

## 実行後の報告項目

やってみて、**デプロイURLと 4本の `curl` のHTTPコード**だけ教えてください。
通ったら、次に **RLS導入の一括適用スクリプト** をすぐ出します。

### 期待される結果

```bash
# デプロイURL
https://parking-response-generatorv3-xxxxx.vercel.app

# スモークテスト結果
curl -I https://<app>.vercel.app/ | head -n1                     # 200/304
curl -I https://<app>.vercel.app/auth/login | head -n1            # 200
curl -I https://<app>.vercel.app/admin | head -n1                  # 302/307
curl -I https://<app>.vercel.app/api/admin/response-history | head -n1  # 401
```

---

**作成日**: 2025-08-08  
**参照**: 250806-api-security-rotation-guide.md  
**ステータス**: 準備完了 