import { expect, test, type Page } from '@playwright/test';
import {
  API_BASE,
  apiGet,
  apiDelete,
  apiPost,
  seedMockRunner,
  seedProject,
  type ApiRecord
} from './helpers';

/**
 * Chat UI 交互测试
 *
 * 补全 03 未覆盖的 UI 路径：
 * - 聊天界面输入框与发送按钮
 * - 消息列表渲染（user / assistant 角色区分）
 * - 发送过程中的加载态
 * - Cancel 按钮出现与消失
 * - 多 session 切换
 * - Session 创建面板的 Runner 选择
 */

async function createChat(projectId: string, runnerId: string) {
  return apiPost('/chats', {
    scopeId: projectId,
    runnerId,
    skillIds: [],
    ruleIds: [],
    mcps: [],
    runnerSessionConfig: {}
  });
}

async function sendMessage(sessionId: string, prompt: string) {
  await apiPost(`/sessions/${sessionId}/messages`, {
    input: { prompt },
    runtimeConfig: {}
  });
  await waitForSessionStatus(sessionId, 'ready', 10_000);
}

/** 轮询等待 session 到达目标状态 */
async function waitForSessionStatus(
  sessionId: string,
  targetStatus: string,
  timeoutMs = 10_000
): Promise<ApiRecord> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    const body = (await res.json()) as { data: ApiRecord };
    if (body.data.status === targetStatus) return body.data;
    await new Promise((r) => setTimeout(r, 200));
  }
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  const body = (await res.json()) as { data: ApiRecord };
  throw new Error(
    `Session did not reach '${targetStatus}'. Current: ${String(body.data.status)}`
  );
}

async function scrollMessageLogToTop(page: Page) {
  const messageLog = page.getByRole('log', { name: '会话消息列表' });
  await messageLog.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
}

async function scrollMessageLogToBottom(page: Page) {
  const messageLog = page.getByRole('log', { name: '会话消息列表' });
  await messageLog.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
}

async function expectSessionPageReady(page: Page, runnerName: string) {
  await expect(page.getByRole('button', { name: runnerName })).toBeVisible();
}

async function expectMockAssistantReplyVisible(
  page: Page,
  prompt: string,
  timeout = 10_000
) {
  const messageLog = page.getByRole('log', { name: '会话消息列表' });
  await expect(
    messageLog.getByText(`收到输入：${prompt}`, { exact: true })
  ).toBeVisible({ timeout });
}

function getSessionId(chat: ApiRecord) {
  return String(chat.sessionId);
}

function getChatIdFromUrl(url: string) {
  const match = url.match(/\/projects\/[^/]+\/chats\/([^/?#]+)/);
  if (!match) {
    throw new Error(`Chat id not found in url: ${url}`);
  }

  return match[1];
}

async function waitForCurrentChatSessionReady(page: Page, timeoutMs = 10_000) {
  const chat = await apiGet(`/chats/${getChatIdFromUrl(page.url())}`);
  if (Array.isArray(chat)) {
    throw new Error('Expected single chat detail response');
  }

  await waitForSessionStatus(String(chat.sessionId), 'ready', timeoutMs);
  return chat;
}

async function cleanupChat(chatId: string) {
  await apiDelete(`/chats/${chatId}`, { ignoreNotFound: true });
}

type ChatUiContext = {
  project: ApiRecord;
  runner: ApiRecord;
  createChat: (runnerId?: string) => Promise<ApiRecord>;
  createRunner: (name?: string) => Promise<ApiRecord>;
  cleanup: () => Promise<void>;
};

function buildTestResourceSuffix(testTitle: string) {
  return testTitle
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .slice(0, 36);
}

async function createChatUiContext(
  projectPrefix: string,
  testTitle: string
): Promise<ChatUiContext> {
  const suffix = buildTestResourceSuffix(testTitle);
  const project = await seedProject(`${projectPrefix} ${suffix}`);
  const runner = await seedMockRunner(`E2E Mock Runner ${suffix}`);
  const createdChatIds: string[] = [];
  const createdRunnerIds = [runner.id];

  return {
    project,
    runner,
    createChat: async (runnerId = runner.id) => {
      const chat = await createChat(project.id, runnerId);
      createdChatIds.push(chat.id);
      return chat;
    },
    createRunner: async (name?: string) => {
      const nextRunner = await seedMockRunner(
        name ?? `E2E Extra Runner ${suffix} ${createdRunnerIds.length}`
      );
      createdRunnerIds.push(nextRunner.id);
      return nextRunner;
    },
    cleanup: async () => {
      const projectChats = await apiGet(`/chats?scopeId=${project.id}`);
      const remainingChatIds = Array.isArray(projectChats)
        ? projectChats.map((chat) => chat.id)
        : [];
      const chatIds = Array.from(
        new Set([...createdChatIds, ...remainingChatIds])
      ).reverse();

      for (const chatId of chatIds) {
        await cleanupChat(chatId);
      }

      for (const runnerId of [...createdRunnerIds].reverse()) {
        await apiDelete(`/agent-runners/${runnerId}`, {
          ignoreNotFound: true
        });
      }

      await apiDelete(`/projects/${project.id}`, {
        ignoreNotFound: true
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 聊天界面基础渲染
// ─────────────────────────────────────────────────────────────────────────────

test.describe('聊天界面基础渲染', () => {
  let context: ChatUiContext;

  test.beforeEach(async ({}, testInfo) => {
    context = await createChatUiContext('Chat UI Test Project', testInfo.title);
  });

  test.afterEach(async () => {
    await context?.cleanup();
  });

  test('进入 Session 页面应展示消息输入框', async ({ page }) => {
    const chat = await context.createChat();
    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);
    await expectSessionPageReady(page, context.runner.name as string);

    const textarea = page.getByRole('textbox');
    await expect(textarea.first()).toBeVisible();
  });

  test('进入 Session 页面应展示发送按钮', async ({ page }) => {
    const chat = await context.createChat();
    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);
    await expectSessionPageReady(page, context.runner.name as string);

    const sendBtn = page.getByRole('button', { name: '发送', exact: true });
    await expect(sendBtn.first()).toBeVisible();
  });

  test('Session 页面不应展示空白内容区', async ({ page }) => {
    const chat = await context.createChat();
    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);

    await expectSessionPageReady(page, context.runner.name as string);
    await expect(
      page.getByRole('button', { name: '发送', exact: true }).first()
    ).toBeVisible();
  });

  test('已有消息的 Session 应在页面上展示消息记录', async ({ page }) => {
    const chat = await context.createChat();
    await sendMessage(getSessionId(chat), 'Hello from UI test');

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);
    await expectSessionPageReady(page, context.runner.name as string);

    await expect(page.getByText('Hello from UI test').first()).toBeVisible();
    await expectMockAssistantReplyVisible(page, 'Hello from UI test');
  });

  test('消息会话中 user 和 assistant 消息应能在页面上区分', async ({ page }) => {
    const chat = await context.createChat();
    await sendMessage(getSessionId(chat), 'Role separation message');

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);
    await expectSessionPageReady(page, context.runner.name as string);

    const messageLog = page.getByRole('log', { name: '会话消息列表' });
    await expect(messageLog.getByText('You').first()).toBeVisible();
    await expect(
      messageLog.getByText(context.runner.name as string).first()
    ).toBeVisible();
    await expect(
      page.getByText('Role separation message', { exact: true })
    ).toBeVisible();
    await expectMockAssistantReplyVisible(page, 'Role separation message');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 发送消息交互
// ─────────────────────────────────────────────────────────────────────────────

test.describe('发送消息交互', () => {
  let context: ChatUiContext;

  test.beforeEach(async ({}, testInfo) => {
    context = await createChatUiContext('Send Interaction Project', testInfo.title);
  });

  test.afterEach(async () => {
    await context?.cleanup();
  });

  test('在输入框输入内容后点击发送，应在消息列表中看到该内容', async ({
    page
  }) => {
    const chat = await context.createChat();

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);

    const textarea = page.getByRole('textbox').first();
    await textarea.fill('My E2E test message via UI');

    const sendBtn = page
      .getByRole('button', { name: '发送', exact: true })
      .first();
    await sendBtn.click();

    await expect(
      page.getByText('My E2E test message via UI').first()
    ).toBeVisible({ timeout: 10_000 });

    await waitForSessionStatus(getSessionId(chat), 'ready', 10_000);
  });

  test('发送消息后应看到 assistant 的回复出现在页面上', async ({ page }) => {
    const chat = await context.createChat();

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);
    await expectSessionPageReady(page, context.runner.name as string);

    const textarea = page.getByRole('textbox').first();
    await textarea.fill('Please respond');

    const sendBtn = page
      .getByRole('button', { name: '发送', exact: true })
      .first();
    await sendBtn.click();

    await waitForSessionStatus(getSessionId(chat), 'ready', 10_000);
    await expectMockAssistantReplyVisible(page, 'Please respond');
  });

  test('输入框为空时点击发送应不产生新消息', async ({ page }) => {
    const chat = await context.createChat();

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);

    const textarea = page.getByRole('textbox').first();
    await textarea.fill('');

    const sendBtn = page
      .getByRole('button', { name: '发送', exact: true })
      .first();
    await expect(sendBtn).toBeDisabled();
    await expect(page.getByText('You')).toHaveCount(0);
  });

  test('同一会话连续发送三条消息不应白屏、不丢历史、且不触发错误边界', async ({
    page
  }) => {
    const chat = await context.createChat();

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);

    const textarea = page.getByRole('textbox').first();
    const sendBtn = page
      .getByRole('button', { name: '发送', exact: true })
      .first();

    for (const prompt of ['First message', 'Second message', 'Third message']) {
      await textarea.fill(prompt);
      await sendBtn.click();

      await expect(page.getByText('Something went wrong')).not.toBeVisible();
      await expect(page.getByText('开始对话')).not.toBeVisible();
      await expect(
        page.getByText(prompt, { exact: true }).first()
      ).toBeVisible();
      await waitForSessionStatus(getSessionId(chat), 'ready', 10_000);
      await expectMockAssistantReplyVisible(page, prompt);
    }

    await scrollMessageLogToTop(page);
    await expect(
      page.getByText('First message', { exact: true }).first()
    ).toBeVisible();

    await scrollMessageLogToBottom(page);
    await expect(
      page.getByText('Third message', { exact: true }).first()
    ).toBeVisible();
  });

  test('使用 Mock Runner 连续发送 10 条消息应全部回显且页面不崩溃', async ({
    page
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    const chat = await context.createChat();
    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);

    const textarea = page.getByRole('textbox').first();
    const sendBtn = page
      .getByRole('button', { name: '发送', exact: true })
      .first();
    const prompts = Array.from(
      { length: 10 },
      (_, index) => `Mock burst message ${index + 1}`
    );

    for (const prompt of prompts) {
      await textarea.fill(prompt);
      await sendBtn.click();

      await expect(page.getByText('Something went wrong')).not.toBeVisible();
      await expect(
        page.getByText(prompt, { exact: true }).first()
      ).toBeVisible({ timeout: 10_000 });
      await waitForSessionStatus(getSessionId(chat), 'ready', 10_000);
      await expectMockAssistantReplyVisible(page, prompt);
    }

    await scrollMessageLogToTop(page);
    await expect(
      page.getByText(prompts[0], { exact: true }).first()
    ).toBeVisible();
    await expectMockAssistantReplyVisible(page, prompts[0]);

    await scrollMessageLogToBottom(page);
    await expect(
      page.getByText(prompts[9], { exact: true }).first()
    ).toBeVisible();
    await expectMockAssistantReplyVisible(page, prompts[9]);

    expect(
      pageErrors.filter((message) => message.includes('tapClientLookup'))
    ).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 多 Session 切换
// ─────────────────────────────────────────────────────────────────────────────

test.describe('多 Session 切换', () => {
  let context: ChatUiContext;

  test.beforeEach(async ({}, testInfo) => {
    context = await createChatUiContext(
      'Multi Session Switch Project',
      testInfo.title
    );
  });

  test.afterEach(async () => {
    await context?.cleanup();
  });

  test('Sessions 列表中应展示所有已创建的 session', async ({ page }) => {
    const runnerA = await context.createRunner('Session A Runner');
    const runnerB = await context.createRunner('Session B Runner');
    const chatA = await context.createChat(runnerA.id);
    const chatB = await context.createChat(runnerB.id);

    await page.goto(`/projects/${context.project.id}/chats/${chatA.id}`);

    await page.getByRole('button', { name: 'Session A Runner' }).click();
    await expect(
      page.getByRole('button', { name: /^Session A Runner/ }).last()
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Session B Runner/ }).last()
    ).toBeVisible();
  });

  test('新建会话入口应在 header action，不应再出现在会话下拉列表里', async ({
    page
  }) => {
    const chat = await context.createChat();
    const newChatButton = page.getByRole('button', {
      name: '新建会话',
      exact: true
    });

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);

    await expect(newChatButton).toBeVisible();
    await page.getByRole('button', { name: context.runner.name }).click();
    await expect(newChatButton).toHaveCount(1);
  });

  test('从 session A 切换到 session B 应展示 B 的消息内容', async ({
    page
  }) => {
    const chatA = await context.createChat();
    const chatB = await context.createChat();

    await sendMessage(getSessionId(chatA), 'Message unique to session A');
    await sendMessage(getSessionId(chatB), 'Message unique to session B');

    await page.goto(`/projects/${context.project.id}/chats/${chatA.id}`);
    await expect(
      page.getByText('Message unique to session A').first()
    ).toBeVisible({ timeout: 10_000 });

    await page.goto(`/projects/${context.project.id}/chats/${chatB.id}`);
    await expect(
      page.getByText('Message unique to session B').first()
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText('Message unique to session A').first()
    ).not.toBeVisible();
  });

  test('刷新 session 页面应保留消息历史', async ({ page }) => {
    const chat = await context.createChat();
    await sendMessage(getSessionId(chat), 'Persistent message after reload');

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);
    await expect(
      page.getByText('Persistent message after reload', { exact: true })
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByText('Persistent message after reload', { exact: true })
    ).toBeVisible();
  });

  test('历史消息首屏未加载完成前应禁用发送，加载完成后可继续发送且不触发 tapClientLookup', async ({
    page
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    const chat = await context.createChat();
    await sendMessage(getSessionId(chat), 'First turn before slow history load');

    let releaseInitialMessagesRequest!: () => void;
    const initialMessagesRequestBlocker = new Promise<void>((resolve) => {
      releaseInitialMessagesRequest = resolve;
    });
    let initialMessagesRequestDelayed = false;

    await page.route(`**/api/sessions/${getSessionId(chat)}/messages**`, async (route) => {
      if (
        route.request().method() !== 'GET' ||
        initialMessagesRequestDelayed
      ) {
        await route.continue();
        return;
      }

      initialMessagesRequestDelayed = true;
      await initialMessagesRequestBlocker;
      await route.continue();
    });

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);

    await expect(
      page.getByRole('paragraph').filter({
        hasText: '正在加载历史消息...'
      })
    ).toBeVisible();
    await expect(page.getByText('开始对话')).not.toBeVisible();

    const sendBtn = page
      .getByRole('button', { name: '发送', exact: true })
      .first();
    await expect(sendBtn).toBeDisabled();

    const textarea = page.getByRole('textbox').first();
    await expect(textarea).toBeDisabled();

    releaseInitialMessagesRequest();

    await expect(
      page.getByText('First turn before slow history load', { exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('First turn before slow history load', { exact: true })
    ).toBeVisible();
    await expectMockAssistantReplyVisible(
      page,
      'First turn before slow history load'
    );

    await textarea.fill('Second turn after history ready');
    await sendBtn.click();

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
    await waitForSessionStatus(getSessionId(chat), 'ready', 10_000);
    await scrollMessageLogToBottom(page);
    await expectMockAssistantReplyVisible(
      page,
      'Second turn after history ready'
    );

    expect(
      pageErrors.filter((message) => message.includes('tapClientLookup'))
    ).toHaveLength(0);
  });

  test('离开会话页后重新进入，应保留两轮历史并可继续发送', async ({ page }) => {
    const chat = await context.createChat();
    await sendMessage(getSessionId(chat), 'First turn before leaving');
    await sendMessage(getSessionId(chat), 'Second turn before leaving');

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);
    await expect(
      page.getByText('Second turn before leaving', { exact: true })
    ).toBeVisible();
    await scrollMessageLogToTop(page);
    await expect(
      page.getByText('First turn before leaving', { exact: true })
    ).toBeVisible();

    await page.goto(`/projects/${context.project.id}/config`);
    await expect(page.getByText('Project 配置')).toBeVisible();

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);
    await expect(
      page.getByText('Second turn before leaving', { exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await scrollMessageLogToTop(page);
    await expect(
      page.getByText('First turn before leaving', { exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await expectMockAssistantReplyVisible(page, 'Second turn before leaving');
    await scrollMessageLogToBottom(page);
    await expectMockAssistantReplyVisible(page, 'Second turn before leaving');

    const textarea = page.getByRole('textbox').first();
    await textarea.fill('Third turn after re-enter');
    await page
      .getByRole('button', { name: '发送', exact: true })
      .first()
      .click();

    await expect(page.getByText('Request failed')).not.toBeVisible();
    await waitForSessionStatus(getSessionId(chat), 'ready', 10_000);
    await scrollMessageLogToBottom(page);
    await expectMockAssistantReplyVisible(page, 'Third turn after re-enter', 10_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session 创建面板
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Session 创建面板', () => {
  let context: ChatUiContext;

  test.beforeEach(async ({}, testInfo) => {
    context = await createChatUiContext('Create Panel Test Project', testInfo.title);
  });

  test.afterEach(async () => {
    await context?.cleanup();
  });

  test('进入空 Sessions 页面应展示创建面板（含发送按钮）', async ({ page }) => {
    await page.goto(`/projects/${context.project.id}/chats`);

    await expect(page.getByPlaceholder('输入首条消息...')).toBeVisible();
    const sendBtn = page
      .getByRole('button', { name: '发送', exact: true })
      .first();
    await expect(sendBtn).toBeVisible();
  });

  test('创建面板应列出可选择的 Runner', async ({ page }) => {
    await page.goto(`/projects/${context.project.id}/chats`);
    await expect(page.getByPlaceholder('输入首条消息...')).toBeVisible();

    await expect(
      page.getByRole('combobox', { name: '选择 AgentRunner' })
    ).toHaveValue(String(context.runner.id));
  });

  test('在创建面板输入消息并发送，应创建 chat 并跳转到 chat 页面', async ({
    page
  }) => {
    await page.goto(`/projects/${context.project.id}/chats`);

    const textarea = page.getByPlaceholder('输入首条消息...');
    await textarea.fill('Create me a session via UI');

    const sendBtn = page
      .getByRole('button', { name: '发送', exact: true })
      .first();
    await sendBtn.click();

    // 用户期望：发送后跳转到 /projects/:id/chats/:chatId
    await page.waitForURL(/\/projects\/.+\/chats\/.+/, { timeout: 10_000 });
    const url = page.url();
    expect(url).toMatch(/\/projects\/.+\/chats\/.+/);
    await waitForCurrentChatSessionReady(page);

    await expect(page.getByText('Create me a session via UI').first()).toBeVisible({
      timeout: 10_000
    });
  });

  test('新建会话时顶部应保留会话选择入口，并可切回旧会话', async ({
    page
  }) => {
    const existingChat = await context.createChat();
    const newChatButton = page.getByRole('button', {
      name: '新建会话',
      exact: true
    });
    await sendMessage(getSessionId(existingChat), 'Message before opening create panel');

    await page.goto(`/projects/${context.project.id}/chats/${existingChat.id}`);
    await newChatButton.click();

    await expect(page).toHaveURL(`/projects/${context.project.id}/chats`);
    await expect(newChatButton).toBeVisible();
    await expect(page.getByPlaceholder('输入首条消息...')).toBeVisible();

    await newChatButton.click();
    await page
      .getByRole('button', { name: new RegExp(`^${context.runner.name}`) })
      .last()
      .click();

    await expect(page).toHaveURL(
      `/projects/${context.project.id}/chats/${existingChat.id}`
    );
    await expect(
      page.getByText('Message before opening create panel', { exact: true })
    ).toBeVisible();
  });

  test('在创建面板输入消息后按 Enter 应直接创建 Session，Shift+Enter 仅换行', async ({
    page
  }) => {
    await page.goto(`/projects/${context.project.id}/chats`);

    const textarea = page.getByPlaceholder('输入首条消息...');
    await textarea.fill('Line 1');
    await textarea.press('Shift+Enter');
    await textarea.type('Line 2');

    await expect(textarea).toHaveValue('Line 1\nLine 2');
    await page.keyboard.press('Enter');

    await page.waitForURL(/\/projects\/.+\/chats\/.+/, { timeout: 10_000 });
    await waitForCurrentChatSessionReady(page);
    await expect(page.getByText('Line 1').first()).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByText('Line 2').first()).toBeVisible({
      timeout: 10_000
    });
  });
});

test.describe('Session 销毁交互', () => {
  let context: ChatUiContext;

  test.beforeEach(async ({}, testInfo) => {
    context = await createChatUiContext('Dispose UI Project', testInfo.title);
  });

  test.afterEach(async () => {
    await context?.cleanup();
  });

  test('销毁当前 session 后应回到空会话创建面板', async ({ page }) => {
    const chat = await context.createChat();

    await page.goto(`/projects/${context.project.id}/chats/${chat.id}`);
    await page.getByRole('button', { name: context.runner.name }).click();
    await page
      .getByRole('button', { name: `删除会话 ${context.runner.name}` })
      .click();

    await expect(page).toHaveURL(
      `/projects/${context.project.id}/chats`,
      { timeout: 10_000 }
    );
    await expect(page.getByPlaceholder('输入首条消息...')).toBeVisible();
  });

  test('从列表删除非当前 session 不应打断当前会话', async ({ page }) => {
    const currentChat = await context.createChat();
    const disposableRunner = await context.createRunner(
      'Disposable Session Runner'
    );
    await context.createChat(disposableRunner.id);

    await sendMessage(getSessionId(currentChat), 'Current session should stay');

    await page.goto(
      `/projects/${context.project.id}/chats/${currentChat.id}`
    );
    await expect(
      page.getByText('Current session should stay', { exact: true })
    ).toBeVisible();

    await page.getByRole('button', { name: context.runner.name }).click();
    await page
      .getByRole('button', { name: `删除会话 ${disposableRunner.name}` })
      .click();

    await expect(
      page.getByRole('button', {
        name: `删除会话 ${disposableRunner.name}`
      })
    ).toHaveCount(0);
    await expect(page).toHaveURL(
      `/projects/${context.project.id}/chats/${currentChat.id}`
    );
    await expect(
      page.getByText('Current session should stay', { exact: true })
    ).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 错误场景
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Chat 页面错误场景', () => {
  let context: ChatUiContext;

  test.beforeEach(async ({}, testInfo) => {
    context = await createChatUiContext(
      'Error Scenario Project',
      testInfo.title
    );
  });

  test.afterEach(async () => {
    await context?.cleanup();
  });

  test('访问不存在的 chat 页面应有合理反馈而非白屏', async ({ page }) => {
    await page.goto(`/projects/${context.project.id}/chats/nonexistent-chat-id`);

    await expect(page).toHaveURL(`/projects/${context.project.id}/chats`);
    await expect(page.getByPlaceholder('输入首条消息...')).toBeVisible();
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('访问不存在项目的 chats 页应有合理反馈', async ({ page }) => {
    await page.goto('/projects/nonexistent-project-id/chats');

    await expect(
      page.getByRole('heading', { name: 'Project 不存在' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '返回 Projects' })).toBeVisible();
  });

  test('chat 页面快速导航不应产生 hydration 类 console error', async ({
    page
  }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`/projects/${context.project.id}/chats`);
    await page.goto(`/projects/${context.project.id}/chats`);

    // 导航不应产生 hydration 或 uncaught 类 console error
    const criticalErrors = errors.filter(
      (e) =>
        e.includes('Hydration') ||
        e.includes('Uncaught') ||
        e.includes('Cannot read')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
