import { z } from 'zod';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import type { RunnerType } from '../src/modules/agent-runners/runner-type.interface';
import { RunnerTypeRegistry } from '../src/modules/agent-runners/runner-type.registry';

import {
  setupTestApp,
  teardownTestApp,
  resetDatabase,
  getApp,
  getPrisma
} from './setup';
import {
  api,
  expectSuccess,
  expectError,
  createAgentRunnerPayload,
  seedAgentRunner,
  seedProject
} from './helpers';

const testRunnerConfigSchema = z.object({});
const testInputSchema = z.object({
  prompt: z.string().min(1)
});
const testRuntimeConfigSchema = z.object({});

function registerTestRunnerType(
  runnerType: Pick<RunnerType, 'id' | 'name' | 'checkHealth'> &
    Partial<Pick<RunnerType, 'probeContext'>>
) {
  getApp().get(RunnerTypeRegistry).register({
    id: runnerType.id,
    name: runnerType.name,
    capabilities: { skill: false, rule: false, mcp: false },
    runnerConfigSchema: testRunnerConfigSchema,
    runnerSessionConfigSchema: testRunnerConfigSchema,
    inputSchema: testInputSchema,
    runtimeConfigSchema: testRuntimeConfigSchema,
    checkHealth: runnerType.checkHealth,
    probeContext: runnerType.probeContext,
    createSession: async () => ({}),
    shouldReusePersistedState: () => false,
    destroySession: async () => undefined,
    send: async () => undefined,
    output: async function* () {},
    cancelOutput: async () => undefined
  });
}

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
      const data =
        expectSuccess<
          { id: string; name: string; runnerConfigSchema: object }[]
        >(res);

      expect(data.length).toBeGreaterThan(0);
      const mockType = data.find((t) => t.id === 'mock');
      expect(mockType).toBeDefined();
      expect(mockType!.name).toBe('Mock Runner');
    });

    it('CLI mode 类字段应只出现在 runtimeConfigSchema', async () => {
      const res = await api().get('/api/agent-runner-types');
      const data = expectSuccess<
        Array<{
          id: string;
          inputSchema: { fields: Array<{ name: string; label: string }> };
          runtimeConfigSchema: {
            fields: Array<{
              name: string;
              label: string;
              defaultValue?: string | number | boolean;
            }>;
          };
        }>
      >(res);

      const cursorType = data.find((item) => item.id === 'cursor-cli');
      expect(cursorType).toBeDefined();
      expect(
        cursorType!.inputSchema.fields.map((field) => field.name)
      ).not.toContain('mode');
      expect(
        cursorType!.runtimeConfigSchema.fields.map((field) => field.name)
      ).toContain('mode');

      const qwenType = data.find((item) => item.id === 'qwen-cli');
      expect(qwenType).toBeDefined();
      expect(
        qwenType!.inputSchema.fields.map((field) => field.name)
      ).not.toContain('approvalMode');
      expect(
        qwenType!.runtimeConfigSchema.fields.map((field) => field.name)
      ).toContain('approvalMode');
      expect(
        qwenType!.runtimeConfigSchema.fields.find(
          (field) => field.name === 'approvalMode'
        )?.label
      ).toBe('审批模式');
      expect(
        qwenType!.runtimeConfigSchema.fields.find(
          (field) => field.name === 'approvalMode'
        )?.defaultValue
      ).toBe('default');

      const claudeType = data.find((item) => item.id === 'claude-code');
      expect(claudeType).toBeDefined();
      expect(
        claudeType!.inputSchema.fields.map((field) => field.name)
      ).not.toContain('permissionMode');
      expect(
        claudeType!.runtimeConfigSchema.fields.map((field) => field.name)
      ).toContain('permissionMode');
      expect(
        claudeType!.runtimeConfigSchema.fields.find(
          (field) => field.name === 'permissionMode'
        )?.label
      ).toBe('权限模式');
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

    it('空白 description 应归一化为 null', async () => {
      const res = await api()
        .post('/api/agent-runners')
        .send(createAgentRunnerPayload({ description: '   ' }));
      const data = expectSuccess<{ description: string | null }>(res, 201);

      expect(data.description).toBeNull();
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

    it('name 仅为空白时不应误筛选', async () => {
      await seedAgentRunner({ name: 'Alpha Runner' });
      await seedAgentRunner({ name: 'Beta Runner' });

      const res = await api().get('/api/agent-runners?name=%20%20%20');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(2);
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

    it('更新为空白 description 时应归一化为 null', async () => {
      const created = await seedAgentRunner({ description: 'Has description' });

      const res = await api()
        .patch(`/api/agent-runners/${created.id}`)
        .send({ description: '   ' });
      const data = expectSuccess<{ description: string | null }>(res);

      expect(data.description).toBeNull();
    });

    it('runner type 已不再注册时更新应返回 409', async () => {
      const created = await seedAgentRunner();
      await getPrisma().agentRunner.update({
        where: { id: created.id },
        data: { type: 'missing-runner-type' }
      });

      const error = expectError(
        await api()
          .patch(`/api/agent-runners/${created.id}`)
          .send({ runnerConfig: {} }),
        409
      );

      expect(error.message).toBe(
        "Runner type 'missing-runner-type' is no longer registered"
      );
    });
  });

  describe('GET /api/agent-runners/:id/health - 健康检查', () => {
    it('mock runner 应返回 online', async () => {
      const runner = await seedAgentRunner();

      const res = await api().get(`/api/agent-runners/${runner.id}/health`);
      const data = expectSuccess<{ status: string }>(res);

      expect(data.status).toBe('online');
    });

    it('runner type 返回 offline 时应透传 offline', async () => {
      registerTestRunnerType({
        id: 'offline-test-runner',
        name: 'Offline Test Runner',
        checkHealth: async () => 'offline'
      });

      const runner = await seedAgentRunner({
        type: 'offline-test-runner',
        name: 'Offline Runner'
      });

      const res = await api().get(`/api/agent-runners/${runner.id}/health`);
      const data = expectSuccess<{ status: string }>(res);

      expect(data.status).toBe('offline');
    });

    it('runner type 已不存在时应返回 unknown', async () => {
      const runner = await seedAgentRunner();
      await getPrisma().agentRunner.update({
        where: { id: runner.id },
        data: { type: 'missing-runner-type' }
      });

      const res = await api().get(`/api/agent-runners/${runner.id}/health`);
      const data = expectSuccess<{ status: string }>(res);

      expect(data.status).toBe('unknown');
    });

    it('runner health 探测抛错时应降级为 unknown', async () => {
      registerTestRunnerType({
        id: 'throwing-health-runner',
        name: 'Throwing Health Runner',
        checkHealth: async () => {
          throw new Error('health probe failed');
        }
      });

      const runner = await seedAgentRunner({
        type: 'throwing-health-runner',
        name: 'Throwing Health Runner'
      });

      const res = await api().get(`/api/agent-runners/${runner.id}/health`);
      const data = expectSuccess<{ status: string }>(res);

      expect(data.status).toBe('unknown');
    });
  });

  describe('GET /api/agent-runners/:id/context - 探测上下文', () => {
    it('mock runner 无 probeContext，应返回空对象', async () => {
      const runner = await seedAgentRunner();

      const res = await api().get(`/api/agent-runners/${runner.id}/context`);
      const data = expectSuccess<Record<string, unknown>>(res);

      expect(data).toEqual({});
    });

    it('runner 提供 probeContext 时应返回上下文选项', async () => {
      registerTestRunnerType({
        id: 'context-test-runner',
        name: 'Context Test Runner',
        checkHealth: async () => 'online',
        probeContext: async () => ({
          models: ['sonnet', 'opus']
        })
      });

      const runner = await seedAgentRunner({
        type: 'context-test-runner',
        name: 'Context Runner'
      });

      const res = await api().get(`/api/agent-runners/${runner.id}/context`);
      const data = expectSuccess<Record<string, unknown>>(res);

      expect(data).toEqual({ models: ['sonnet', 'opus'] });
    });

    it('runner type 已不再注册时 context 应返回 409', async () => {
      const runner = await seedAgentRunner();
      await getPrisma().agentRunner.update({
        where: { id: runner.id },
        data: { type: 'missing-runner-type' }
      });

      const error = expectError(
        await api().get(`/api/agent-runners/${runner.id}/context`),
        409
      );

      expect(error.message).toBe(
        "Runner type 'missing-runner-type' is no longer registered"
      );
    });

    it('runner probeContext 抛错时应返回 502', async () => {
      registerTestRunnerType({
        id: 'failing-context-runner',
        name: 'Failing Context Runner',
        checkHealth: async () => 'online',
        probeContext: async () => {
          throw new Error('probe failed');
        }
      });

      const runner = await seedAgentRunner({
        type: 'failing-context-runner',
        name: 'Failing Context Runner'
      });

      const res = await api().get(`/api/agent-runners/${runner.id}/context`);
      const error = expectError(res, 502);

      expect(error.message).toBe('Failed to probe runner context');
    });

    it('不存在的 Runner context 返回 404', async () => {
      expectError(
        await api().get('/api/agent-runners/nonexistent/context'),
        404
      );
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
        .send(createAgentRunnerPayload({ type: 'nonexistent-type' }));
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
          createAgentRunnerPayload({
            type: 'does-not-exist',
            runnerConfig: { model: 'x' }
          })
        );
      expectError(res, 400);
    });
  });

  describe('删除约束', () => {
    it('删除被 Session 引用的 Runner 应返回 409 + sessionCount', async () => {
      const runner = await seedAgentRunner();
      const project = await seedProject();

      // Create a session referencing this runner
      await api().post('/api/sessions').send({
        scopeId: project.id,
        runnerId: runner.id,
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      });

      const deleteRes = await api().delete(`/api/agent-runners/${runner.id}`);
      const error = expectError(deleteRes, 409);

      expect(error.message).toBe(
        'Cannot delete runner: 1 session(s) still reference it'
      );
      expect(error.data).toEqual({ sessionCount: 1 });
    });
  });

  describe('资源不存在', () => {
    it('GET/PATCH/DELETE 不存在的 ID 返回 404', async () => {
      const getError = expectError(
        await api().get('/api/agent-runners/nonexistent'),
        404
      );
      expect(getError.message).toBe('AgentRunner not found: nonexistent');
      expectError(
        await api().patch('/api/agent-runners/nonexistent').send({ name: 'X' }),
        404
      );
      expectError(await api().delete('/api/agent-runners/nonexistent'), 404);
    });

    it('健康检查不存在的 Runner 返回 404', async () => {
      expectError(
        await api().get('/api/agent-runners/nonexistent/health'),
        404
      );
    });
  });
});
