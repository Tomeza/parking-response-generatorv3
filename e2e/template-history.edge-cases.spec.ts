import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import {
  createTestTemplate,
  navigateToTemplateHistory,
  changeTemplateStatus,
  getHistoryEntries
} from './helpers/template';

test.describe('テンプレート履歴 - エッジケース', () => {
  test('大量の履歴データの表示とページネーション', async ({ page }) => {
    await loginAs(page, 'admin');
    const template = await createTestTemplate(page);

    // 大量のステータス変更を実行
    const statusCycles = [
      { status: 'approved', comment: '承認' },
      { status: 'draft', comment: '差し戻し' }
    ];

    // 25件の履歴を生成（デフォルトの表示件数は20件）
    for (let i = 0; i < 12; i++) {
      const change = statusCycles[i % 2];
      await navigateToTemplateHistory(page, template.id);
      await changeTemplateStatus(page, change.status as any, `${change.comment} #${i + 1}`);
      // 連続リクエストを避けるため少し待機
      await page.waitForTimeout(100);
    }

    await navigateToTemplateHistory(page, template.id);

    // 1ページ目のエントリ数を確認
    const firstPageEntries = await getHistoryEntries(page);
    expect(firstPageEntries.length).toBe(20); // デフォルトのページサイズ

    // 2ページ目に移動
    await page.click('button:has-text("次へ")');
    const secondPageEntries = await getHistoryEntries(page);
    expect(secondPageEntries.length).toBe(5); // 残りのエントリ
  });

  test('ステータス変更の境界値テスト', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);
    await navigateToTemplateHistory(page, template.id);

    // 最大長のコメントでステータス変更
    const longComment = 'a'.repeat(1000);
    await changeTemplateStatus(page, 'approved', longComment);
    const entries = await getHistoryEntries(page);
    expect(entries[0].comment).toBe(longComment);

    // 空のコメントでステータス変更を試みる
    await page.selectOption('select#status', 'draft');
    await page.click('button[type="submit"]');
    const errorVisible = await page.isVisible('.text-red-700');
    expect(errorVisible).toBe(true);
  });

  test('無効なステータス遷移パターン', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);
    await navigateToTemplateHistory(page, template.id);

    // draft -> archived（無効な遷移）
    await changeTemplateStatus(page, 'archived', 'アーカイブ試行');
    const errorMessage = await page.textContent('.text-red-700');
    expect(errorMessage).toContain('無効なステータス遷移');
  });

  test('存在しないテンプレートへのアクセス', async ({ page }) => {
    await loginAs(page, 'approver');
    await page.goto('/admin/templates/non-existent-id/history');
    
    // エラーメッセージの表示を確認
    const errorMessage = await page.textContent('.text-red-700');
    expect(errorMessage).toContain('テンプレートが見つかりません');
    
    // ステータス変更フォームが非表示であることを確認
    const formVisible = await page.$('form');
    expect(formVisible).toBeNull();
  });

  test('大量のリクエストによる制限確認', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);
    await navigateToTemplateHistory(page, template.id);

    // 短時間での連続リクエスト
    const promises = Array(10).fill(null).map(() => 
      changeTemplateStatus(page, 'approved', '連続リクエストテスト')
    );

    const results = await Promise.allSettled(promises);
    const failedRequests = results.filter(r => r.status === 'rejected');
    
    // レート制限により一部のリクエストが失敗することを確認
    expect(failedRequests.length).toBeGreaterThan(0);
  });

  test('長時間のセッション維持', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);

    // 定期的なステータス変更（5分間）
    const startTime = Date.now();
    const duration = 5 * 60 * 1000; // 5分

    while (Date.now() - startTime < duration) {
      await navigateToTemplateHistory(page, template.id);
      await changeTemplateStatus(page, 'approved', `定期更新 ${new Date().toISOString()}`);
      await page.waitForTimeout(30000); // 30秒待機
    }

    // セッションが維持されていることを確認
    const formVisible = await page.$('form');
    expect(formVisible).toBeTruthy();
  });
}); 