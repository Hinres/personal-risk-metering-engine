import { test, expect } from '@playwright/test';

test.describe('登录页面', () => {
  test('登录页面加载正常', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('text=登录')).toBeVisible();
  });

  test('空用户名密码显示错误提示', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=请输入用户名')).toBeVisible();
  });
});
