import { test, expect } from '@playwright/test';
import {
  cleanupTestData,
  seedProject,
  seedMockRunner,
  apiPost,
  apiGet,
  apiDelete,
  API_BASE,
  type ApiRecord
} from './helpers';

/**
 * Chat Session REST API 完整覆盖
 *
 * 补全 03/10 未覆盖的业务路径：
 * - cancel：取消正在流式输出的消息
 * - reload：重新生成最后一次回复
 * - editMessage：编辑历史 user 消息并重跑 session
 * - initialMessage：创建 session 时一并发送第一条消息
 * - 消息分页：cursor + limit
 * - 并发锁：Running 期间再次发送应返回 409
 * - 边界/错误路径：404、400、无效 runnerId/scopeId
 */

/** 消息记录结构（来自 /sessions/:id/messages） */
interface MessageRecord {
  id: string;
  role: string;
  status: string;
  inputContent: Record<string, unknown> | null;
  outputText: string | null;
  errorPayload: {
    code: string;
    message: string;
    recoverable: boolean;
  } | null;
  cancelledAt: string | null;
}

/** 轮询等待 session.status 达到目标值 */
async function waitForSessionStatus(
  sessionId: string,
  targetStatus: string,
  timeoutMs = 10_000
): Promise<ApiRecord> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const session = await apiGet(`/sessions/${sessionId}`);
    if (!Array.isArray(session) && session.status === targetStatus) {
      return session;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const session = await apiGet(`/sessions/${sessionId}`);
  const status = Array.isArray(session) ? 'unknown' : String(session.status);
  throw new Error(
    `Session ${sessionId} did not reach status '${targetStatus}' within ${timeoutMs}ms. ` +
      `Current: ${status}`
  );
}

/** 轮询等待消息数量达到期望值 */
async function waitForMessageCount(
  sessionId: string,
  expectedCount: number,
  timeoutMs = 10_000
): Promise<MessageRecord[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
    const body = (await res.json()) as { data: { data: MessageRecord[] } };
    if (body.data.data.length >= expectedCount) return body.data.data;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
  const body = (await res.json()) as { data: { data: MessageRecord[] } };
  throw new Error(
    `Session ${sessionId} did not reach ${expectedCount} messages within ${timeoutMs}ms. ` +
      `Current count: ${body.data.data.length}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session 创建语义
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Session 创建语义', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('API Create Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('创建时 scopeId 不存在应返回 404', async () => {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopeId: 'nonexistent-project-id',
        runnerId: runner.id,
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      })
    });
    expect(res.status).toBe(404);
  });

  test('创建时 runnerId 不存在应返回 404', async () => {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopeId: project.id,
        runnerId: 'nonexistent-runner-id',
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      })
    });
    expect(res.status).toBe(404);
  });

  test('创建时 skillIds 包含不存在的 ID 应返回 404', async () => {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopeId: project.id,
        runnerId: runner.id,
        skillIds: ['nonexistent-skill-id'],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      })
    });
    expect(res.status).toBe(404);
  });

  test('创建时缺少必填字段 runnerId 应返回 400', async () => {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopeId: project.id,
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      })
    });
    expect(res.status).toBe(400);
  });

  test('创建时携带 initialMessage 应在 ready 后已产生 user+assistant 消息', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {},
      initialMessage: {
        input: { prompt: 'Hello from initial message' },
        runtimeConfig: {}
      }
    });

    const completed = await waitForSessionStatus(
      session.id,
      'ready',
      15_000
    );
    expect(completed.status).toBe('ready');

    const messages = await waitForMessageCount(session.id, 2, 15_000);
    const roles = messages.map((m) => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');

    const assistantMsg = messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.status).toBe('complete');

    await apiDelete(`/sessions/${session.id}`);
  });

  test('创建完成后 GET /sessions/:id 应返回正确的 detail 结构', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const detail = await apiGet(`/sessions/${session.id}`);
    expect(Array.isArray(detail)).toBe(false);
    if (!Array.isArray(detail)) {
      expect(detail.id).toBe(session.id);
      expect(detail.scopeId).toBe(project.id);
      expect(detail.runnerId).toBe(runner.id);
      expect(detail.status).toBe('ready');
      expect(detail.platformSessionConfig).toBeDefined();
      expect(detail.runnerSessionConfig).toBeDefined();
    }

    await apiDelete(`/sessions/${session.id}`);
  });

  test('GET /sessions?scopeId= 应仅返回该 project 的 sessions', async () => {
    const otherProject = await seedProject('Other Project for Isolation Test');

    const session1 = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });
    const session2 = await apiPost('/sessions', {
      scopeId: otherProject.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const list = await apiGet(`/sessions?scopeId=${project.id}`);
    const records = Array.isArray(list) ? list : [];
    const ids = records.map((s) => s.id);
    expect(ids).toContain(session1.id);
    expect(ids).not.toContain(session2.id);

    await apiDelete(`/sessions/${session1.id}`);
    await apiDelete(`/sessions/${session2.id}`);
    await apiDelete(`/projects/${otherProject.id}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 消息发送语义
// ─────────────────────────────────────────────────────────────────────────────

test.describe('消息发送语义', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Message Send Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('发送消息后 user 消息 inputContent 应包含 prompt 字段', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Check my input content' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);

    const messages = await waitForMessageCount(session.id, 2, 10_000);
    const userMsg = messages.find((m) => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg?.inputContent).toMatchObject({ prompt: 'Check my input content' });
    expect(userMsg?.status).toBe('sent');

    await apiDelete(`/sessions/${session.id}`);
  });

  test('assistant 消息完成后 outputText 不应为空', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Give me output text' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);

    const messages = await waitForMessageCount(session.id, 2, 10_000);
    const assistantMsg = messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.status).toBe('complete');
    expect(typeof assistantMsg?.outputText).toBe('string');
    expect((assistantMsg?.outputText ?? '').length).toBeGreaterThan(0);

    await apiDelete(`/sessions/${session.id}`);
  });

  test('向不存在的 session 发消息应返回 404', async () => {
    const res = await fetch(`${API_BASE}/sessions/nonexistent-id/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: 'ghost message' },
        runtimeConfig: {}
      })
    });
    expect(res.status).toBe(404);
  });

  test('input 不符合 runner schema 时应返回 400', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const res = await fetch(`${API_BASE}/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: '' },
        runtimeConfig: {}
      })
    });

    expect(res.status).toBe(400);
    await apiDelete(`/sessions/${session.id}`);
  });

  test('runtimeConfig 不是对象时应返回 400', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const res = await fetch(`${API_BASE}/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: 'valid prompt' },
        runtimeConfig: 'invalid-runtime-config'
      })
    });

    expect(res.status).toBe(400);
    await apiDelete(`/sessions/${session.id}`);
  });

  test('session 正在处理时再次发消息应返回 409（并发锁）', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const firstSend = fetch(`${API_BASE}/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: 'Message one - occupies lock' },
        runtimeConfig: {}
      })
    });

    await waitForSessionStatus(session.id, 'running', 10_000);

    const secondRes = await fetch(
      `${API_BASE}/sessions/${session.id}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { prompt: 'Message two - should be rejected' },
          runtimeConfig: {}
        })
      }
    );

    expect(secondRes.status).toBe(409);
    const secondBody = (await secondRes.json()) as {
      data: { reason: string };
    };
    expect(secondBody.data.reason).toBe('RUNNING');

    const firstRes = await firstSend;
    expect(firstRes.status).toBe(200);
    await waitForSessionStatus(session.id, 'ready', 10_000);
    await apiDelete(`/sessions/${session.id}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancel 操作
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cancel 操作', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Cancel Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('对 ready 状态的 session 执行 cancel 应幂等返回 session', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const res = await fetch(`${API_BASE}/sessions/${session.id}/cancel`, {
      method: 'POST'
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe('ready');

    await apiDelete(`/sessions/${session.id}`);
  });

  test('cancel 后 session 状态应回到 ready，当前 assistant 消息标记为 USER_CANCELLED', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Cancel me' },
      runtimeConfig: {}
    });

    await waitForSessionStatus(session.id, 'running', 10_000);

    const cancelRes = await fetch(
      `${API_BASE}/sessions/${session.id}/cancel`,
      { method: 'POST' }
    );
    expect(cancelRes.status).toBe(200);

    const finalSession = await waitForSessionStatus(session.id, 'ready', 10_000);
    expect(finalSession.status).toBe('ready');

    const messages = await waitForMessageCount(session.id, 2, 10_000);
    const assistantMsg = messages.find((message) => message.role === 'assistant');
    expect(assistantMsg?.status).toBe('error');
    expect(assistantMsg?.errorPayload?.code).toBe('USER_CANCELLED');
    expect(assistantMsg?.cancelledAt).toBeTruthy();

    await apiDelete(`/sessions/${session.id}`);
  });

  test('对不存在的 session 执行 cancel 应返回 404', async () => {
    const res = await fetch(`${API_BASE}/sessions/nonexistent-id/cancel`, {
      method: 'POST'
    });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reload 操作
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Reload 操作', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Reload Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('发送一条消息后 reload 应重新生成 assistant 回复', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Original message' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);
    await waitForMessageCount(session.id, 2, 10_000);

    const reloadRes = await fetch(
      `${API_BASE}/sessions/${session.id}/reload`,
      { method: 'POST' }
    );
    expect(reloadRes.status).toBe(200);

    const finalSession = await waitForSessionStatus(session.id, 'ready', 10_000);
    expect(finalSession.status).toBe('ready');

    // reload 后：旧 assistant 被删，新 assistant 生成 → 仍应有 2 条
    const messages = await waitForMessageCount(session.id, 2, 10_000);
    expect(messages.length).toBe(2);

    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0].status).toBe('complete');

    await apiDelete(`/sessions/${session.id}`);
  });

  test('无历史消息时 reload 应返回 400', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const res = await fetch(`${API_BASE}/sessions/${session.id}/reload`, {
      method: 'POST'
    });
    expect(res.status).toBe(400);

    await apiDelete(`/sessions/${session.id}`);
  });

  test('对不存在的 session 执行 reload 应返回 404', async () => {
    const res = await fetch(`${API_BASE}/sessions/nonexistent-id/reload`, {
      method: 'POST'
    });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edit Message 操作
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Edit Message 操作', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Edit Message Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('编辑 user 消息应截断历史并重新运行', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'First message' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Second message' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);

    const messages = await waitForMessageCount(session.id, 4, 10_000);
    expect(messages.length).toBe(4);

    const firstUserMsg = messages.find((m) => m.role === 'user');
    expect(firstUserMsg).toBeDefined();

    const editRes = await fetch(
      `${API_BASE}/sessions/${session.id}/messages/${firstUserMsg!.id}/edit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { prompt: 'Edited first message' },
          runtimeConfig: {}
        })
      }
    );
    expect(editRes.status).toBe(200);

    await waitForSessionStatus(session.id, 'ready', 10_000);

    // 编辑后：从第一条 user 消息截断，重新生成 → 有 2 条（edited user + new assistant）
    const finalMessages = await waitForMessageCount(session.id, 2, 10_000);
    expect(finalMessages.length).toBe(2);

    const editedUserMsg = finalMessages.find((m) => m.role === 'user');
    expect(editedUserMsg?.inputContent).toMatchObject({
      prompt: 'Edited first message'
    });

    const newAssistant = finalMessages.find((m) => m.role === 'assistant');
    expect(newAssistant?.status).toBe('complete');

    await apiDelete(`/sessions/${session.id}`);
  });

  test('编辑不存在的 messageId 应返回 400', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const res = await fetch(
      `${API_BASE}/sessions/${session.id}/messages/nonexistent-message-id/edit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { prompt: 'edit' },
          runtimeConfig: {}
        })
      }
    );
    expect(res.status).toBe(400);

    await apiDelete(`/sessions/${session.id}`);
  });

  test('编辑 assistant 消息应返回 400（只能编辑 user 消息）', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Hello' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);

    const messages = await waitForMessageCount(session.id, 2, 10_000);
    const assistantMsg = messages.find((m) => m.role === 'assistant');

    const res = await fetch(
      `${API_BASE}/sessions/${session.id}/messages/${assistantMsg!.id}/edit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { prompt: 'edit assistant' },
          runtimeConfig: {}
        })
      }
    );
    expect(res.status).toBe(400);

    await apiDelete(`/sessions/${session.id}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 消息列表分页
// ─────────────────────────────────────────────────────────────────────────────

test.describe('消息列表分页', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Pagination Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('limit 参数应限制返回消息数量，nextCursor 指向下一页', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    // 发 3 条消息 → 共 6 条
    for (let i = 1; i <= 3; i++) {
      await apiPost(`/sessions/${session.id}/messages`, {
        input: { prompt: `Pagination message ${i}` },
        runtimeConfig: {}
      });
      await waitForSessionStatus(session.id, 'ready', 10_000);
    }
    await waitForMessageCount(session.id, 6, 10_000);

    // 请求第一页，limit=2
    const res = await fetch(
      `${API_BASE}/sessions/${session.id}/messages?limit=2`
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { data: MessageRecord[]; nextCursor: string | null };
    };

    expect(body.data.data.length).toBe(2);
    expect(body.data.nextCursor).not.toBeNull();

    // 用 nextCursor 请求第二页
    const res2 = await fetch(
      `${API_BASE}/sessions/${session.id}/messages?limit=2&cursor=${body.data.nextCursor}`
    );
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as {
      data: { data: MessageRecord[]; nextCursor: string | null };
    };
    expect(body2.data.data.length).toBe(2);

    // 两页的消息 id 不应重叠
    const firstPageIds = body.data.data.map((m) => m.id);
    const secondPageIds = body2.data.data.map((m) => m.id);
    const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
    expect(overlap).toHaveLength(0);

    await apiDelete(`/sessions/${session.id}`);
  });

  test('无更多消息时 nextCursor 应为 null', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Single message' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);
    await waitForMessageCount(session.id, 2, 10_000);

    const res = await fetch(
      `${API_BASE}/sessions/${session.id}/messages?limit=50`
    );
    const body = (await res.json()) as {
      data: { data: MessageRecord[]; nextCursor: string | null };
    };
    expect(body.data.nextCursor).toBeNull();

    await apiDelete(`/sessions/${session.id}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session 列表与查询
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Session 列表与查询', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('List Query Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('GET /sessions 缺少 scopeId 应返回 400', async () => {
    const res = await fetch(`${API_BASE}/sessions`);
    expect(res.status).toBe(400);
  });

  test('GET /sessions?scopeId= 不存在的项目 应返回 404', async () => {
    const res = await fetch(
      `${API_BASE}/sessions?scopeId=nonexistent-project-id`
    );
    expect(res.status).toBe(404);
  });

  test('GET /sessions/:id 对不存在的 session 应返回 404', async () => {
    const res = await fetch(`${API_BASE}/sessions/nonexistent-session-id`);
    expect(res.status).toBe(404);
  });

  test('Session 列表应按 updatedAt 降序排列（最新的在前）', async () => {
    const session1 = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const session2 = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session2.id}/messages`, {
      input: { prompt: 'bump session 2 updatedAt' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session2.id, 'ready', 10_000);

    const list = await apiGet(`/sessions?scopeId=${project.id}`);
    const records = (Array.isArray(list) ? list : []) as (ApiRecord & {
      updatedAt: string;
    })[];

    const ids = records.map((s) => s.id);
    const idx1 = ids.indexOf(session1.id);
    const idx2 = ids.indexOf(session2.id);

    // session2 更新更晚，应排在更前面（index 更小）
    expect(idx2).toBeLessThan(idx1);

    await apiDelete(`/sessions/${session1.id}`);
    await apiDelete(`/sessions/${session2.id}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session dispose（删除）语义补充
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Session dispose 语义', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Dispose Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('dispose 后再次 dispose 同一 session 应返回 404（已销毁）', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const first = await fetch(`${API_BASE}/sessions/${session.id}`, {
      method: 'DELETE'
    });
    expect(first.status).toBe(200);

    // 第二次删除同一 session —— 已不存在，返回 404
    const second = await fetch(`${API_BASE}/sessions/${session.id}`, {
      method: 'DELETE'
    });
    expect(second.status).toBe(404);
  });

  test('dispose 后 GET /sessions/:id/messages 应返回 404', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Before delete' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);

    await fetch(`${API_BASE}/sessions/${session.id}`, { method: 'DELETE' });

    const res = await fetch(`${API_BASE}/sessions/${session.id}/messages`);
    expect(res.status).toBe(404);
  });
});
