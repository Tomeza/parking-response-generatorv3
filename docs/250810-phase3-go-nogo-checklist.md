---
title: フェーズ3直前 Go/No-Go チェックリスト
description: 本番運用開始前の最終確認項目と判定基準
author: AI Team
date: 2025-08-10
category: Operations
tags:
  - phase3
  - go-nogo
  - production-ready
  - security-check
  - deployment
  - rls-policies
status: ready
references:
  - 250808-emergency-rotation-reset-checklist.md
---

# フェーズ3直前 Go/No-Go チェックリスト

## 概要

フェーズ3（本番運用）に入る前の"Go/No-Go"チェックを、短時間で回せる順にまとめました。すでに多くは整っているので、抜け漏れ検知に使ってください。

## 15分のファストパス（必須）

### ビルド/型/セキュリティ
```bash
# 環境チェック
npm ci && NODE_ENV=production npm run prebuild

# ビルドテスト
npm run build

# セキュリティチェック
npm run security:check
```

### ランタイムスモーク
```bash
# 公開/管理のHTTP 200/302確認
bash scripts/smoke-test-app.sh

# Templates=許可条件のみ、ログ系=拒否
bash scripts/test-rls-policies.sh
```

### DBポリシーのドリフト検知
```bash
# 差分=0でOK
psql -f scripts/check-rls-drift.sql
```

### タグ固定（ロールバック点）
```bash
# プロダクション準備完了タグ
git tag -a v3.1.0 -m "prod-ready" && git push origin v3.1.0
```

## 60–90分のディープパス（推奨）

### 環境・秘密情報
- [ ] VercelのProd/Preview/Devのキー"が存在すること"だけ確認（値を表示しない）
  ```bash
  # 存在確認のみ（値は表示しない）
  npx vercel env ls production | grep -E "(DATABASE_URL|OPENAI_API_KEY|SUPABASE)"
  ```
- [ ] `.env*` がgit無視されていることを再確認
  ```bash
  grep -E "^\.env" .gitignore
  ```

### 認証/権限
- [ ] `middleware.ts` が `/admin/**` と `/api/admin/**` のみに適用されていること
  ```typescript
  // src/middleware.ts の config.matcher 確認
  export const config = {
    matcher: ['/admin/:path*', '/api/admin/:path*']
  };
  ```
- [ ] Supabase Auth の Site URL/Redirect が本番URLになっていること
  - Supabase Dashboard → Authentication → URL Configuration

### DB & RLS
- [ ] 主要テーブルが `ENABLE + FORCE RLS`、`anon/auth` へ不要権限が残っていない
  ```sql
  -- RLS状態確認
  SELECT schemaname, tablename, rowsecurity, relforcerowsecurity 
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE schemaname = 'public';
  ```
- [ ] `Templates(status)` インデックス有効（EXPLAINで確認）
  ```sql
  EXPLAIN SELECT * FROM "Templates" WHERE status = 'approved';
  ```

### 監視/運用
- [ ] Vercel Analytics/Logs、Supabase Logs の通知をON（4xx/5xx/認証失敗）
- [ ] エラー収集（例:Sentry）が入っていればDSNを本番に
- [ ] アラート設定の確認
  ```bash
  # 監視スクリプトの動作確認
  npm run monitoring:check
  ```

### パフォーマンスの足回り
- [ ] 初回アクセスのTTFB/CLSの目視（公開ページ/検索/管理ダッシュ）
  - 公開ページ: `https://your-app.vercel.app/`
  - 検索ページ: `https://your-app.vercel.app/search`
  - 管理ダッシュ: `https://your-app.vercel.app/admin`

### ロールバック手順
- [ ] 「タグへ戻す」「RLS SQLを戻す」手順をREADMEの運用セクションで最終確認
  ```bash
  # ロールバック手順の確認
  grep -A 10 "## ロールバック手順" README.md
  ```

## Go/No-Go判定基準（この3つで緑）

### 1. スクリプト実行結果
- [ ] `prebuild` 成功
- [ ] `build` 成功  
- [ ] `security:check` 成功
- [ ] `smoke-test-app.sh` 成功
- [ ] `test-rls-policies.sh` 成功

### 2. セキュリティ・権限
- [ ] RLSドリフト=0
- [ ] 公開/保護ルートの挙動が期待通り
- [ ] 環境変数の存在確認完了

### 3. 運用準備
- [ ] タグ作成済み (`v3.1.0`)
- [ ] 監視通知ON
- [ ] ロールバック手順確認済み

## すでにクリア済み（再確認だけ）

### 技術基盤
- [x] `@supabase/ssr` へ移行
- [x] APIは `runtime='nodejs'` 明記
- [x] Prisma 非推奨警告の解消（`prisma.config` への移行準備OK）

### セキュリティ
- [x] 本番用 env ガード（ローカルURLブロック、機密ログ非出力）
- [x] RLSの初期ポリシー＆強制RLS
- [x] SQLをリポに保存

### CI/CD
- [x] GitHub Actions CI完全通過
- [x] ESLint/TypeScript エラー修正済み
- [x] セキュリティ脆弱性修正済み

## チェック実行手順

### Step 1: ファストパス実行
```bash
# 必須チェック（15分）
echo "=== ファストパス開始 ==="
npm ci && NODE_ENV=production npm run prebuild
npm run build
npm run security:check
bash scripts/smoke-test-app.sh
bash scripts/test-rls-policies.sh
psql -f scripts/check-rls-drift.sql
git tag -a v3.1.0 -m "prod-ready" && git push origin v3.1.0
echo "=== ファストパス完了 ==="
```

### Step 2: 結果報告
実行結果（成功/失敗だけでOK）を報告してください：

```bash
# 期待される結果例
✅ prebuild: 成功
✅ build: 成功
✅ security:check: 成功
✅ smoke-test: 成功
✅ rls-policies: 成功
✅ rls-drift: 差分0
✅ tag: v3.1.0作成済み
```

### Step 3: Go/No-Go判定
- **Go**: 全チェック緑 → フェーズ3開始
- **No-Go**: 赤項目あり → 修正後再チェック

## 緊急時の対応

### ロールバック手順
```bash
# タグへ戻す
git checkout v3.0.0
git push --force origin main

# RLS SQLを戻す
psql -f db/rollback/revert-rls-policies.sql
```

### 緊急連絡先
- セキュリティ問題: Security Team
- DB問題: Database Admin
- デプロイ問題: DevOps Team

## 参考資料

- [250808-emergency-rotation-reset-checklist.md](./250808-emergency-rotation-reset-checklist.md) - 緊急ローテーション手順
- [250803-phase1-completion-summary.md](./250803-phase1-completion-summary.md) - Phase1完了サマリー  
- [250805-phase2-completion-summary.md](./250805-phase2-completion-summary.md) - Phase2完了サマリー

## 結論

**この流れで ファストパス → タグ → ディープパス の順に回せば安全にフェーズ3へ入れます。**

まずはファストパスの実行結果（成功/失敗だけでOK）を報告してください。Go/No-Go を一緒に判断します！

---

**作成日**: 2025-08-10  
**参照**: 250808-emergency-rotation-reset-checklist.md  
**ステータス**: 準備完了