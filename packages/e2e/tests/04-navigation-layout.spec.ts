import { test, expect, type Page } from '@playwright/test';
import { apiPost } from './helpers';

async function openSidebar(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.locator('header button').first().click();
    // Wait for the drawer dialog to become visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  }
  return page.locator('aside, [role="complementary"]').or(page.locator('[role="dialog"]')).first();
}

/**
 * 导航与布局 — 验证应用整体结构
 *
 * 不依赖预置数据，只验证 UI 结构和导航行为。
 * 有错误直接暴露，不做超时重试。
 */
test.describe('全局导航结构', () => {
  test('侧边栏应有 Projects 和资源库入口', async ({ page, isMobile }) => {
    await page.goto('/');

    const sidebar = await openSidebar(page, isMobile);

    await expect(sidebar.getByRole('button', { name: 'Projects' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /资源库/i })).toBeVisible();
  });

  test('点击资源库应跳转并展开子导航', async ({ page, isMobile }) => {
    await page.goto('/');

    const sidebar = await openSidebar(page, isMobile);

    await sidebar.getByRole('button', { name: /资源库/i }).click();
    await page.waitForURL(/\/(skills|mcps|rules|profiles|agent-runners)/);

    // On mobile, the sidebar stays open after expanding sub-nav (it's not a navigation)
    // Actually, if it navigated to /skills automatically (first item), the sidebar might close on mobile!
    // So we need to re-open it to check subItems.
    const newSidebar = await openSidebar(page, isMobile);
    
    const subItems = ['Skills', 'MCPs', 'Rules', 'Profiles', 'Runners'];
    for (const item of subItems) {
      await expect(
        newSidebar.getByRole('button', { name: item, exact: true })
      ).toBeVisible();
    }
  });

  test('点击资源子菜单应切到对应页面', async ({ page, isMobile }) => {
    await page.goto('/skills');

    let sidebar = await openSidebar(page, isMobile);

    await sidebar.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(page).toHaveURL(/\/rules/);

    sidebar = await openSidebar(page, isMobile);
    await sidebar.getByRole('button', { name: 'MCPs', exact: true }).click();
    await expect(page).toHaveURL(/\/mcps/);

    sidebar = await openSidebar(page, isMobile);
    await sidebar.getByRole('button', { name: 'Profiles', exact: true }).click();
    await expect(page).toHaveURL(/\/profiles/);

    sidebar = await openSidebar(page, isMobile);
    await sidebar.getByRole('button', { name: 'Runners', exact: true }).click();
    await expect(page).toHaveURL(/\/agent-runners/);

    sidebar = await openSidebar(page, isMobile);
    await sidebar.getByRole('button', { name: 'Skills', exact: true }).click();
    await expect(page).toHaveURL(/\/skills/);
  });

  test('点击 Projects 应回到项目列表', async ({ page, isMobile }) => {
    await page.goto('/skills');

    const sidebar = await openSidebar(page, isMobile);
    await sidebar.getByRole('button', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects/);
  });
});

test.describe('页面加载', () => {
  test('每个主要页面应在 5 秒内完成加载', async ({ page }) => {
    const routes = [
      '/projects',
      '/skills',
      '/rules',
      '/mcps',
      '/profiles',
      '/agent-runners'
    ];

    for (const route of routes) {
      const start = Date.now();
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5000);

      const bodyText = await page.locator('body').textContent();
      expect(bodyText!.length).toBeGreaterThan(0);
    }
  });

  test('默认首页应跳转到 Projects', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/projects/);
  });
});

test.describe('资源列表页通用行为', () => {
  // 先通过 API 确保有数据
  test.beforeAll(async () => {
    await apiPost('/skills', {
      name: 'Nav Test Skill',
      content: 'content for nav test'
    });
    await apiPost('/mcps', {
      name: 'Nav Test MCP',
      content: { type: 'stdio', command: 'node', args: [] }
    });
    await apiPost('/rules', {
      name: 'Nav Test Rule',
      content: 'some rule'
    });
  });

  test('Skills 列表页应有搜索框和新建按钮', async ({ page }) => {
    await page.goto('/skills');

    await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /新建 Skill/i })
    ).toBeVisible();
  });

  test('MCPs 列表页应有搜索框和新建按钮', async ({ page }) => {
    await page.goto('/mcps');

    await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /新建 MCP/i })).toBeVisible();
  });

  test('Rules 列表页应有搜索框和新建按钮', async ({ page }) => {
    await page.goto('/rules');

    await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /新建 Rule/i })
    ).toBeVisible();
  });

  test('每个列表项应有编辑和删除操作', async ({ page }) => {
    await page.goto('/skills');

    // 应有列表项（至少 Nav Test Skill）
    await expect(page.getByText('Nav Test Skill')).toBeVisible();

    // 列表项应有编辑和删除按钮
    const editBtns = page.getByRole('button', { name: /编辑 Nav Test Skill/i });
    const deleteBtns = page.getByRole('button', { name: /删除 Nav Test Skill/i });

    const editCount = await editBtns.count();
    const deleteCount = await deleteBtns.count();

    expect(editCount).toBeGreaterThan(0);
    expect(editCount).toBe(deleteCount);
  });
});

test.describe('删除保护', () => {
  test('点击删除按钮应出现确认对话框', async ({ page }) => {
    await page.goto('/skills');

    // 确保有可删除的项
    await expect(
      page.getByRole('button', { name: /删除/i }).first()
    ).toBeVisible();

    // 点击第一个删除按钮
    await page.getByRole('button', { name: /删除/i }).first().click();

    // 用户应看到确认对话框，防止误删
    const confirmDialog = page
      .getByRole('alertdialog')
      .or(page.getByRole('dialog'));
    await expect(confirmDialog).toBeVisible();
  });
});
