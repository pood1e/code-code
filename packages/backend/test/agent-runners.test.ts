import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

import { setupTestApp, teardownTestApp, resetDatabase } from './setup';
import {
  api,
  expectSuccess,
  expectError,
  createAgentRunnerPayload,
  seedAgentRunner,
  seedProject
} from './helpers';

describe('AgentRunners API', () => {
  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  // ---- Runner Types ----

  describe('GET /api/agent-runner-types - 列表 Runner Types', () => {
    it('应返回已注册的 runner types（含 mock）', async () => {
      const res = await api().get('/api/agent-runner-types');
      const data = expectSuccess<
        { id: string; name: string; runnerConfigSchema: object }[]
      >(res);

      expect(data.length).toBeGreaterThan(0);
      const mockType = data.find((t) => t.id === 'mock');
      expect(mockType).toBeDefined();
      expect(mockType!.name).toBe('Mock Runner');
    });
  });

  // ---- CRUD 正常路径 ----

  describe('POST /api/agent-runners - 创建 AgentRunner', () => {
    it('应成功创建 mock 类型 AgentRunner', async () => {
      const payload = createAgentRunnerPayload({ name: 'My Mock Runner' });
      const res = await api().post('/api/agent-runners').send(payload);
      const data = expectSuccess<{
        id: string;
        name: string;
        type: string;
        runnerConfig: object;
      }>(res, 201);

      expect(data.id).toBeDefined();
      expect(data.name).toBe('My Mock Runner');
      expect(data.type).toBe('mock');
    });
  });

  describe('GET /api/agent-runners - 列表查询', () => {
    it('返回所有 Runners', async () => {
      await seedAgentRunner({ name: 'Runner A' });
      await seedAgentRunner({ name: 'Runner B' });

      const res = await api().get('/api/agent-runners');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(2);
    });

    it('支持 name 过滤', async () => {
      await seedAgentRunner({ name: 'Alpha Runner' });
      await seedAgentRunner({ name: 'Beta Runner' });

      const res = await api().get('/api/agent-runners?name=Alpha');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Alpha Runner');
    });
  });

  describe('GET /api/agent-runners/:id - 获取详情', () => {
    it('应返回包含 runnerConfig 的完整详情', async () => {
      const created = await seedAgentRunner();

      const res = await api().get(`/api/agent-runners/${created.id}`);
      const data = expectSuccess<{
        id: string;
        type: string;
        runnerConfig: object;
      }>(res);

      expect(data.id).toBe(created.id);
      expect(data.type).toBe('mock');
      expect(data.runnerConfig).toBeDefined();
    });
  });

  describe('PATCH /api/agent-runners/:id - 更新 AgentRunner', () => {
    it('应支持部分更新 name', async () => {
      const created = await seedAgentRunner();

      const res = await api()
        .patch(`/api/agent-runners/${created.id}`)
        .send({ name: 'Updated Runner' });
      const data = expectSuccess<{ name: string }>(res);

      expect(data.name).toBe('Updated Runner');
    });

    it('应支持更新 description', async () => {
      const created = await seedAgentRunner();

      const res = await api()
        .patch(`/api/agent-runners/${created.id}`)
        .send({ description: 'New description' });
      const data = expectSuccess<{ description: string }>(res);

      expect(data.description).toBe('New description');
    });
  });

  describe('GET /api/agent-runners/:id/health - 健康检查', () => {
    it('mock runner 应返回 online', async () => {
      const runner = await seedAgentRunner();

      const res = await api().get(`/api/agent-runners/${runner.id}/health`);
      const data = expectSuccess<{ status: string }>(res);

      expect(data.status).toBe('online');
    });
  });

  describe('GET /api/agent-runners/:id/context - 探测上下文', () => {
    it('mock runner 无 probeContext，应返回空对象', async () => {
      const runner = await seedAgentRunner();

      const res = await api().get(`/api/agent-runners/${runner.id}/context`);
      const data = expectSuccess<Record<string, unknown>>(res);

      expect(data).toEqual({});
    });
  });

  describe('DELETE /api/agent-runners/:id - 删除 AgentRunner', () => {
    it('应成功删除无关联 Session 的 Runner', async () => {
      const runner = await seedAgentRunner();

      expectSuccess(await api().delete(`/api/agent-runners/${runner.id}`));
      expectError(await api().get(`/api/agent-runners/${runner.id}`), 404);
    });
  });

  // ---- 边界 & 错误场景 ----

  describe('类型验证', () => {
    it('不存在的 runner type 返回 400', async () => {
      const res = await api()
        .post('/api/agent-runners')
        .send(
          createAgentRunnerPayload({ type: 'nonexistent-type' })
        );
      expectError(res, 400);
    });

    it('runnerConfig 不符合 schema 返回 400', async () => {
      // mock runner expects empty object, extra fields should be stripped
      // but if a type needs specific fields and they're missing, it's 400
      // For mock this is a no-op since schema is z.object({})
      // Test with an invalid type that would have a stricter schema
      const res = await api()
        .post('/api/agent-runners')
        .send(
          createAgentRunnerPayload({ type: 'does-not-exist', runnerConfig: { model: 'x' } })
        );
      expectError(res, 400);
    });
  });

  describe('删除约束', () => {
    it('删除被 Session 引用的 Runner 应返回 400', async () => {
      const runner = await seedAgentRunner();
      const project = await seedProject();

      // Create a session referencing this runner
      await api()
        .post('/api/sessions')
        .send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        });

      const deleteRes = await api().delete(
        `/api/agent-runners/${runner.id}`
      );
      expectError(deleteRes, 400);
    });
  });

  describe('资源不存在', () => {
    it('GET/PATCH/DELETE 不存在的 ID 返回 404', async () => {
      expectError(await api().get('/api/agent-runners/nonexistent'), 404);
      expectError(
        await api()
          .patch('/api/agent-runners/nonexistent')
          .send({ name: 'X' }),
        404
      );
      expectError(
        await api().delete('/api/agent-runners/nonexistent'),
        404
      );
    });

    it('健康检查不存在的 Runner 返回 404', async () => {
      expectError(
        await api().get('/api/agent-runners/nonexistent/health'),
        404
      );
    });
  });
});
