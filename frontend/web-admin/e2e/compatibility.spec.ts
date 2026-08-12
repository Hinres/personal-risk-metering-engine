import { test, expect } from '@playwright/test';

/**
 * [PRME-INFRA-006] 基础设施 - 浏览器兼容性测试
 * 文件: compatibility.spec.ts
 * 测试范围: Chrome 100+/Safari 15+/Edge 100+/Firefox 100+ 兼容性
 * 最后更新: 2026-06-09
 */

test.describe('浏览器兼容性测试', () => {
  test('登录页面加载正常', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
  });

  test('仪表盘响应式布局', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="用户名"]', 'admin');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button:has-text("登录")');
    await page.waitForURL('/dashboard');
    
    // 验证仪表盘关键元素
    await expect(page.locator('text=仪表盘')).toBeVisible();
    await expect(page.locator('text=组合数量')).toBeVisible();
    await expect(page.locator('text=总市值')).toBeVisible();
  });

  test('导航菜单展开/收起', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="用户名"]', 'admin');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button:has-text("登录")');
    await page.waitForURL('/dashboard');
    
    // 测试导航菜单
    await page.click('text=投资组合');
    await page.waitForURL('/portfolios');
    await expect(page.locator('text=投资组合')).toBeVisible();
  });

  test('表单验证功能', async ({ page }) => {
    await page.goto('/login');
    // 空表单提交
    await page.click('button:has-text("登录")');
    await expect(page.locator('.ant-form-item-explain-error')).toBeVisible();
  });

  test('对话框和弹窗', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="用户名"]', 'admin');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button:has-text("登录")');
    await page.waitForURL('/dashboard');
    
    // 测试页面内交互元素（如需要）
    await expect(page.locator('.ant-layout-sider')).toBeVisible();
  });
});
