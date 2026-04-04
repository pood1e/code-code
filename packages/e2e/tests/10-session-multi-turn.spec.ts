import { test, expect } from '@playwright/test';
import {
  cleanupTestData,
  seedProject,
  seedMockRunner,
  apiPost,
  apiDelete,
  apiGet,
  API_BASE,
  type ApiRecord
} from './helpers';

/**
 * Regression test: session 多轮消息 & 删除语义
 *
 * 背景（Bug）：CLI runner session 发送第二条消息总是失败。
 * 根因：第一条消息的 CLI 进程退出后，`waitForExit` 调用 `handle.queue.close()`，
 *       导致 `consumeRunnerOutput` 的 for-await 循环退出，`outputConsumers` 被删除。
 *       第二条消息来时 `ensureRuntime()` 发现 `outputConsumers` 不存在，错误地调用
 *       `initializeRuntime()`，覆写了 `runnerState`（cliSessionId 丢失），并消费
 *       已关闭的旧 queue，立即触发 RUNNER_OUTPUT_CLOSED 错误。
 *
 * Fix：进程正常退出后不关闭 queue，output consumer 在整个 session 生命周期内持续存活，
 *      只有 `destroySession()` 才关闭 queue。
 *
 * 本测试使用 mock runner（行为与 CLI runner 在 output consumer 层面一致）验证该路径。
 */
test.describe('Session 多轮消息防回归', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Multi-Turn Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  /**
   * 轮询直到 session status 变为期望状态。
   * 超时后抛出，避免测试挂起。
   */
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
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    const body = (await res.json()) as { data: ApiRecord };
    throw new Error(
      `Session ${sessionId} did not reach status '${targetStatus}' within ${timeoutMs}ms. ` +
        `Current status: ${String(body.data.status)}`
    );
  }

  /**
   * 轮询直到 session 消息数量达到期望值。
   */
  async function waitForMessageCount(
    sessionId: string,
    expectedCount: number,
    timeoutMs = 10_000
  ): Promise<{ role: string; status: string; errorPayload: unknown }[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
      const body = (await res.json()) as {
        data: { data: { role: string; status: string; errorPayload: unknown }[] };
      };
      if (body.data.data.length >= expectedCount) return body.data.data;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
    const body = (await res.json()) as {
      data: { data: { role: string; status: string; errorPayload: unknown }[] };
    };
    throw new Error(
      `Session ${sessionId} did not reach ${expectedCount} messages within ${timeoutMs}ms. ` +
        `Current count: ${body.data.data.length}`
    );
  }

  test('第一条消息应成功完成并将 session 置为 Ready', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    expect(session.status).toBe('ready');

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Hello, first message' },
      runtimeConfig: {}
    });

    // 等待 session 处理完成（Running → Ready）
    const completedSession = await waitForSessionStatus(
      session.id,
      'ready',
      10_000
    );
    expect(completedSession.status).toBe('ready');

    // 应有 2 条消息：user + assistant
    const messages = await waitForMessageCount(session.id, 2, 10_000);
    const roles = messages.map((m: { role: string }) => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');

    // assistant 消息应为 complete
    const assistantMsg = messages.find(
      (m: { role: string; status: string }) => m.role === 'assistant'
    );
    expect(assistantMsg?.status).toBe('complete');

    await apiDelete(`/sessions/${session.id}`);
  });

  test('第二条消息应成功完成（防止 queue 关闭导致的回归）', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    // 第一条消息
    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'First message' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);

    // 第二条消息 — 这是回归点
    // Bug 下会返回 409 (Session is busy) 或使 session 进入 error 状态
    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Second message — regression check' },
      runtimeConfig: {}
    });
    const completedSession = await waitForSessionStatus(
      session.id,
      'ready',
      10_000
    );

    expect(completedSession.status).toBe('ready');

    // 应有 4 条消息：user1 + assistant1 + user2 + assistant2
    const messages = await waitForMessageCount(session.id, 4, 10_000);
    expect(messages.length).toBe(4);

    const assistantMessages = messages.filter(
      (m: { role: string }) => m.role === 'assistant'
    );
    expect(assistantMessages).toHaveLength(2);

    // 两条 assistant 消息都应为 complete，无 error
    for (const msg of assistantMessages) {
      expect(msg.status).toBe('complete');
      expect(msg.errorPayload).toBeNull();
    }

    await apiDelete(`/sessions/${session.id}`);
  });

  test('连续发送三条消息也应全部成功', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    for (let i = 1; i <= 3; i++) {
      await apiPost(`/sessions/${session.id}/messages`, {
        input: { prompt: `Message ${i}` },
        runtimeConfig: {}
      });
      await waitForSessionStatus(session.id, 'ready', 10_000);
    }

    // 应有 6 条消息
    const messages = await waitForMessageCount(session.id, 6, 10_000);
    expect(messages.length).toBe(6);

    const assistantMessages = messages.filter(
      (m: { role: string }) => m.role === 'assistant'
    );
    expect(assistantMessages).toHaveLength(3);
    for (const msg of assistantMessages) {
      expect(msg.status).toBe('complete');
    }

    await apiDelete(`/sessions/${session.id}`);
  });

  test('DELETE session 应真正删除记录而非只改状态', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    // 发一条消息后删除
    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'Message before delete' },
      runtimeConfig: {}
    });
    await waitForSessionStatus(session.id, 'ready', 10_000);

    await apiDelete(`/sessions/${session.id}`);

    // GET session 应返回 404
    const res = await fetch(`${API_BASE}/sessions/${session.id}`);
    expect(res.status).toBe(404);

    // 不应出现在 session 列表中
    const list = await apiGet(`/sessions?scopeId=${project.id}`);
    const found = (list as { id: string }[]).find(
      (s) => s.id === session.id
    );
    expect(found).toBeUndefined();
  });

  test('正发送消息时 DELETE session 应能强制终止并删除', async () => {
    const session = await apiPost('/sessions', {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiPost(`/sessions/${session.id}/messages`, {
      input: { prompt: 'This message may still be running' },
      runtimeConfig: {}
    });

    await waitForSessionStatus(session.id, 'running', 5_000);

    await apiDelete(`/sessions/${session.id}`);

    const res = await fetch(`${API_BASE}/sessions/${session.id}`);
    expect(res.status).toBe(404);
  });
});
