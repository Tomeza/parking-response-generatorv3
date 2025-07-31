import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import {
  createTestTemplate,
  navigateToTemplateHistory,
  changeTemplateStatus,
  getHistoryEntries
} from './helpers/template';

test.describe('テンプレート履歴 - パフォーマンス', () => {
  test('初期読み込み時間の計測', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);

    // 大量の履歴データを生成
    for (let i = 0; i < 50; i++) {
      await changeTemplateStatus(page, 'approved', `テストデータ ${i}`);
      await changeTemplateStatus(page, 'draft', `差し戻し ${i}`);
    }

    // ページ読み込み時間を計測
    const startTime = Date.now();
    await navigateToTemplateHistory(page, template.id);
    await page.waitForSelector('table tbody tr');
    const loadTime = Date.now() - startTime;

    // 読み込み時間が3秒以内であることを確認
    expect(loadTime).toBeLessThan(3000);

    // データが正しく表示されていることを確認
    const entries = await getHistoryEntries(page);
    expect(entries.length).toBeGreaterThan(0);
  });

  test('ページネーション切り替え時間の計測', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);

    // 大量の履歴データを生成
    for (let i = 0; i < 30; i++) {
      await changeTemplateStatus(page, 'approved', `テストデータ ${i}`);
    }

    await navigateToTemplateHistory(page, template.id);

    // ページ切り替え時間を計測
    const startTime = Date.now();
    await page.click('button:has-text("次へ")');
    await page.waitForResponse(response => 
      response.url().includes('/api/templates') &&
      response.status() === 200
    );
    const switchTime = Date.now() - startTime;

    // 切り替え時間が1秒以内であることを確認
    expect(switchTime).toBeLessThan(1000);
  });

  test('ステータス変更のレスポンス時間', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);
    await navigateToTemplateHistory(page, template.id);

    // ステータス変更時間を計測
    const startTime = Date.now();
    await changeTemplateStatus(page, 'approved', 'パフォーマンステスト');
    const changeTime = Date.now() - startTime;

    // 変更処理が2秒以内に完了することを確認
    expect(changeTime).toBeLessThan(2000);
  });

  test('メモリ使用量の監視', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);

    // 大量のデータを生成してメモリ使用量を監視
    const memorySnapshots = [];
    for (let i = 0; i < 20; i++) {
      await changeTemplateStatus(page, 'approved', `大量データ ${i}`);
      
      // JavaScriptヒープサイズを取得
      const metrics = await page.evaluate(() => ({
        jsHeapSize: performance.memory?.usedJSHeapSize || 0
      }));
      memorySnapshots.push(metrics.jsHeapSize);
    }

    // メモリ使用量が一定以下であることを確認
    const maxMemoryIncrease = Math.max(...memorySnapshots) - Math.min(...memorySnapshots);
    expect(maxMemoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB以下
  });

  test('長時間操作時のパフォーマンス', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);
    await navigateToTemplateHistory(page, template.id);

    const operationTimes = [];
    
    // 30分間、定期的にステータス変更を実行
    const startTime = Date.now();
    const duration = 30 * 60 * 1000; // 30分

    while (Date.now() - startTime < duration) {
      const opStartTime = Date.now();
      await changeTemplateStatus(page, 'approved', `長時間テスト ${Date.now()}`);
      operationTimes.push(Date.now() - opStartTime);

      await page.waitForTimeout(30000); // 30秒待機
    }

    // 操作時間が一定以下を維持していることを確認
    const averageTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
    const maxTime = Math.max(...operationTimes);

    expect(averageTime).toBeLessThan(2000); // 平均2秒以下
    expect(maxTime).toBeLessThan(5000); // 最大5秒以下
  });

  test('並行リクエスト時のレスポンス時間', async ({ browser }) => {
    // 10個の並行セッションを作成
    const sessions = await Promise.all(
      Array(10).fill(null).map(async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs(page, 'approver');
        return { context, page };
      })
    );

    // 各セッションで同時にテンプレート履歴を取得
    const template = await createTestTemplate(sessions[0].page);
    
    const startTime = Date.now();
    await Promise.all(
      sessions.map(async ({ page }) => {
        await navigateToTemplateHistory(page, template.id);
        await page.waitForSelector('table tbody tr');
      })
    );
    const totalTime = Date.now() - startTime;

    // 全セッションの読み込みが5秒以内に完了することを確認
    expect(totalTime).toBeLessThan(5000);

    // セッションをクリーンアップ
    await Promise.all(
      sessions.map(async ({ context }) => await context.close())
    );
  });
}); 