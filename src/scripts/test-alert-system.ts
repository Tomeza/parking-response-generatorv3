/**
 * アラートシステムのテストスクリプト
 * 
 * 実行方法: npx ts-node src/scripts/test-alert-system.ts
 */

import { addMandatoryAlerts, detectAlertKeywords, AlertType } from '../lib/alert-system';

// テストケース
const testCases = [
  {
    title: '一般的な問い合わせに注意喚起を追加',
    input: '駐車場の営業時間を教えてください。',
    expectAlerts: true,
  },
  {
    title: '予約関連の問い合わせに注意喚起を追加',
    input: '予約の方法を教えてください。',
    expectAlerts: true,
  },
  {
    title: '既に国際線の注意喚起を含むレスポンス',
    input: 'これは元のレスポンスです。\n\n※重要: 当駐車場は国内線ご利用のお客様専用となっております。国際線ターミナルへの送迎も含め、ご利用いただけません。',
    expectAlerts: true,
    expectInternationalAlert: false,
  },
  {
    title: '既に外車の注意喚起を含むレスポンス',
    input: 'これは元のレスポンスです。\n\n※重要: 当駐車場では場内保険の対象外となるため、全外車（BMW、ベンツ、アウディなどを含む）とレクサス全車種はお預かりできかねます。',
    expectAlerts: true,
    expectLuxuryCarAlert: false,
  },
  {
    title: '両方の注意喚起を既に含むレスポンス',
    input: 'これは元のレスポンスです。\n\n※重要: 当駐車場は国内線ご利用のお客様専用となっております。国際線ターミナルへの送迎も含め、ご利用いただけません。\n\n※重要: 当駐車場では場内保険の対象外となるため、全外車（BMW、ベンツ、アウディなどを含む）とレクサス全車種はお預かりできかねます。',
    expectAlerts: false,
  }
];

// キーワード検出テストケース
const keywordTestCases = [
  {
    title: '国際線キーワードを含むクエリ',
    input: '国際線の予約はできますか？',
    expectedAlerts: [AlertType.INTERNATIONAL_FLIGHT],
  },
  {
    title: '外車キーワードを含むクエリ',
    input: 'レクサスで駐車場を利用できますか？',
    expectedAlerts: [AlertType.LUXURY_CAR],
  },
  {
    title: '両方のキーワードを含むクエリ',
    input: '国際線利用でBMWの駐車は可能ですか？',
    expectedAlerts: [AlertType.INTERNATIONAL_FLIGHT, AlertType.LUXURY_CAR],
  },
  {
    title: 'キーワードを含まないクエリ',
    input: '駐車場の料金を教えてください。',
    expectedAlerts: [],
  }
];

// テスト実行
function runTests() {
  console.log('===== アラートシステムテスト開始 =====\n');
  
  // 注意喚起追加のテスト
  console.log('■ 注意喚起の追加テスト');
  testCases.forEach((testCase, index) => {
    console.log(`\nテスト ${index + 1}: ${testCase.title}`);
    console.log(`入力: "${testCase.input.substring(0, 50)}${testCase.input.length > 50 ? '...' : ''}"`);
    
    const result = addMandatoryAlerts(testCase.input);
    console.log(`出力: "${result.substring(0, 100)}${result.length > 100 ? '...' : ''}"`);
    
    const hasInternational = result.includes('国内線ご利用のお客様専用');
    const hasLuxuryCar = result.includes('全外車');
    
    const success = testCase.expectAlerts ? 
      (testCase.expectInternationalAlert !== false ? hasInternational : true) && 
      (testCase.expectLuxuryCarAlert !== false ? hasLuxuryCar : true) : 
      (result === testCase.input);
    
    console.log(`結果: ${success ? '成功 ✓' : '失敗 ✗'}`);
    if (!success) {
      console.log('期待: ', {
        expectAlerts: testCase.expectAlerts,
        expectInternationalAlert: testCase.expectInternationalAlert,
        expectLuxuryCarAlert: testCase.expectLuxuryCarAlert
      });
      console.log('実際: ', {
        hasInternational,
        hasLuxuryCar,
        unchanged: result === testCase.input
      });
    }
  });
  
  // キーワード検出のテスト
  console.log('\n\n■ キーワード検出テスト');
  keywordTestCases.forEach((testCase, index) => {
    console.log(`\nテスト ${index + 1}: ${testCase.title}`);
    console.log(`クエリ: "${testCase.input}"`);
    
    const detectedAlerts = detectAlertKeywords(testCase.input);
    console.log(`検出: [${detectedAlerts.join(', ')}]`);
    
    const expectedStr = `[${testCase.expectedAlerts.join(', ')}]`;
    const actualStr = `[${detectedAlerts.join(', ')}]`;
    const success = expectedStr === actualStr;
    
    console.log(`結果: ${success ? '成功 ✓' : '失敗 ✗'}`);
    if (!success) {
      console.log(`期待: ${expectedStr}`);
      console.log(`実際: ${actualStr}`);
    }
  });
  
  console.log('\n===== アラートシステムテスト完了 =====');
}

// テスト実行
runTests(); 