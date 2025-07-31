import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import {
  createTestTemplate,
  navigateToTemplateHistory,
  changeTemplateStatus,
  getHistoryEntries
} from './helpers/template';

test.describe('テンプレート履歴 - 並行処理', () => {
  test('複数ユーザーによる同時操作', async ({ browser }) => {
    // 2つの異なるコンテキストを作成（異なるユーザーセッション）
    const approverContext = await browser.newContext();
    const adminContext = await browser.newContext();
    
    const approverPage = await approverContext.newPage();
    const adminPage = await adminContext.newPage();

    // それぞれのユーザーでログイン
    await loginAs(approverPage, 'approver');
    await loginAs(adminPage, 'admin');

    // テスト用テンプレートを作成
    const template = await createTestTemplate(approverPage);

    // 両方のユーザーが同じテンプレートの履歴ページを開く
    await navigateToTemplateHistory(approverPage, template.id);
    await navigateToTemplateHistory(adminPage, template.id);

    // 同時にステータス変更を試みる
    const [approverResult, adminResult] = await Promise.all([
      changeTemplateStatus(approverPage, 'approved', '承認者による承認'),
      changeTemplateStatus(adminPage, 'archived', '管理者によるアーカイブ')
    ]);

    // 両方のページで最新の履歴を取得
    const approverHistory = await getHistoryEntries(approverPage);
    const adminHistory = await getHistoryEntries(adminPage);

    // 履歴が同期されていることを確認
    expect(approverHistory).toEqual(adminHistory);

    // コンテキストをクリーンアップ
    await approverContext.close();
    await adminContext.close();
  });

  test('ページ更新中のステータス変更', async ({ page }) => {
    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);
    await navigateToTemplateHistory(page, template.id);

    // ページネーション中にステータス変更
    await Promise.all([
      page.click('button:has-text("次へ")'),
      changeTemplateStatus(page, 'approved', 'ページ遷移中の承認')
    ]);

    // 正しいページが表示され、最新の履歴が反映されていることを確認
    const history = await getHistoryEntries(page);
    expect(history[0].comment).toBe('ページ遷移中の承認');
  });

  test('複数タブでの操作', async ({ context }) => {
    // 2つのタブを開く
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    // 両方のタブで同じユーザーとしてログイン
    await loginAs(tab1, 'approver');
    await loginAs(tab2, 'approver');

    // テンプレートを作成し、両方のタブで開く
    const template = await createTestTemplate(tab1);
    await navigateToTemplateHistory(tab1, template.id);
    await navigateToTemplateHistory(tab2, template.id);

    // タブ1でステータス変更
    await changeTemplateStatus(tab1, 'approved', 'タブ1での承認');

    // タブ2で古い状態のままステータス変更を試みる
    await changeTemplateStatus(tab2, 'draft', 'タブ2での差し戻し');

    // 両方のタブの履歴を確認
    const tab1History = await getHistoryEntries(tab1);
    const tab2History = await getHistoryEntries(tab2);

    // 履歴が同期されていることを確認
    expect(tab1History).toEqual(tab2History);

    // タブをクリーンアップ
    await tab1.close();
    await tab2.close();
  });

  test('高頻度の更新とリアルタイム反映', async ({ browser }) => {
    // 2つの異なるコンテキストを作成
    const writerContext = await browser.newContext();
    const readerContext = await browser.newContext();
    
    const writerPage = await writerContext.newPage();
    const readerPage = await readerContext.newPage();

    // 異なるロールでログイン
    await loginAs(writerPage, 'approver');
    await loginAs(readerPage, 'user');

    // テンプレートを作成
    const template = await createTestTemplate(writerPage);

    // 両方のページでテンプレート履歴を開く
    await navigateToTemplateHistory(writerPage, template.id);
    await navigateToTemplateHistory(readerPage, template.id);

    // 高頻度でステータス変更を実行しながら、読み取り側で更新を監視
    const changes = [
      { status: 'approved', comment: '承認 1' },
      { status: 'draft', comment: '差し戻し 1' },
      { status: 'approved', comment: '承認 2' }
    ];

    for (const change of changes) {
      await changeTemplateStatus(writerPage, change.status as any, change.comment);
      await readerPage.waitForTimeout(100); // 更新を待機

      // 読み取り側で最新の履歴を取得
      const readerHistory = await getHistoryEntries(readerPage);
      expect(readerHistory[0].comment).toBe(change.comment);
    }

    // コンテキストをクリーンアップ
    await writerContext.close();
    await readerContext.close();
  });

  test('ネットワーク遅延時の動作', async ({ page }) => {
    // ネットワークの遅延を設定
    await page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒の遅延
      await route.continue();
    });

    await loginAs(page, 'approver');
    const template = await createTestTemplate(page);
    await navigateToTemplateHistory(page, template.id);

    // ステータス変更中のローディング表示を確認
    const changePromise = changeTemplateStatus(page, 'approved', '遅延テスト');
    const loadingVisible = await page.isVisible('text=処理中...');
    expect(loadingVisible).toBe(true);

    await changePromise;

    // 変更が正しく反映されたことを確認
    const history = await getHistoryEntries(page);
    expect(history[0].comment).toBe('遅延テスト');
  });
}); 