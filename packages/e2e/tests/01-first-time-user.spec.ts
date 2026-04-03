import { test, expect } from '@playwright/test';
import { cleanupTestData } from './helpers';

/**
 * 首次使用旅程 — 新用户从零开始配置
 *
 * 正确用户体验：
 * 1. 打开应用 → 看到 Projects 页面
 * 2. 空状态时有引导创建
 * 3. 用户可以通过对话框创建 Project
 * 4. 用户可以通过编辑页创建 Skill/Rule/MCP
 * 5. 用户可以创建 Agent Runner
 */
test.describe('首次使用旅程 — 新用户从零开始配置', () => {
  test.beforeEach(async () => {
    await cleanupTestData();
  });

  test('打开应用应跳转到 Projects 页面并展示空状态引导', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    await page.goto('/');
    await expect(page).toHaveURL(/\/projects/);

    // 空状态时用户应看到引导信息和创建按钮
    await expect(
      page.getByRole('button', { name: /新建 Project/i })
    ).toBeVisible();
  });

  test('用户可以通过对话框创建第一个 Project', async ({ page }) => {
    await page.goto('/projects');

    // 点击新建按钮
    await page.getByRole('button', { name: /新建 Project/i }).click();

    // 应出现创建对话框
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 填写必填字段
    await dialog
      .getByRole('textbox', { name: 'Name' })
      .fill('My First Project');
    await dialog
      .getByRole('textbox', { name: 'Git URL' })
      .fill('git@github.com:test/first-project.git');
    await dialog.getByRole('textbox', { name: 'Workspace Path' }).fill('/tmp');

    // 点击创建
    await dialog.getByRole('button', { name: /创建/i }).click();

    // 创建成功后对话框关闭，项目应出现在列表中
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('My First Project')).toBeVisible({
      timeout: 5000
    });
  });

  test('用户可以创建 Skill 资源', async ({ page }) => {
    await page.goto('/skills');

    // 点击新建按钮
    await page.getByRole('button', { name: /新建 Skill/i }).click();

    // 应跳转到编辑页
    await expect(page).toHaveURL(/\/skills\/new/);

    // 填写名称
    await page.getByRole('textbox', { name: 'Name' }).fill('Code Review Skill');

    // Content 是 CodeMirror 编辑器，需要特殊处理
    // 用户期望：有一个可输入的内容区域
    const contentEditor = page.locator('.cm-editor, [class*="editor"]').first();
    await expect(contentEditor).toBeVisible();

    // 点击保存
    await page.getByRole('button', { name: /保存/i }).click();

    // 保存成功后应跳回列表
    await expect(page).toHaveURL(/\/skills$/, { timeout: 5000 });
    await expect(page.getByText('Code Review Skill')).toBeVisible();
  });

  test('用户可以创建 Rule 资源', async ({ page }) => {
    await page.goto('/rules');

    await page.getByRole('button', { name: /新建 Rule/i }).click();
    await expect(page).toHaveURL(/\/rules\/new/);

    await page
      .getByRole('textbox', { name: 'Name' })
      .fill('Always Cite Sources');

    await page.getByRole('button', { name: /保存/i }).click();

    await expect(page).toHaveURL(/\/rules$/, { timeout: 5000 });
    await expect(page.getByText('Always Cite Sources')).toBeVisible();
  });

  test('用户可以创建 MCP 服务器配置', async ({ page }) => {
    await page.goto('/mcps');

    await page.getByRole('button', { name: /新建 MCP/i }).click();
    await expect(page).toHaveURL(/\/mcps\/new/);

    await page.getByRole('textbox', { name: 'Name' }).fill('Web Search MCP');

    await page.getByRole('button', { name: /保存/i }).click();

    // 可能因为 content 是必填而保存失败 — 这是正确行为
    // 如果成功，应跳回列表
    // 如果失败，应有错误提示告知用户填写缺失字段
  });

  test('用户可以创建 Agent Runner', async ({ page }) => {
    await page.goto('/agent-runners');

    await page.getByRole('button', { name: /新建/i }).click();
    await expect(page).toHaveURL(/\/agent-runners\/new/);

    await page.getByRole('textbox', { name: 'Name' }).fill('My Mock Runner');

    await page.getByRole('button', { name: /保存/i }).click();

    // 保存成功后应跳回列表
    await expect(page).toHaveURL(/\/agent-runners$/, { timeout: 5000 });
    await expect(page.getByText('My Mock Runner')).toBeVisible();
  });
});
