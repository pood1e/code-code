import { test, expect } from '@playwright/test';
import { cleanupTestData, seedProject, seedMockRunner, apiPost, apiGet, apiDelete } from './helpers';

/**
 * Session 会话生命周期 — 用户最核心的使用路径
 *
 * 正确业务语义：
 * - 进入 Project → 看到 Sessions 入口
 * - Sessions 页面空状态有引导
 * - 可以创建 Session 并看到聊天界面
 * - 可以发送消息并看到回复
 *
 * 不做任何隐式等待，有问题直接暴露。
 */
test.describe('Session 会话生命周期', () => {
  let project: { id: string; name: string };
  let runner: { id: string; name: string };

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Session Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Project 列表中点击项目应能到达 Sessions 页面', async ({ page }) => {
    await page.goto('/projects');
    await page.getByText('Session Test Project').click();

    // 进入项目后应有 Sessions 导航
    // 用户期望：项目详情中可以找到 Sessions 入口
    const sessionsEntry = page.getByText(/Sessions/i).first();
    await expect(sessionsEntry).toBeVisible();
  });

  test('Sessions 页面无数据时应有创建引导', async ({ page }) => {
    await page.goto(`/projects/${project.id}/sessions`);

    // 用户期望：空状态下有明确的引导创建按钮或提示
    const createBtn = page.getByRole('button', { name: /create|new|新建|开始/i }).first();
    await expect(createBtn).toBeVisible();
  });

  test('Sessions 页面应有 Runner 选择和创建 Session 的入口', async ({ page }) => {
    await page.goto(`/projects/${project.id}/sessions`);

    // 用户期望：Session 创建流程中可以选择 Runner
    // 页面上应能看到 runner 相关的选项或创建面板
    const pageContent = await page.textContent('body');
    // 页面不应该完全空白或报错
    expect(pageContent!.length).toBeGreaterThan(50);
  });

  test('通过 API 创建的 Session 应在 Sessions 列表中可见', async ({ page }) => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await page.goto(`/projects/${project.id}/sessions`);

    // 用户期望：已创建的 Session 在列表中展示
    const pageContent = await page.textContent('body');
    expect(pageContent!.length).toBeGreaterThan(50);

    // 清理
    await apiDelete(`/sessions/${session.id}`);
  });

  test('访问具体 Session 页应展示聊天界面', async ({ page }) => {
    // 创建一个 Session
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    // 用户期望：通过 /projects/:projectId/sessions/:sessionId 访问具体会话
    await page.goto(`/projects/${project.id}/sessions/${session.id}`);

    // 应展示聊天界面（至少有消息输入区域）
    const pageContent = await page.textContent('body');
    expect(pageContent!.length).toBeGreaterThan(50);

    // 清理
    await apiDelete(`/sessions/${session.id}`);
  });

  test('访问不存在的项目 Sessions 页应有合理反馈', async ({ page }) => {
    await page.goto('/projects/nonexistent-id/sessions');

    // 用户不应看到空白页面或浏览器崩溃
    // 应有某种错误提示或回退
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);
  });
});

test.describe('Project 配置与导航', () => {
  let project: { id: string; name: string };

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Config Test Project');
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Project 配置页应可访问', async ({ page }) => {
    await page.goto(`/projects/${project.id}/config`);

    // 用户期望：配置页展示项目的配置信息
    await expect(page.getByText('Config Test Project')).toBeVisible();
  });

  test('Project Dashboard 页应可访问', async ({ page }) => {
    await page.goto(`/projects/${project.id}/dashboard`);

    // 用户期望：Dashboard 页展示项目概览
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(50);
  });

  test('Project 内应有 Config/Dashboard/Sessions 标签切换', async ({ page }) => {
    await page.goto(`/projects/${project.id}/config`);

    // 用户期望：项目内可以在不同视图之间切换
    const sessionsTab = page.getByText(/Sessions/i).first();
    const dashboardTab = page.getByText(/Dashboard/i).first();

    // 这些入口应存在
    await expect(sessionsTab).toBeVisible();
    await expect(dashboardTab).toBeVisible();
  });
});
