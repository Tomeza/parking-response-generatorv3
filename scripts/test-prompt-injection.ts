import { PI_TEST_CASES } from '../src/lib/validation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

async function testPromptInjection() {
  console.log('🔒 プロンプトインジェクション対策テスト開始\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of PI_TEST_CASES) {
    try {
      console.log(`テストケース: "${testCase}"`);
      
      const response = await fetch(`${API_BASE}/query?q=${encodeURIComponent(testCase)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      // 期待される動作: 200 OK + is_fallback: true
      if (response.status === 200 && data.is_fallback === true) {
        console.log('✅ PASS: 安全なフォールバックに落ちました');
        passed++;
      } else {
        console.log('❌ FAIL: 期待される動作ではありません');
        console.log(`    Status: ${response.status}`);
        console.log(`    Response: ${JSON.stringify(data, null, 2)}`);
        failed++;
      }
    } catch (error) {
      console.log('❌ FAIL: リクエストエラー');
      console.log(`    Error: ${error}`);
      failed++;
    }
    
    console.log('---');
  }

  console.log(`\n📊 テスト結果: ${passed}件成功, ${failed}件失敗`);
  
  if (failed === 0) {
    console.log('🎉 すべてのプロンプトインジェクション対策が正常に動作しています！');
  } else {
    console.log('⚠️ 一部のテストが失敗しました。セキュリティ対策を確認してください。');
  }
}

// ES module compatibility
if (import.meta.url === `file://${process.argv[1]}`) {
  testPromptInjection().catch(console.error);
} 