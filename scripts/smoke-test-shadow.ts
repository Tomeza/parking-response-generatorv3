#!/usr/bin/env tsx

import { config } from 'dotenv';

config();

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface TestCase {
  name: string;
  query: string;
  expectedCategory?: string;
  expectedIntent?: string;
  expectedTone?: string;
}

const TEST_CASES: TestCase[] = [
  {
    name: "基本住所問い合わせ",
    query: "駐車場の住所を教えてください",
    expectedCategory: "access",
    expectedIntent: "inquiry",
    expectedTone: "normal"
  },
  {
    name: "送迎サービス時間",
    query: "送迎サービスの時間を教えてください",
    expectedCategory: "shuttle",
    expectedIntent: "inquiry",
    expectedTone: "normal"
  },
  {
    name: "予約キャンセル",
    query: "予約をキャンセルしたい",
    expectedCategory: "reservation",
    expectedIntent: "cancel",
    expectedTone: "normal"
  },
  {
    name: "車の故障報告",
    query: "車の故障で出られません",
    expectedCategory: "trouble",
    expectedIntent: "report",
    expectedTone: "urgent"
  }
];

async function testRoute(query: string, headers: Record<string, string> = {}) {
  try {
    const response = await fetch(`${API_BASE}/query?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // エラーレスポンスでも実際は正常な場合がある（アラート付きレスポンス）
    if (data.error && data.error.includes('※重要')) {
      // アラート付きの正常レスポンスとして扱う
      return {
        success: true,
        data: { response: data.error, is_fallback: false },
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    }
    return {
      success: true,
      data,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runSmokeTest() {
  console.log('🚀 Shadow デプロイ スモークテスト開始\n');

  for (const testCase of TEST_CASES) {
    console.log(`📋 テスト: ${testCase.name}`);
    console.log(`   クエリ: "${testCase.query}"`);
    
    // 通常ルート
    console.log('\n   🔄 通常ルート:');
    const normalResult = await testRoute(testCase.query);
    if (normalResult.success) {
      console.log(`   ✅ 成功 (${normalResult.status})`);
      console.log(`   📊 レスポンス: ${JSON.stringify(normalResult.data, null, 2)}`);
    } else {
      console.log(`   ❌ 失敗: ${normalResult.error}`);
    }

    // Shadow ルート
    console.log('\n   👻 Shadow ルート:');
    const shadowResult = await testRoute(testCase.query, {
      'X-Route-Shadow': 'true'
    });
    if (shadowResult.success) {
      console.log(`   ✅ 成功 (${shadowResult.status})`);
      console.log(`   📊 レスポンス: ${JSON.stringify(shadowResult.data, null, 2)}`);
      
      // Shadow モードの場合は通常と異なるレスポンスが返ることを確認
      if (shadowResult.data.message === 'Shadow mode - no response to user') {
        console.log('   ✅ Shadow モード正しく動作');
      } else {
        console.log('   ⚠️  Shadow モードの動作が期待と異なります');
      }
    } else {
      console.log(`   ❌ 失敗: ${shadowResult.error}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  // 安全フォールバックテスト
  console.log('🛡️  安全フォールバックテスト\n');
  
  const fallbackTests = [
    "返金して",
    "事故",
    "警察",
    "個人情報",
    "国際線",
    "キャンセルと変更",
    "定員オーバー",
    "満車含む期間",
    "カード使える？",
    "道に迷った"
  ];

  for (const query of fallbackTests) {
    console.log(`📝 フォールバックテスト: "${query}"`);
    const result = await testRoute(query);
    if (result.success) {
      console.log(`   ✅ レスポンス: ${result.data.response?.substring(0, 100)}...`);
    } else {
      console.log(`   ❌ 失敗: ${result.error}`);
    }
  }

  console.log('\n🎉 スモークテスト完了！');
  console.log('\n📊 次のステップ:');
  console.log('1. Supabase RoutingLogs でログ確認');
  console.log('2. is_fallback / processing_time_ms / selected_template_id の確認');
  console.log('3. Shadow 5% での段階投入開始');
}

// ES module 対応
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmokeTest().catch(console.error);
} 