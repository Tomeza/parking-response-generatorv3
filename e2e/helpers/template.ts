import { Page } from '@playwright/test';

export type TemplateStatus = 'draft' | 'approved' | 'archived';

interface TemplateData {
  id: string;
  status: TemplateStatus;
}

export async function createTestTemplate(page: Page): Promise<TemplateData> {
  // テスト用テンプレートの作成（APIを直接呼び出し）
  const response = await page.request.post('/api/templates', {
    data: {
      category: 'test',
      intent: 'test',
      tone: 'formal',
      body: 'テスト用テンプレート',
      variables: {},
      importance: 1,
      frequency: 1,
      status: 'draft'
    }
  });

  const data = await response.json();
  return {
    id: data.data.id,
    status: data.data.status
  };
}

export async function navigateToTemplateHistory(page: Page, templateId: string) {
  await page.goto(`/admin/templates/${templateId}/history`);
  // 履歴テーブルの読み込みを待機
  await page.waitForSelector('table');
}

export async function changeTemplateStatus(
  page: Page,
  status: TemplateStatus,
  comment: string
) {
  await page.selectOption('select#status', status);
  await page.fill('textarea#comment', comment);
  await page.click('button[type="submit"]');
  
  // 変更が反映されるまで待機
  await page.waitForResponse(response => 
    response.url().includes('/api/templates') && 
    response.request().method() === 'PATCH'
  );
  
  // テーブルの更新を待機
  await page.waitForTimeout(500); // データ再取得の待機
}

export async function getHistoryEntries(page: Page) {
  return await page.$$eval('table tbody tr', rows => 
    rows.map(row => ({
      oldStatus: row.querySelector('td:nth-child(2)')?.textContent?.trim(),
      newStatus: row.querySelector('td:nth-child(3)')?.textContent?.trim(),
      comment: row.querySelector('td:nth-child(4)')?.textContent?.trim(),
    }))
  );
}

export async function checkStatusChangeFormVisibility(page: Page) {
  return await page.$eval('form', form => {
    const isVisible = window.getComputedStyle(form).display !== 'none';
    const isDisabled = form.querySelector('button[type="submit"]')?.hasAttribute('disabled');
    return { isVisible, isDisabled };
  }).catch(() => ({ isVisible: false, isDisabled: true }));
} 