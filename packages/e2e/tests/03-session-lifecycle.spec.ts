import { test, expect } from '@playwright/test';
import {
  cleanupTestData,
  seedProject,
  seedMockRunner,
  apiPost,
  apiGet,
  apiDelete,
  type ApiRecord
} from './helpers';

/**
 * Session 会话生命周期 — 用户最核心的使用路径
 *
 * 正确业务语义：
 * - 进入 Project → 看到会话入口
 * - 会话页面空状态有引导
 * - 可以创建 Session 并看到聊天界面
 * - 可以发送消息并看到回复
 *
 * 不做任何隐式等待，有问题直接暴露。
 */
test.describe('Session 会话生命周期', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Session Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Project 列表中点击项目应能进入概览页，并可看到会话入口', async ({
    page
  }) => {
    await page.goto('/projects');
    await page.getByText('Session Test Project').click();

    await expect(page).toHaveURL(`/projects/${project.id}/dashboard`);
    await expect(page.getByText('会话').first()).toBeVisible();
    await expect(page.getByText('概览敬请期待')).toBeVisible();
  });

  test('会话页面无数据时应有创建引导', async ({ page }) => {
    await page.goto(`/projects/${project.id}/sessions`);

    // 用户期望：空状态下直接展示 Session 创建面板，包含发送按钮
    const createBtn = page
      .getByRole('button', { name: /send|发送/i })
      .first();
    await expect(createBtn).toBeVisible();
  });

  test('会话页面应有 Runner 选择和创建会话的入口', async ({
    page
  }) => {
    await page.goto(`/projects/${project.id}/sessions`);

    await expect(page.getByRole('combobox').nth(1)).toHaveValue(
      String(runner.id)
    );
    await expect(page.getByPlaceholder('发一条消息开始新会话')).toBeVisible();
    await expect(page.getByRole('button', { name: '发送' })).toBeVisible();
  });

  test('通过 API 创建的 Session 应在会话列表中可见', async ({ page }) => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await page.goto(`/projects/${project.id}/sessions`);

    await expect(page.getByRole('button', { name: runner.name })).toBeVisible();
    await expect(page.getByRole('button', { name: '发送' }).first()).toBeVisible();

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

    await expect(page.getByRole('button', { name: runner.name })).toBeVisible();
    await expect(page.getByRole('button', { name: '发送' }).first()).toBeVisible();

    // 清理
    await apiDelete(`/sessions/${session.id}`);
  });

  test('访问不存在的项目 Sessions 页应有合理反馈', async ({ page }) => {
    await page.goto('/projects/nonexistent-id/sessions');

    await expect(
      page.getByRole('heading', { name: 'Project 不存在' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '返回 Projects' })).toBeVisible();
  });
});

test.describe('Project 配置与导航', () => {
  let project: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Config Test Project');
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Project 配置页应可访问', async ({ page }) => {
    await page.goto(`/projects/${project.id}/config`);

    // 用户期望：配置页展示项目的配置信息 (配置页里有 Name 输入框)
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Config Test Project');
  });

  test('Project Dashboard 页应可访问', async ({ page }) => {
    await page.goto(`/projects/${project.id}/dashboard`);

    await expect(page.getByText('概览敬请期待')).toBeVisible();
    await expect(page.getByRole('button', { name: '前往配置页' })).toBeVisible();
  });

  test('Project 内应有 概览/会话/配置 入口切换，且 main 区不重复渲染 Project header', async ({
    page
  }) => {
    await page.goto(`/projects/${project.id}/dashboard`);

    const projectNavigation = page
      .getByRole('complementary')
      .getByRole('button')
      .filter({ hasText: /^(概览|会话|配置)$/ });
    const navigationLabels = await projectNavigation.allTextContents();

    expect(navigationLabels).toEqual(['概览', '会话', '配置']);
    await expect(
      page.getByRole('main').getByRole('combobox', {
        name: '选择当前 Project'
      })
    ).toHaveCount(0);
  });
});
