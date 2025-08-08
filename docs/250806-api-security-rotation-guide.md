---
title: APIセキュリティ強化 - キーローテーション完全ガイド
description: 既存キーの即座ローテーションと再発防止策の実装手順
author: Security Team
date: 2025-08-06
category: Security
tags:
  - api-security
  - key-rotation
  - git-history-cleanup
  - gitleaks
  - supabase-security
  - openai-security
  - anthropic-security
status: in-progress
references:
  - 250805-phase2-completion-summary.md
---

# APIセキュリティ強化 - キーローテーション完全ガイド

## 概要

Phase2完了後の本番投入前に、**APIキーまわりの"今すぐ"やる対策**を実施します。既存キーは漏えい前提で**即ローテーション＋履歴からの完全削除**、その後**再発防止のガード**を入れます。

## 今すぐ（30–60分でやる）

### 1) すべてローテーション

#### OpenAI
- **Projectの新規キー作成** → 旧キー**Revoke** → **Usage hard limit**設定（$上限/日・月）
- 手順：
  1. [OpenAI Platform](https://platform.openai.com/api-keys) で新規キー作成
  2. 旧キーを **Revoke** で無効化
  3. Usage limits で日次・月次上限を設定

#### Anthropic
- **新規キー** → 旧キーRevoke → Usage上限
- 手順：
  1. [Anthropic Console](https://console.anthropic.com/) で新規キー作成
  2. 旧キーを無効化
  3. Usage limits を設定

#### Supabase
- **Database password**（`DATABASE_URL`のパスワード）を**Rotate**
- **Service role** / **anon** キーを**Rotate**（API > Project API Keys）
- RLS前提なら**service_roleはサーバー専用**（絶対にクライアントへ出さない）

> ローテ後は**.env.local / Vercel(本番)の環境変数**を更新→再デプロイ

### 2) Git履歴から秘密情報を"完全に"消す

> たとえ非公開でも**過去に push 済みなら漏えい前提**です。

#### git filter-repo（推奨）

```bash
# インストール
pip install git-filter-repo

# 履歴から.envファイルを完全削除
git filter-repo --force --invert-paths --path .env --path .env.local

# 強制プッシュ
git push --force --all
git push --force --tags
```

#### BFG（代替）

```bash
# BFGで.envファイルを削除
bfg --delete-files .env --no-blob-protection
bfg --delete-files .env.local --no-blob-protection

# 履歴を完全にクリーンアップ
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# 強制プッシュ
git push --force --all && git push --force --tags
```

> 履歴を消しても**旧キーは必ず無効化**しておきます。

### 3) 秘密情報スキャンの常設

#### ローカル＆CIで gitleaks

```bash
# インストール
brew install gitleaks  # macOS
# または
curl -sSL https://raw.githubusercontent.com/zricethezav/gitleaks/master/install.sh | bash

# スキャン実行
gitleaks detect --source .
```

#### GitHub の Secret scanning + Push protection

1. **Secret scanning** を有効化
2. **Push protection** を有効化
3. **Custom patterns** で独自のパターンを追加

## 近日中（再発防止の"柵"）

### A. 最小権限化（Supabase）

#### 実行用に限定権限ユーザー作成

```sql
-- 限定権限ユーザー作成
CREATE USER app_user WITH PASSWORD 'secure_password';

-- 最小権限を付与
GRANT SELECT ON "Templates" TO app_user;
GRANT INSERT ON "RoutingLogs" TO app_user;
GRANT SELECT ON "RoutingLogs" TO app_user;  -- 必要に応じて

-- マイグレーション専用ユーザー（別途）
CREATE USER migration_user WITH PASSWORD 'migration_password';
GRANT ALL ON ALL TABLES IN SCHEMA public TO migration_user;
```

#### Prisma設定の分離

```typescript
// src/lib/prisma.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.NODE_ENV === 'production' 
        ? process.env.DATABASE_URL_APP_USER  // 限定権限
        : process.env.DATABASE_URL           // 開発用
    }
  }
});
```

### B. クライアントに一切出さない

#### 環境変数の厳格管理

```bash
# クライアントに露出するキーがないかチェック
grep -R "OPENAI_API_KEY\|ANTHROPIC_API_KEY\|SERVICE_ROLE" .

# ビルド成果物にも混入がないか確認
npm run build
grep -R "OPENAI_API_KEY\|ANTHROPIC_API_KEY" .next || echo "OK: not found"
```

#### 禁止パターン

- `NEXT_PUBLIC_` で始まる**キーを作らない**
- クライアントサイドでAPIキーを参照しない
- 環境変数は必ずサーバーサイドでのみ使用

### C. 送信先ドメインをホワイトリスト

#### fetchラッパーの実装

```typescript
// src/lib/safe-fetch.ts
const ALLOWED_DOMAINS = new Set([
  'api.openai.com',
  'api.anthropic.com', 
  new URL(process.env.DATABASE_URL!).hostname
]);

export async function safeFetch(input: string | URL, init?: RequestInit) {
  const host = new URL(String(input)).hostname;
  if (!ALLOWED_DOMAINS.has(host)) {
    throw new Error(`Outbound blocked: ${host}`);
  }
  return fetch(input as any, init);
}

// 使用例
import { safeFetch } from '@/lib/safe-fetch';

// OpenAI API呼び出し
const response = await safeFetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
  body: JSON.stringify(payload)
});
```

### D. ログとレスポンスに鍵を残さない

#### ログの無害化

```typescript
// src/lib/logger.ts
export function sanitizeLog(data: any): any {
  const sanitized = { ...data };
  
  // 環境変数を削除
  delete sanitized.headers?.authorization;
  delete sanitized.headers?.['x-api-key'];
  
  // PIIマスク
  if (sanitized.query) {
    sanitized.query = sanitized.query.replace(
      /\d{3,4}-\d{3,4}-\d{4}/g, 
      '***-****-****'
    );
  }
  
  // 最大長制限
  if (sanitized.query && sanitized.query.length > 1000) {
    sanitized.query = sanitized.query.substring(0, 1000) + '...';
  }
  
  return sanitized;
}
```

#### APIレスポンスのセキュリティ

```typescript
// src/app/api/query/route.ts
return NextResponse.json(response, {
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});
```

### E. CI/CD

#### GitHub Actions の設定

```yaml
# .github/workflows/ci.yml
name: CI/CD Security

on: [push, pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 全履歴を取得
      
      - name: Run gitleaks
        run: |
          curl -sSL https://raw.githubusercontent.com/zricethezav/gitleaks/master/install.sh | bash
          gitleaks detect --source . --verbose
      
      - name: Check for secrets in build
        run: |
          npm run build
          grep -R "OPENAI_API_KEY\|ANTHROPIC_API_KEY" .next && exit 1 || echo "OK: No secrets in build"
      
      - name: Mask secrets in logs
        run: |
          echo "::add-mask::${{ secrets.OPENAI_API_KEY }}"
          echo "::add-mask::${{ secrets.ANTHROPIC_API_KEY }}"
          echo "::add-mask::${{ secrets.DATABASE_URL }}"
```

## 運用監視（最初の48時間）

### 監視項目

#### OpenAI/Anthropic Usageダッシュボード
- **急増アラート**: 予期しない使用量の増加
- **異常時間帯**: 夜間の使用量スパイク
- **コスト上限**: 日次・月次上限の監視

#### Supabase接続/クエリ数
- **接続数**: 異常な接続数の増加
- **クエリ数**: 予期しない大量クエリ
- **エラー率**: 接続エラーの増加

#### RoutingLogs監視
- **急増**: 予期しないトラフィック増加
- **夜間スパイク**: 異常な時間帯のアクセス
- **is_fallback異常増加**: フォールバック率の急上昇

### アラート設定例

```typescript
// src/lib/monitoring.ts
export async function checkSecurityMetrics() {
  // OpenAI使用量チェック
  const openaiUsage = await getOpenAIUsage();
  if (openaiUsage.daily > 100) {  // 例：$100/日
    await sendAlert('OpenAI usage spike detected');
  }
  
  // Supabase接続数チェック
  const dbConnections = await getSupabaseConnections();
  if (dbConnections.active > 50) {  // 例：50接続以上
    await sendAlert('High database connection count');
  }
  
  // フォールバック率チェック
  const fallbackRate = await getFallbackRate();
  if (fallbackRate > 0.05) {  // 例：5%以上
    await sendAlert('High fallback rate detected');
  }
}
```

## チェックリスト（実行済みに✓）

### 即座実行項目
- [ ] すべてのキーを**ローテーション**
  - [ ] OpenAI API キー
  - [ ] Anthropic API キー
  - [ ] Supabase Database password
  - [ ] Supabase Service role key
  - [ ] Supabase Anon key
- [ ] Git履歴から**.env類を完全削除** & 強制push
- [ ] gitleaks & Secret scanning を**恒常運用**
- [ ] 本番環境変数のみ使用（.envは**未コミット**）

### 再発防止項目
- [ ] Supabaseは**最小権限ユーザー**で接続
- [ ] クライアント・ビルド成果物に**キー混入ゼロ**
- [ ] 送信先ホワイトリスト・ログ無害化・no-store
- [ ] CI/CDで**Secrets マスク**実装
- [ ] 監視ダッシュボードの設定

### 運用監視項目
- [ ] OpenAI/Anthropic **Usageダッシュボード**で急増アラート
- [ ] Supabase **接続/クエリ数**の異常検知
- [ ] `RoutingLogs`：急増や夜間スパイク、`is_fallback` 異常増加を監視

## 参考資料

- [250805-phase2-completion-summary.md](./250805-phase2-completion-summary.md) - Phase2完了サマリー
- [OpenAI API Key Management](https://platform.openai.com/api-keys)
- [Anthropic API Keys](https://console.anthropic.com/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)
- [gitleaks Documentation](https://github.com/zricethezav/gitleaks)

## 結論

**APIキーの即座ローテーションと再発防止策の実装により、Phase2完了後の本番投入前のセキュリティ強化が完了します。**

このガイドに従って実装することで、以下のセキュリティレベルを達成できます：

1. **既存キーの無効化**: 漏えいリスクの排除
2. **履歴の完全削除**: Git履歴からの秘密情報除去
3. **再発防止**: 恒常的なセキュリティ監視
4. **最小権限**: 必要最小限のアクセス権限
5. **運用監視**: リアルタイムでの異常検知

**Phase3（本番運用）への安全な移行が可能になります。**

---

**作成日**: 2025-08-06  
**参照**: 250805-phase2-completion-summary.md  
**ステータス**: 実装中 