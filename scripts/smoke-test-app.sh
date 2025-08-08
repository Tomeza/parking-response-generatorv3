#!/bin/bash

# Application Smoke Test Script
# Date: 2025-08-08
# Purpose: Test application endpoints after RLS implementation

echo "🚀 Application Smoke Test..."
echo "============================"

# デプロイURLの確認
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <deploy-url>"
    echo "Example: $0 https://parking-response-generatorv3-xxxxx.vercel.app"
    exit 1
fi

DEPLOY_URL="$1"

echo "Testing: $DEPLOY_URL"
echo ""

# === 1) ルートページ（公開） ===
echo "🧪 Testing root page (public)..."
echo "Expected: 200/304"
curl -I "$DEPLOY_URL/" | head -n1

# === 2) ログインページ（公開） ===
echo ""
echo "🧪 Testing login page (public)..."
echo "Expected: 200"
curl -I "$DEPLOY_URL/auth/login" | head -n1

# === 3) 管理画面（認証必要） ===
echo ""
echo "🧪 Testing admin page (auth required)..."
echo "Expected: 302/307 → /admin/login"
curl -I "$DEPLOY_URL/admin" | head -n1

# === 4) 管理API（認証必要） ===
echo ""
echo "🧪 Testing admin API (auth required)..."
echo "Expected: 401"
curl -I "$DEPLOY_URL/api/admin/response-history" | head -n1

# === 5) テンプレートページ（公開） ===
echo ""
echo "🧪 Testing templates page (public)..."
echo "Expected: 200"
curl -I "$DEPLOY_URL/templates" | head -n1

# === 6) 検索ページ（公開） ===
echo ""
echo "🧪 Testing search page (public)..."
echo "Expected: 200"
curl -I "$DEPLOY_URL/search" | head -n1

echo ""
echo "✅ Smoke Test Completed"
echo ""
echo "📊 Summary:"
echo "- Public pages should return 200"
echo "- Admin pages should return 302/307 (redirect)"
echo "- Admin APIs should return 401 (unauthorized)" 