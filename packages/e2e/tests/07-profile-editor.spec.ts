import { test, expect } from '@playwright/test';
import { cleanupTestData, apiPost } from './helpers';

/**
 * Profile 编辑器完整流程
 *
 * 用户期望：
 * - Profile 编辑器可以添加/移除关联的 Skills、MCPs、Rules
 * - 保存后关联关系应持久化
 * - 编辑器应展示资源名称而非 ID
 * - 修改 Profile 名称后应在列表中更新
 */
test.describe('Profile 编辑器', () => {
  let skillId: string;
  let ruleId: string;
  let mcpId: string;
  let profileId: string;

  test.beforeAll(async () => {
    await cleanupTestData();

    const skill = await apiPost('/skills', { name: 'Editor Skill', content: 'content' });
    const rule = await apiPost('/rules', { name: 'Editor Rule', content: 'content' });
    const mcp = await apiPost('/mcps', {
      name: 'Editor MCP',
      content: { type: 'stdio', command: 'echo', args: ['test'] }
    });
    const profile = await apiPost('/profiles', { name: 'Editable Profile' });

    skillId = skill.id;
    ruleId = rule.id;
    mcpId = mcp.id;
    profileId = profile.id;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Profile 编辑页应有名称输入框', async ({ page }) => {
    await page.goto(`/profiles/${profileId}/edit`);
    const nameInput = page.getByRole('textbox', { name: /name|名称/i }).first();
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('Editable Profile');
  });

  test('Profile 编辑页应列出可选的 Skills、MCPs、Rules', async ({ page }) => {
    await page.goto(`/profiles/${profileId}/edit`);

    // 用户期望：Profile 编辑器中可以看到资源的添加入口
    // 应有 Skills/MCPs/Rules 分区或标签
    await expect(page.getByText(/Skills/i).first()).toBeVisible();
    await expect(page.getByText(/MCPs/i).first()).toBeVisible();
    await expect(page.getByText(/Rules/i).first()).toBeVisible();
  });

  test('通过 API 关联资源后，编辑页应展示资源名称', async ({ page }) => {
    // 通过 API 关联资源
    await fetch(`http://localhost:3000/api/profiles/${profileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Editable Profile',
        skills: [{ resourceId: skillId, order: 0 }],
        mcps: [{ resourceId: mcpId, order: 0 }],
        rules: [{ resourceId: ruleId, order: 0 }]
      })
    });

    await page.goto(`/profiles/${profileId}/edit`);

    // 用户应看到资源名称（而非 ID）
    await expect(page.getByText('Editor Skill')).toBeVisible();
    await expect(page.getByText('Editor MCP')).toBeVisible();
    await expect(page.getByText('Editor Rule')).toBeVisible();
  });

  test('修改 Profile 名称后保存应成功', async ({ page }) => {
    await page.goto(`/profiles/${profileId}/edit`);

    const nameInput = page.getByRole('textbox', { name: /name|名称/i }).first();
    await nameInput.clear();
    await nameInput.fill('Renamed Profile');

    await page.getByRole('button', { name: /保存/i }).click();

    // 保存成功后回到列表，应看到新名称
    await page.goto('/profiles');
    await expect(page.getByText('Renamed Profile')).toBeVisible();
  });
});

test.describe('Profile 导出与渲染', () => {
  let profileId: string;

  test.beforeAll(async () => {
    await cleanupTestData();
    const skill = await apiPost('/skills', { name: 'Export Skill', content: '# Exported skill' });
    const profile = await apiPost('/profiles', { name: 'Export Profile' });
    await fetch(`http://localhost:3000/api/profiles/${profile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Export Profile',
        skills: [{ resourceId: skill.id, order: 0 }],
        mcps: [],
        rules: []
      })
    });
    profileId = profile.id;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Profile 渲染 API 应返回完整数据', async ({ page }) => {
    const response = await page.request.get(
      `http://localhost:3000/api/profiles/${profileId}/render`
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.name).toBe('Export Profile');
    expect(body.data.skills).toHaveLength(1);
    expect(body.data.skills[0].content).toBeDefined();
  });

  test('Profile 导出 JSON 应包含关联资源内容', async ({ page }) => {
    const response = await page.request.get(
      `http://localhost:3000/api/profiles/${profileId}/export`
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.name).toBe('Export Profile');
    expect(body.skills).toBeDefined();
  });

  test('Profile 导出 YAML 应为有效格式', async ({ page }) => {
    const response = await page.request.get(
      `http://localhost:3000/api/profiles/${profileId}/export?format=yaml`
    );
    expect(response.status()).toBe(200);

    const text = await response.text();
    // YAML 应包含 name 字段
    expect(text).toContain('name:');
    expect(text).toContain('Export Profile');
  });
});
