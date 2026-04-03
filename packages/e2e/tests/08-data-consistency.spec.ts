import { test, expect } from '@playwright/test';
import {
  cleanupTestData,
  apiPost,
  seedProject,
  seedMockRunner
} from './helpers';

/**
 * 跨页面数据一致性
 *
 * 用户期望：
 * - 修改资源名称后，引用它的 Profile 中名称也要更新
 * - 删除资源后，列表不应残留旧数据
 * - 创建的资源立即在所有相关页面可见
 */
test.describe('跨页面数据一致性', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('新创建的 Skill 应立即在列表中可见', async ({ page }) => {
    await apiPost('/skills', { name: 'Fresh Skill', content: 'fresh content' });

    await page.goto('/skills');
    await expect(page.getByText('Fresh Skill')).toBeVisible();
  });

  test('通过 API 修改 Skill 名称后，刷新页面应展示新名称', async ({ page }) => {
    const skill = await apiPost('/skills', {
      name: 'Old Name Skill',
      content: 'content'
    });

    await page.goto('/skills');
    await expect(page.getByText('Old Name Skill')).toBeVisible();

    // 通过 API 修改名称
    await fetch(`http://localhost:3000/api/skills/${skill.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name Skill' })
    });

    await page.reload();
    await expect(page.getByText('New Name Skill')).toBeVisible();
    await expect(page.getByText('Old Name Skill')).not.toBeVisible();
  });

  test('通过 API 删除 Skill 后，刷新页面不应再显示', async ({ page }) => {
    const skill = await apiPost('/skills', {
      name: 'Temporary Skill',
      content: 'content'
    });

    await page.goto('/skills');
    await expect(page.getByText('Temporary Skill')).toBeVisible();

    await fetch(`http://localhost:3000/api/skills/${skill.id}`, {
      method: 'DELETE'
    });

    await page.reload();
    await expect(page.getByText('Temporary Skill')).not.toBeVisible();
  });

  test('Profile 中关联的资源名称应与资源列表一致', async ({ page }) => {
    const skill = await apiPost('/skills', {
      name: 'Consistent Skill',
      content: 'content'
    });
    const profile = await apiPost('/profiles', { name: 'Consistency Check' });
    await fetch(`http://localhost:3000/api/profiles/${profile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Consistency Check',
        skills: [{ resourceId: skill.id, order: 0 }],
        mcps: [],
        rules: []
      })
    });

    // Skills 列表中的名称
    await page.goto('/skills');
    await expect(page.getByText('Consistent Skill')).toBeVisible();

    // Profile 编辑页中的名称应一致
    await page.goto(`/profiles/${profile.id}/edit`);
    await expect(page.getByText('Consistent Skill')).toBeVisible();
  });
});

test.describe('多资源类型交叉验证', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Skills/Rules/MCPs/Runners 列表页结构应一致（有搜索框和新建按钮）', async ({
    page
  }) => {
    // Profiles 空状态只有新建按钮无搜索框，属正确行为，单独处理
    const routes = ['/skills', '/rules', '/mcps', '/agent-runners'];

    for (const route of routes) {
      await page.goto(route);

      // 每个列表页都应有搜索框
      await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();

      // 每个列表页都应有新建按钮
      await expect(page.getByRole('button', { name: /新建/i })).toBeVisible();
    }
  });

  test('Profiles 列表页空状态应有新建入口', async ({ page }) => {
    await page.goto('/profiles');
    await expect(page.getByRole('button', { name: /新建/i })).toBeVisible();
  });

  test('所有资源编辑页应有返回按钮', async ({ page }) => {
    const skill = await apiPost('/skills', {
      name: 'Back Btn Skill',
      content: 'content'
    });
    const rule = await apiPost('/rules', {
      name: 'Back Btn Rule',
      content: 'content'
    });

    for (const path of [`/skills/${skill.id}/edit`, `/rules/${rule.id}/edit`]) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: /返回/i })).toBeVisible();
    }
  });

  test('编辑页返回按钮应回到列表页', async ({ page }) => {
    const skill = await apiPost('/skills', {
      name: 'Return Skill',
      content: 'content'
    });

    await page.goto(`/skills/${skill.id}/edit`);
    await page.getByRole('button', { name: /返回/i }).click();
    await expect(page).toHaveURL(/\/skills$/);
  });
});
