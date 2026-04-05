import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPrisma, resetDatabase, setupTestApp, teardownTestApp } from './setup';
import {
  api,
  expectError,
  expectSuccess,
  seedAgentRunner,
  seedProject
} from './helpers';

describe('Chats API', () => {
  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function createChat(overrides: Record<string, unknown> = {}) {
    const project = await seedProject();
    const runner = await seedAgentRunner();

    const response = await api()
      .post('/api/chats')
      .send({
        scopeId: project.id,
        runnerId: runner.id,
        title: '新会话',
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {},
        ...overrides
      });

    const chat = expectSuccess<{
      id: string;
      scopeId: string;
      sessionId: string;
      title: string | null;
      runnerId: string;
      runnerType: string;
      status: string;
    }>(response, 201);

    return { chat, project, runner };
  }

  it('创建 chat 时应同时返回底层 session 映射和 runner 元数据', async () => {
    const { chat, project, runner } = await createChat();

    expect(chat.id).toBeDefined();
    expect(chat.scopeId).toBe(project.id);
    expect(chat.sessionId).toBeDefined();
    expect(chat.title).toBe('新会话');
    expect(chat.runnerId).toBe(runner.id);
    expect(chat.runnerType).toBe('mock');
    expect(chat.status).toBeDefined();
  });

  it('应按 scopeId 过滤 list，并支持 detail 和 title 更新', async () => {
    const { chat, project } = await createChat();
    await createChat();

    const listResponse = await api()
      .get('/api/chats')
      .query({ scopeId: project.id });
    const list = expectSuccess<
      Array<{ id: string; sessionId: string; scopeId: string }>
    >(
      listResponse
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: chat.id,
      sessionId: chat.sessionId,
      scopeId: project.id
    });

    const detail = expectSuccess<{
      id: string;
      sessionId: string;
      title: string | null;
      runnerId: string;
    }>(await api().get(`/api/chats/${chat.id}`));
    expect(detail).toMatchObject({
      id: chat.id,
      sessionId: chat.sessionId,
      title: '新会话',
      runnerId: chat.runnerId
    });

    const updated = expectSuccess<{ title: string | null }>(
      await api().patch(`/api/chats/${chat.id}`).send({ title: '已重命名会话' })
    );
    expect(updated.title).toBe('已重命名会话');
  });

  it('删除 chat 时应一并处置底层 session', async () => {
    const { chat } = await createChat();

    expectSuccess(await api().delete(`/api/chats/${chat.id}`), 200);

    expectError(await api().get(`/api/chats/${chat.id}`), 404);
    expectError(await api().get(`/api/sessions/${chat.sessionId}`), 404);
  });

  it('非法 payload 应在 controller 边界返回 400', async () => {
    const project = await seedProject();
    const runner = await seedAgentRunner();

    const response = await api()
      .post('/api/chats')
      .send({
        scopeId: project.id,
        runnerId: runner.id,
        skillIds: [123],
        ruleIds: [],
        mcps: [{}],
        runnerSessionConfig: [],
        initialMessage: {
          input: 'not-an-object'
        }
      });

    expectError(response, 400);
  });

  it('chat 落库失败时应补偿清理已创建的 session', async () => {
    const project = await seedProject();
    const runner = await seedAgentRunner();
    const chatCreateSpy = vi
      .spyOn(getPrisma().chat, 'create')
      .mockRejectedValueOnce(new Error('chat insert failed'));

    try {
      const response = await api()
        .post('/api/chats')
        .send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        });

      expectError(response, 500);

      const remainingSessions = await getPrisma().agentSession.count({
        where: { scopeId: project.id }
      });
      const remainingChats = await getPrisma().chat.count({
        where: { scopeId: project.id }
      });

      expect(remainingSessions).toBe(0);
      expect(remainingChats).toBe(0);
    } finally {
      chatCreateSpy.mockRestore();
    }
  });
});
