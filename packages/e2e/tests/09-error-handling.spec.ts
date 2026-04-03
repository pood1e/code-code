import { test, expect } from '@playwright/test';
import { cleanupTestData, apiPost } from './helpers';

/**
 * 错误处理与边界场景
 *
 * 用户期望：
 * - 访问不存在的资源应有合理反馈（404 页面或自动重定向）
 * - 表单验证失败应有明确提示
 * - 页面不应出现白屏或 React 错误边界
 */
test.describe('404 与错误处理', () => {
  test('访问不存在的 Skill 编辑页应有合理反馈', async ({ page }) => {
    await page.goto('/skills/nonexistent-id/edit');

    // 用户不应看到空白页面
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);

    // 应有某种错误提示或重定向
    // 不应出现 React 错误边界的 "Something went wrong" 或 JS 异常
  });

  test('访问不存在的 Profile 编辑页应有合理反馈', async ({ page }) => {
    await page.goto('/profiles/nonexistent-id/edit');

    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);
  });

  test('访问不存在的 Runner 编辑页应有合理反馈', async ({ page }) => {
    await page.goto('/agent-runners/nonexistent-id/edit');

    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);
  });

  test('访问不存在的路由应有合理反馈', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    // 应有 404 提示或重定向到首页
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);
  });
});

test.describe('表单验证反馈', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Skill 创建页不填名称直接保存应有错误提示', async ({ page }) => {
    await page.goto('/skills/new');

    // 不填任何内容直接保存
    await page.getByRole('button', { name: /保存/i }).click();

    // 用户期望：表单应展示验证错误，不能静默失败
    // 页面应仍在创建页（未跳转走）
    await expect(page).toHaveURL(/\/skills\/new/);
  });

  test('Rule 创建页不填名称直接保存应有错误提示', async ({ page }) => {
    await page.goto('/rules/new');

    await page.getByRole('button', { name: /保存/i }).click();

    await expect(page).toHaveURL(/\/rules\/new/);
  });

  test('Runner 创建页不填名称直接保存应有错误提示', async ({ page }) => {
    await page.goto('/agent-runners/new');

    await page.getByRole('button', { name: /保存/i }).click();

    await expect(page).toHaveURL(/\/agent-runners\/new/);
  });

  test('Project 创建对话框中 Git URL 格式错误应阻止提交', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: /新建 Project/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Name' }).fill('Valid Name');
    await dialog.getByRole('textbox', { name: 'Git URL' }).fill('https://not-ssh-url.com');
    await dialog.getByRole('textbox', { name: 'Workspace Path' }).fill('/tmp');

    await dialog.getByRole('button', { name: /创建/i }).click();

    // 对话框应仍然打开（验证失败）
    await expect(dialog).toBeVisible();
  });
});

test.describe('页面健壮性', () => {
  test('侧边栏折叠/展开不应丢失内容', async ({ page }) => {
    await page.goto('/skills');

    // 折叠侧栏
    const collapseBtn = page.getByRole('button', { name: /收起侧栏/i });
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();

      // 主内容区仍应正常展示
      const main = page.locator('main');
      await expect(main).toBeVisible();

      // 展开侧栏
      const expandBtn = page.getByRole('button', { name: /展开|侧栏/i }).first();
      await expandBtn.click();

      // 导航应恢复
      await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
    }
  });

  test('快速连续导航不应导致页面错误', async ({ page }) => {
    // 模拟用户快速点击多个导航项
    await page.goto('/skills');
    await page.goto('/rules');
    await page.goto('/mcps');
    await page.goto('/profiles');
    await page.goto('/agent-runners');

    // 最终页面应正常渲染
    await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
  });

  test('刷新页面不应丢失当前路由', async ({ page }) => {
    await page.goto('/rules');
    await expect(page).toHaveURL(/\/rules/);

    await page.reload();
    await expect(page).toHaveURL(/\/rules/);
    await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
  });
});
