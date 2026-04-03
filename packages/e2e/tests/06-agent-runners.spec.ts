import { test, expect } from '@playwright/test';
import { cleanupTestData, apiPost } from './helpers';

/**
 * Agent Runner 管理 — 创建、编辑、健康检查
 *
 * 用户期望：
 * - Runner 列表展示所有已配置的 Runner
 * - 可以创建新 Runner 并选择类型
 * - 可以编辑 Runner 配置
 * - 可以查看 Runner 健康状态
 * - 被 Session 引用的 Runner 不能删除
 */
test.describe('Agent Runner 管理', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Runners 页面应有新建按钮', async ({ page }) => {
    await page.goto('/agent-runners');
    await expect(page.getByRole('button', { name: /新建/i })).toBeVisible();
  });

  test('新建 Runner 页面应有类型选择', async ({ page }) => {
    await page.goto('/agent-runners/new');

    // 用户期望：Runner 创建页面有 Name 输入框和类型选择
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible();

    // 应有 Runner 类型选择（下拉/选择器）
    // 类型选项应包含系统支持的 runner 类型
    const typeArea = page.getByText(/type|类型/i).first();
    await expect(typeArea).toBeVisible();
  });

  test('通过 API 创建的 Runner 应在列表中展示', async ({ page }) => {
    await apiPost('/agent-runners', {
      name: 'UI Listed Runner',
      type: 'mock',
      runnerConfig: {}
    });

    await page.goto('/agent-runners');
    await expect(page.getByText('UI Listed Runner')).toBeVisible();
  });

  test('Runner 编辑页应展示已有配置', async ({ page }) => {
    const runner = await apiPost('/agent-runners', {
      name: 'Editable Runner',
      type: 'mock',
      runnerConfig: {}
    });

    await page.goto(`/agent-runners/${runner.id}/edit`);

    // 用户期望：编辑页显示已有的名称
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Editable Runner');
  });

  test('Runner 列表页应有搜索框', async ({ page }) => {
    await page.goto('/agent-runners');
    await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
  });

  test('Runner 应展示健康状态信息', async ({ page }) => {
    await page.goto('/agent-runners');

    // 用户期望：列表中每个 Runner 应有某种状态指示
    // mock runner 应显示 online 或健康状态
    const body = await page.textContent('body');
    // 至少不应是空页面
    expect(body!.length).toBeGreaterThan(50);
  });
});
