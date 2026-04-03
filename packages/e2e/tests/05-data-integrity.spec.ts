import { test, expect } from '@playwright/test';
import { cleanupTestData, apiPost, apiDelete } from './helpers';

/**
 * 数据完整性 — 跨模块的用户可见影响
 *
 * 正确业务语义：
 * - 删除资源后，引用它的 Profile 应有合理反馈（不能静默丢失）
 * - 删除 Project 后，相关 Sessions 应清理
 * - 重复名称应有合理处理
 */
test.describe('引用冲突保护', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('被 Profile 引用的 Skill 删除应有冲突提示', async ({ page }) => {
    // 创建 Skill + Profile + 关联
    const skill = await apiPost('/skills', {
      name: 'Referenced Skill',
      content: 'content'
    });
    const profile = await apiPost('/profiles', { name: 'Ref Profile' });
    await fetch(`http://localhost:3001/api/profiles/${profile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ref Profile',
        skills: [{ resourceId: skill.id, order: 0 }],
        mcps: [],
        rules: []
      })
    });

    await page.goto('/skills');

    // 点击删除
    await page.getByRole('button', { name: /删除 Referenced Skill/i }).click();

    // 应出现确认对话框
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toBeVisible();

    // 用户确认删除
    const confirmBtn = dialog
      .getByRole('button', { name: /确认|删除|confirm|delete/i })
      .first();
    await confirmBtn.click();

    // 因为被引用，应该看到错误提示（409 冲突）
    // 用户期望：有 toast 或 message 告知无法删除
    // Skill 应仍然存在
    await page.reload();
    await expect(page.getByText('Referenced Skill')).toBeVisible();
  });

  test('未被引用的 Skill 可以成功删除', async ({ page }) => {
    const skill = await apiPost('/skills', {
      name: 'Orphan Skill',
      content: 'content'
    });

    await page.goto('/skills');
    await expect(page.getByText('Orphan Skill')).toBeVisible();

    // 点击删除
    await page.getByRole('button', { name: /删除 Orphan Skill/i }).click();

    // 确认删除
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toBeVisible();
    const confirmBtn = dialog
      .getByRole('button', { name: /确认|删除|confirm|delete/i })
      .first();
    await confirmBtn.click();

    // 应该删除成功，Skill 不再出现
    await expect(page.getByText('Orphan Skill')).not.toBeVisible();
  });
});

test.describe('Project 创建验证', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('创建 Project 时缺少必填字段应有错误提示', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: /新建 Project/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 不填任何字段，直接点创建
    await dialog.getByRole('button', { name: /创建/i }).click();

    // 用户期望：表单应有验证错误提示，不能静默失败
    // 对话框应仍然打开（创建未成功）
    await expect(dialog).toBeVisible();
  });

  test('workspacePath 为无效路径时应有错误提示', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: /新建 Project/i }).click();

    const dialog = page.getByRole('dialog');

    await dialog
      .getByRole('textbox', { name: 'Name' })
      .fill('Bad Path Project');
    await dialog
      .getByRole('textbox', { name: 'Git URL' })
      .fill('git@github.com:test/bad.git');
    await dialog
      .getByRole('textbox', { name: 'Workspace Path' })
      .fill('/nonexistent/path/12345');

    await dialog.getByRole('button', { name: /创建/i }).click();

    // 用户期望：API 返回 400，UI 应展示错误提示
    // 对话框应仍然打开
    await expect(dialog).toBeVisible();
  });

  test('gitUrl 格式不正确时应有错误提示', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: /新建 Project/i }).click();

    const dialog = page.getByRole('dialog');

    await dialog.getByRole('textbox', { name: 'Name' }).fill('Bad Git Project');
    await dialog
      .getByRole('textbox', { name: 'Git URL' })
      .fill('not-a-git-url');
    await dialog.getByRole('textbox', { name: 'Workspace Path' }).fill('/tmp');

    await dialog.getByRole('button', { name: /创建/i }).click();

    // 对话框应仍然打开（创建失败）
    await expect(dialog).toBeVisible();
  });
});

test.describe('导出功能', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Profile 导出 JSON 应能下载文件', async ({ page }) => {
    const profile = await apiPost('/profiles', { name: 'Export Test' });

    // 通过 API 直接验证导出端点（E2E 层面确认端点可达）
    const response = await page.request.get(
      `http://localhost:3001/api/profiles/${profile.id}/export`
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['content-disposition']).toContain('.json');

    const body = await response.json();
    expect(body.name).toBe('Export Test');
  });

  test('Profile 导出 YAML 应能下载文件', async ({ page }) => {
    const profile = await apiPost('/profiles', { name: 'YAML Export Test' });

    const response = await page.request.get(
      `http://localhost:3001/api/profiles/${profile.id}/export?format=yaml`
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/x-yaml');
    expect(response.headers()['content-disposition']).toContain('.yaml');

    const text = await response.text();
    expect(text).toContain('name: YAML Export Test');
  });
});
