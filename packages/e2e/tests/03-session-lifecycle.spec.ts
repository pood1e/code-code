import { test, expect, type Page } from '@playwright/test';
import {
  cleanupTestData,
  seedProject,
  seedMockRunner,
  apiPost,
  apiDelete,
  type ApiRecord
} from './helpers';

/**
 * Chat 会话生命周期 — 用户最核心的使用路径
 *
 * 正确业务语义：
 * - 进入 Project → 看到会话入口
 * - chats 页面空状态有引导
 * - 可以创建 chat 并看到聊天界面
 * - 可以发送消息并看到回复
 *
 * 不做任何隐式等待，有问题直接暴露。
 */
test.describe('Chat 会话生命周期', () => {
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
    page,
    isMobile
  }) => {
    await page.goto('/projects');
    await page.getByText('Session Test Project').click();

    await expect(page).toHaveURL(`/projects/${project.id}/dashboard`);
    const navigation = await openProjectNavigation(page, isMobile);
    await expect(
      navigation.getByRole('button', { name: '会话' })
    ).toBeVisible();
    await expect(page.getByText('概览敬请期待')).toBeVisible();
  });

  test('chats 页面无数据时应有创建引导', async ({ page }) => {
    await page.goto(`/projects/${project.id}/chats`);

    // 用户期望：空状态下直接展示 chat 创建面板，包含发送按钮
    const createBtn = page
      .getByRole('button', { name: /send|发送/i })
      .first();
    await expect(createBtn).toBeVisible();
  });

  test('chats 页面应有 Runner 选择和创建会话的入口', async ({
    page
  }) => {
    await page.goto(`/projects/${project.id}/chats`);

    await expect(
      page.getByRole('combobox', { name: '选择 AgentRunner' })
    ).toHaveValue(String(runner.id));
    await expect(page.getByPlaceholder('输入首条消息...')).toBeVisible();
    await expect(
      page.getByRole('button', { name: '发送', exact: true })
    ).toBeVisible();
  });

  test('通过 API 创建的 chat 应在会话列表中可见', async ({ page }) => {
    const chat = await apiPost('/chats', {
      scopeId: project.id,
      runnerId: runner.id,
      title: 'API Chat',
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await page.goto(`/projects/${project.id}/chats`);

    await expect(page.getByRole('button', { name: 'API Chat' })).toBeVisible();
    await expect(page.getByRole('button', { name: '发送' }).first()).toBeVisible();

    // 清理
    await apiDelete(`/chats/${chat.id}`);
  });

  test('访问具体 chat 页应展示聊天界面', async ({ page }) => {
    const chat = await apiPost('/chats', {
      scopeId: project.id,
      runnerId: runner.id,
      title: 'Deep Linked Chat',
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await page.goto(`/projects/${project.id}/chats/${chat.id}`);

    await expect(
      page.getByRole('button', { name: 'Deep Linked Chat' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '发送' }).first()).toBeVisible();

    // 清理
    await apiDelete(`/chats/${chat.id}`);
  });

  test('删除当前 chat 后应跳到剩余的下一个 chat', async ({ page }) => {
    const firstChat = await apiPost('/chats', {
      scopeId: project.id,
      runnerId: runner.id,
      title: 'Chat Alpha',
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });
    const secondChat = await apiPost('/chats', {
      scopeId: project.id,
      runnerId: runner.id,
      title: 'Chat Beta',
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await page.goto(`/projects/${project.id}/chats/${firstChat.id}`);

    await page.getByRole('button', { name: 'Chat Alpha' }).click();
    await page.getByRole('button', { name: '删除会话 Chat Alpha' }).click();

    await expect(page).toHaveURL(`/projects/${project.id}/chats/${secondChat.id}`);
    await expect(page.getByRole('button', { name: 'Chat Beta' })).toBeVisible();

    await apiDelete(`/chats/${secondChat.id}`);
  });

  test('访问不存在的项目 chats 页应有合理反馈', async ({ page }) => {
    await page.goto('/projects/nonexistent-id/chats');

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
    page,
    isMobile
  }) => {
    await page.goto(`/projects/${project.id}/dashboard`);

    const projectNavigation = (await openProjectNavigation(page, isMobile))
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

async function openProjectNavigation(page: Page, isMobile: boolean) {
  if (!isMobile) {
    return page.getByRole('complementary');
  }

  await page.getByRole('button', { name: '打开导航菜单' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}
