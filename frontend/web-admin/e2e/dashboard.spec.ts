import { test, expect } from '@playwright/test';

test.describe('仪表盘页面', () => {
  test('未登录访问仪表盘重定向到登录', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('登录后仪表盘加载正常', async ({ page }) => {
    // 模拟登录（通过 localStorage 设置 token）
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token-for-e2e');
    });
    await page.goto('/dashboard');
    await expect(page.locator('text=仪表盘')).toBeVisible();
  });
});
