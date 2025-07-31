import { Page } from '@playwright/test';

export type UserRole = 'user' | 'editor' | 'approver' | 'admin';

interface TestUser {
  email: string;
  password: string;
  role: UserRole;
}

export const TEST_USERS: Record<UserRole, TestUser> = {
  user: {
    email: 'test.user@example.com',
    password: 'testuser123',
    role: 'user'
  },
  editor: {
    email: 'test.editor@example.com',
    password: 'testeditor123',
    role: 'editor'
  },
  approver: {
    email: 'test.approver@example.com',
    password: 'testapprover123',
    role: 'approver'
  },
  admin: {
    email: 'test.admin@example.com',
    password: 'testadmin123',
    role: 'admin'
  }
};

export async function loginAs(page: Page, role: UserRole) {
  const user = TEST_USERS[role];
  
  await page.goto('/admin/login');
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('パスワード').fill(user.password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  
  // ログイン完了を待機
  await page.waitForURL('/admin');
} 