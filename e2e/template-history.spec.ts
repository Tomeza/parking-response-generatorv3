import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import {
  createTestTemplate,
  navigateToTemplateHistory,
  changeTemplateStatus,
  getHistoryEntries,
  checkStatusChangeFormVisibility
} from './helpers/template';

test.describe('テンプレート履歴管理', () => {
  test('承認者は履歴の閲覧とステータス変更が可能', async ({ page }) => {
    // 承認者としてログイン
    await loginAs(page, 'approver');
    
    // テスト用テンプレートを作成
    const template = await createTestTemplate(page);
    
    // 履歴ページに移動
    await navigateToTemplateHistory(page, template.id);
    
    // ステータス変更フォームが表示されていることを確認
    const { isVisible, isDisabled } = await checkStatusChangeFormVisibility(page);
    expect(isVisible).toBe(true);
    expect(isDisabled).toBe(false);
    
    // ステータスを変更（draft → approved）
    await changeTemplateStatus(page, 'approved', '内容を確認し、承認します');
    
    // 履歴エントリを取得して検証
    const entries = await getHistoryEntries(page);
    expect(entries[0]).toMatchObject({
      oldStatus: '下書き',
      newStatus: '承認済み',
      comment: '内容を確認し、承認します'
    });
  });

  test('一般ユーザーは履歴の閲覧のみ可能', async ({ page }) => {
    // 一般ユーザーとしてログイン
    await loginAs(page, 'user');
    
    // テスト用テンプレートを作成（APIで直接作成）
    const template = await createTestTemplate(page);
    
    // 履歴ページに移動
    await navigateToTemplateHistory(page, template.id);
    
    // ステータス変更フォームが非表示であることを確認
    const { isVisible } = await checkStatusChangeFormVisibility(page);
    expect(isVisible).toBe(false);
    
    // 履歴テーブルは表示されていることを確認
    const tableVisible = await page.$('table').then(Boolean);
    expect(tableVisible).toBe(true);
  });

  test('ページネーションの動作確認', async ({ page }) => {
    // 管理者としてログイン
    await loginAs(page, 'admin');
    
    // テスト用テンプレートを作成
    const template = await createTestTemplate(page);
    
    // 複数のステータス変更を実行して履歴を作成
    const statusChanges = [
      { status: 'approved', comment: '1回目の承認' },
      { status: 'draft', comment: '修正のため差し戻し' },
      { status: 'approved', comment: '2回目の承認' },
      { status: 'archived', comment: 'アーカイブ' }
    ];
    
    for (const change of statusChanges) {
      await navigateToTemplateHistory(page, template.id);
      await changeTemplateStatus(page, change.status as any, change.comment);
    }
    
    // 1ページ目の履歴を確認
    await navigateToTemplateHistory(page, template.id);
    const firstPageEntries = await getHistoryEntries(page);
    expect(firstPageEntries.length).toBeGreaterThan(0);
    
    // 2ページ目が存在する場合、ページ遷移を確認
    const nextButton = await page.$('button:has-text("次へ")');
    if (nextButton) {
      await nextButton.click();
      const secondPageEntries = await getHistoryEntries(page);
      expect(secondPageEntries).not.toEqual(firstPageEntries);
    }
  });

  test('エラーハンドリングの確認', async ({ page }) => {
    // 承認者としてログイン
    await loginAs(page, 'approver');
    
    // 存在しないテンプレートIDでアクセス
    await page.goto('/admin/templates/non-existent-id/history');
    
    // エラーメッセージが表示されることを確認
    const errorMessage = await page.textContent('.text-red-700');
    expect(errorMessage).toContain('テンプレートが見つかりません');
  });

  test('ステータス変更時のバリデーション', async ({ page }) => {
    // 承認者としてログイン
    await loginAs(page, 'approver');
    
    // テスト用テンプレートを作成
    const template = await createTestTemplate(page);
    await navigateToTemplateHistory(page, template.id);
    
    // コメントなしでステータス変更を試みる
    await page.selectOption('select#status', 'approved');
    await page.click('button[type="submit"]');
    
    // エラーメッセージが表示されることを確認
    const errorVisible = await page.isVisible('.text-red-700');
    expect(errorVisible).toBe(true);
  });
}); 