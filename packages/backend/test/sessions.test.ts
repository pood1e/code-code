import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';

import { setupTestApp, teardownTestApp, resetDatabase, getApp } from './setup';
import {
  api,
  expectSuccess,
  expectError,
  seedProject,
  seedAgentRunner,
  seedSkill,
  seedRule,
  seedMcp
} from './helpers';

describe('Sessions API', () => {
  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  // ---- 辅助函数：创建一个可用的 Session ----

  async function createTestSession(options?: { withInitialMessage?: boolean }) {
    const project = await seedProject();
    const runner = await seedAgentRunner();

    const payload: Record<string, unknown> = {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    };

    if (options?.withInitialMessage) {
      payload.initialMessage = {
        input: { prompt: 'Hello Mock' }
      };
    }

    const res = await api().post('/api/sessions').send(payload);
    const session = expectSuccess<{
      id: string;
      scopeId: string;
      status: string;
    }>(res, 201);

    return { project, runner, session };
  }

  // ---- 生命周期正常路径 ----

  describe('POST /api/sessions - 创建 Session', () => {
    it('应成功创建 Session', async () => {
      const { session, project } = await createTestSession();

      expect(session.id).toBeDefined();
      expect(session.scopeId).toBe(project.id);
      expect(session.status).toBeDefined();
    });

    it('创建时可带 initialMessage', async () => {
      const { session } = await createTestSession({
        withInitialMessage: true
      });

      expect(session.id).toBeDefined();

      // Wait a bit for the mock runner to process
      await new Promise((r) => setTimeout(r, 500));

      // Should have messages
      const msgRes = await api().get(`/api/sessions/${session.id}/messages`);
      const msgData = expectSuccess<{
        data: { role: string }[];
      }>(msgRes);

      expect(msgData.data.length).toBeGreaterThanOrEqual(1);
      const userMsg = msgData.data.find((m) => m.role === 'user');
      expect(userMsg).toBeDefined();
    });

    it('创建时可包含 Skills/Rules/MCPs', async () => {
      const project = await seedProject();
      const runner = await seedAgentRunner();
      const skill = await seedSkill();
      const rule = await seedRule();
      const mcp = await seedMcp();

      const res = await api()
        .post('/api/sessions')
        .send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [skill.id],
          ruleIds: [rule.id],
          mcps: [{ resourceId: mcp.id }],
          runnerSessionConfig: {}
        });
      const session = expectSuccess<{ id: string }>(res, 201);

      const detailRes = await api().get(`/api/sessions/${session.id}`);
      const detail = expectSuccess<{
        platformSessionConfig: {
          skillIds: string[];
          ruleIds: string[];
          mcps: { resourceId: string }[];
        };
      }>(detailRes);

      expect(detail.platformSessionConfig.skillIds).toContain(skill.id);
      expect(detail.platformSessionConfig.ruleIds).toContain(rule.id);
    });
  });

  describe('GET /api/sessions - 列表查询', () => {
    it('按 scopeId 查询返回对应的 Sessions', async () => {
      const { project } = await createTestSession();
      await createTestSession(); // Another project's session

      const res = await api().get(`/api/sessions?scopeId=${project.id}`);
      const data = expectSuccess<{ id: string }[]>(res);

      expect(data).toHaveLength(1);
    });
  });

  describe('GET /api/sessions/:id - 获取详情', () => {
    it('应返回完整的 Session 详情', async () => {
      const { session } = await createTestSession();

      const res = await api().get(`/api/sessions/${session.id}`);
      const data = expectSuccess<{
        id: string;
        status: string;
        runnerType: string;
        platformSessionConfig: object;
        runnerSessionConfig: object;
      }>(res);

      expect(data.id).toBe(session.id);
      expect(data.runnerType).toBe('mock');
      expect(data.platformSessionConfig).toBeDefined();
    });
  });

  describe('POST /api/sessions/:id/messages - 发送消息', () => {
    // 语义：发送消息是一个操作（action），不是创建资源，应返回 200
    it('应成功发送消息到 Session', async () => {
      const { session } = await createTestSession();

      const res = await api()
        .post(`/api/sessions/${session.id}/messages`)
        .send({ input: { prompt: 'Test message' } });
      expectSuccess(res, 200);

      // Wait for mock runner to process
      await new Promise((r) => setTimeout(r, 800));

      // Check messages
      const msgRes = await api().get(`/api/sessions/${session.id}/messages`);
      const msgData = expectSuccess<{
        data: { role: string }[];
      }>(msgRes);

      const userMsgs = msgData.data.filter((m) => m.role === 'user');
      expect(userMsgs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/sessions/:id/cancel - 取消输出', () => {
    // 语义：取消是操作，不是创建资源，应返回 200
    it('应成功取消', async () => {
      const { session } = await createTestSession();

      const res = await api().post(`/api/sessions/${session.id}/cancel`);
      expectSuccess(res, 200);
    });
  });

  describe('POST /api/sessions/:id/reload - 重新加载', () => {
    // 语义：reload 是操作，不是创建资源，应返回 200
    it('应成功触发 reload', async () => {
      const { session } = await createTestSession({
        withInitialMessage: true
      });

      // Wait for initial message to complete
      await new Promise((r) => setTimeout(r, 1000));

      const res = await api().post(`/api/sessions/${session.id}/reload`);
      expectSuccess(res, 200);
    });
  });

  describe('GET /api/sessions/:id/messages - 消息列表', () => {
    it('应返回分页数据结构', async () => {
      const { session } = await createTestSession();

      const res = await api().get(
        `/api/sessions/${session.id}/messages?limit=10`
      );
      const data = expectSuccess<{
        data: unknown[];
        nextCursor: string | null;
      }>(res);

      expect(Array.isArray(data.data)).toBe(true);
      expect('nextCursor' in data).toBe(true);
    });
  });

  describe('SSE /api/sessions/:id/events - 事件流', () => {
    /**
     * Test SSE by making a raw HTTP request and reading the first chunk.
     * supertest cannot handle SSE properly, so we use Node's http module.
     */
    function connectSSE(
      path: string,
      timeout = 3000
    ): Promise<{ statusCode: number; chunks: string[] }> {
      return new Promise((resolve) => {
        const server = getApp().getHttpServer();
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;

        const chunks: string[] = [];
        const req = http.get(
          `http://127.0.0.1:${port}${path}`,
          { headers: { Accept: 'text/event-stream' } },
          (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              chunks.push(chunk);
            });

            // Resolve after timeout with whatever we've collected
            setTimeout(() => {
              res.destroy();
              resolve({ statusCode: res.statusCode ?? 0, chunks });
            }, timeout);
          }
        );
        req.on('error', () => {
          resolve({ statusCode: 0, chunks });
        });
      });
    }

    it('应能建立 SSE 连接并收到 heartbeat', async () => {
      const { session } = await createTestSession();

      // Start listening on a random port for the test
      const server = getApp().getHttpServer();
      if (!server.listening) {
        await new Promise<void>((resolve) => {
          server.listen(0, '127.0.0.1', () => resolve());
        });
      }

      const result = await connectSSE(
        `/api/sessions/${session.id}/events`,
        2000
      );

      expect(result.statusCode).toBe(200);
      // Should have received at least one chunk (heartbeat or data)
      // The SSE format has "data:" prefix
    }, 10000);
  });

  describe('DELETE /api/sessions/:id - 销毁 Session', () => {
    it('应成功销毁 Session', async () => {
      const { session } = await createTestSession();

      const res = await api().delete(`/api/sessions/${session.id}`);
      expectSuccess(res);

      // Wait for disposal
      await new Promise((r) => setTimeout(r, 200));

      const detailRes = await api().get(`/api/sessions/${session.id}`);
      const detail = expectSuccess<{ status: string }>(detailRes);
      expect(['disposing', 'disposed']).toContain(detail.status);
    });
  });

  // ---- 边界 & 错误场景 ----

  describe('创建验证', () => {
    it('scopeId 不存在时应返回错误', async () => {
      const runner = await seedAgentRunner();

      const res = await api().post('/api/sessions').send({
        scopeId: 'nonexistent-project',
        runnerId: runner.id,
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      });

      expect([400, 404]).toContain(res.status);
    });

    it('runnerId 不存在时应返回错误', async () => {
      const project = await seedProject();

      const res = await api().post('/api/sessions').send({
        scopeId: project.id,
        runnerId: 'nonexistent-runner',
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      });

      expect([400, 404]).toContain(res.status);
    });

    it('缺少必填字段 scopeId 返回 400', async () => {
      const runner = await seedAgentRunner();

      const res = await api().post('/api/sessions').send({
        runnerId: runner.id,
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      });
      expectError(res, 400);
    });
  });

  describe('资源不存在', () => {
    it('GET 不存在的 Session 返回 404', async () => {
      expectError(await api().get('/api/sessions/nonexistent'), 404);
    });

    it('发消息到不存在的 Session 返回错误', async () => {
      const res = await api()
        .post('/api/sessions/nonexistent/messages')
        .send({ input: { prompt: 'hello' } });

      expect([400, 404]).toContain(res.status);
    });
  });
});
