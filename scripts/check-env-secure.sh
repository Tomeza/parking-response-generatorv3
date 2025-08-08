#!/bin/bash

# Secure Environment Variables Check Script
# Date: 2025-08-08
# Purpose: Check environment variables without exposing values

echo "🔒 Environment Variables Check (Secure)"
echo "======================================"

# ローカル環境変数の確認
echo ""
echo "📁 Local Environment (.env.local):"
required_vars=(
    "DATABASE_URL"
    "DIRECT_URL"
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "OPENAI_API_KEY"
    "ANTHROPIC_API_KEY"
)

for var in "${required_vars[@]}"; do
    if grep -q "^${var}=" .env.local 2>/dev/null; then
        echo "✅ $var: 設定済み"
    else
        echo "❌ $var: 未設定"
    fi
done

# Vercel環境変数の確認
echo ""
echo "☁️  Vercel Environment (Production):"
echo "Checking Vercel environment variables..."

# Vercel環境変数の一覧を取得（値は表示しない）
if command -v vercel &> /dev/null; then
    echo "Vercel CLI available. Use 'npx vercel env ls production' to check."
else
    echo "Vercel CLI not available. Check manually in Vercel dashboard."
fi

# プリビルドガードのテスト
echo ""
echo "🛡️  Prebuild Guard Test:"
NODE_ENV=production npm run prebuild

echo ""
echo "✅ Environment Check Completed" 