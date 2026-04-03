import { test, expect } from '@playwright/test';
import { cleanupTestData, apiPost } from './helpers';

/**
 * 日常资源管理 — CRUD 操作
 *
 * 前提：通过 API 预置数据，测试 UI 展示和交互。
 * 不做隐式等待，有错误直接暴露。
 */
test.describe('日常资源管理 — CRUD 操作', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
    await apiPost('/skills', { name: 'Seed Skill', content: 'Skill content for testing' });
    await apiPost('/rules', { name: 'Seed Rule', content: 'Rule content for testing' });
    await apiPost('/mcps', {
      name: 'Seed MCP',
      content: { type: 'stdio', command: 'echo', args: ['hello'] }
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Skills 列表应展示预置的 Skill', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByText('Seed Skill')).toBeVisible();
  });

  test('点击 Skill 名称应进入编辑页', async ({ page }) => {
    await page.goto('/skills');
    // 点击列表中的 Skill 名称（是 button）
    await page.getByRole('button', { name: 'Seed Skill', exact: true }).click();
    // 应跳转到编辑页
    await expect(page).toHaveURL(/\/skills\/[^/]+\/edit/);
    // 编辑页应展示 Name 输入框，且值为 Seed Skill
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Seed Skill');
  });

  test('编辑 Skill 名称后保存应跳回列表并展示新名称', async ({ page }) => {
    await page.goto('/skills');
    // 点击编辑按钮进入编辑页
    await page.getByRole('button', { name: /编辑 Seed Skill/i }).click();
    await expect(page).toHaveURL(/\/skills\/[^/]+\/edit/);

    const nameInput = page.getByRole('textbox', { name: 'Name' });
    await nameInput.clear();
    await nameInput.fill('Updated Skill');

    await page.getByRole('button', { name: /保存/i }).click();

    // 保存成功后应跳回列表
    await expect(page).toHaveURL(/\/skills$/);
    await expect(page.getByText('Updated Skill')).toBeVisible();
  });

  test('Rules 列表应展示预置的 Rule', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.getByText('Seed Rule')).toBeVisible();
  });

  test('MCPs 列表应展示预置的 MCP', async ({ page }) => {
    await page.goto('/mcps');
    await expect(page.getByText('Seed MCP')).toBeVisible();
  });

  test('搜索框可过滤列表', async ({ page }) => {
    // 创建多个 Skill 用于搜索
    await apiPost('/skills', { name: 'Alpha Search', content: 'alpha' });
    await apiPost('/skills', { name: 'Beta Search', content: 'beta' });

    await page.goto('/skills');
    await expect(page.getByText('Alpha Search')).toBeVisible();
    await expect(page.getByText('Beta Search')).toBeVisible();

    // 输入搜索词
    const searchBox = page.getByPlaceholder(/按名称搜索/i);
    await searchBox.fill('Alpha');

    // 应只展示匹配的 Skill
    await expect(page.getByText('Alpha Search')).toBeVisible();
    await expect(page.getByText('Beta Search')).not.toBeVisible();
  });

  test('清空搜索应恢复完整列表', async ({ page }) => {
    await page.goto('/skills');

    const searchBox = page.getByPlaceholder(/按名称搜索/i);
    await searchBox.fill('Nonexistent');
    // 应无匹配
    await expect(page.getByText('Updated Skill')).not.toBeVisible();

    // 清空
    await searchBox.clear();
    // 应恢复所有项
    await expect(page.getByText('Updated Skill')).toBeVisible();
  });
});

test.describe('Profile 聚合管理', () => {
  let skillId: string;
  let ruleId: string;
  let mcpId: string;

  test.beforeAll(async () => {
    await cleanupTestData();

    const skill = await apiPost('/skills', { name: 'Profile Skill', content: 'skill content' });
    const rule = await apiPost('/rules', { name: 'Profile Rule', content: 'rule content' });
    const mcp = await apiPost('/mcps', {
      name: 'Profile MCP',
      content: { type: 'stdio', command: 'node', args: ['server.js'] }
    });

    skillId = skill.id;
    ruleId = rule.id;
    mcpId = mcp.id;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Profiles 页应有新建入口', async ({ page }) => {
    await page.goto('/profiles');
    await expect(page.getByRole('button', { name: /新建/i })).toBeVisible();
  });

  test('Profile 编辑页应展示关联的资源名称', async ({ page }) => {
    // 通过 API 创建一个带资源的 Profile
    const profile = await apiPost('/profiles', { name: 'Full Profile' });
    await fetch(`http://localhost:3000/api/profiles/${profile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Full Profile',
        skills: [{ resourceId: skillId, order: 0 }],
        mcps: [{ resourceId: mcpId, order: 0 }],
        rules: [{ resourceId: ruleId, order: 0 }]
      })
    });

    await page.goto(`/profiles/${profile.id}/edit`);

    // 用户应看到关联的资源名称
    await expect(page.getByText('Profile Skill')).toBeVisible();
    await expect(page.getByText('Profile MCP')).toBeVisible();
    await expect(page.getByText('Profile Rule')).toBeVisible();
  });

  test('删除 Profile 中的资源后，资源不应在 Profile 中显示', async ({ page }) => {
    const profile = await apiPost('/profiles', { name: 'Removal Test' });
    const skill = await apiPost('/skills', { name: 'Removable Skill', content: 'content' });
    await fetch(`http://localhost:3000/api/profiles/${profile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Removal Test',
        skills: [{ resourceId: skill.id, order: 0 }],
        mcps: [],
        rules: []
      })
    });

    await page.goto(`/profiles/${profile.id}/edit`);
    await expect(page.getByText('Removable Skill')).toBeVisible();

    // 移除绑定后保存(清空 skills)
    await fetch(`http://localhost:3000/api/profiles/${profile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Removal Test',
        skills: [],
        mcps: [],
        rules: []
      })
    });

    await page.reload();
    await expect(page.getByText('Removable Skill')).not.toBeVisible();
  });
});
