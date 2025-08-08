#!/bin/bash

# RLS Policy Test Script (Fixed)
# Date: 2025-08-08
# Purpose: Test RLS policies after application

echo "🔒 Testing RLS Policies..."
echo "=========================="

# 環境変数の確認（値は表示しない）
echo "Checking environment variables..."
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "✅ SUPABASE_URL: 設定済み"
else
    echo "❌ SUPABASE_URL: 未設定"
    exit 1
fi

if [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "✅ SUPABASE_ANON_KEY: 設定済み"
else
    echo "❌ SUPABASE_ANON_KEY: 未設定"
    exit 1
fi

echo ""
echo "🧪 Testing Templates (approved only)..."
echo "Expected: 200 OK with approved templates only"

# Templates の読み取りテスト
curl -sS "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Templates?select=id,title,status&limit=3" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" | jq '.[] | {id, title, status}'

echo ""
echo "🧪 Testing ResponseLog (should be denied)..."
echo "Expected: 401/403 Forbidden"

# ResponseLog の書き込みテスト（拒否されるべき）
curl -sS -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ResponseLog" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"test":"deny"}' | jq '.'

echo ""
echo "🧪 Testing RoutingLogs (should be denied)..."
echo "Expected: 401/403 Forbidden"

# RoutingLogs の書き込みテスト（拒否されるべき）
curl -sS -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/RoutingLogs" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"test":"deny"}' | jq '.'

echo ""
echo "🧪 Testing FeedbackLogs (should be denied)..."
echo "Expected: 401/403 Forbidden"

# FeedbackLogs の書き込みテスト（拒否されるべき）
curl -sS -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/FeedbackLogs" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"test":"deny"}' | jq '.'

echo ""
echo "✅ RLS Policy Tests Completed" 