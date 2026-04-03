import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

import { setupTestApp, teardownTestApp, resetDatabase } from './setup';
import {
  api,
  expectSuccess,
  expectError,
  createMcpPayload,
  seedMcp,
  seedProfile
} from './helpers';

describe('MCPs API', () => {
  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  // ---- CRUD 正常路径 ----

  describe('POST /api/mcps - 创建 MCP', () => {
    it('应成功创建 MCP 并返回 JSON content', async () => {
      const payload = createMcpPayload({ name: 'FS MCP' });
      const res = await api().post('/api/mcps').send(payload);
      const data = expectSuccess<{
        id: string;
        name: string;
        content: { type: string; command: string; args: string[] };
      }>(res, 201);

      expect(data.id).toBeDefined();
      expect(data.name).toBe('FS MCP');
      expect(data.content).toEqual(payload.content);
    });

    it('应支持 content.env 环境变量', async () => {
      const payload = createMcpPayload({
        content: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@mcp/test'],
          env: { LOG_LEVEL: 'debug', NODE_ENV: 'test' }
        }
      });
      const res = await api().post('/api/mcps').send(payload);
      const data = expectSuccess<{
        content: { env: Record<string, string> };
      }>(res, 201);

      expect(data.content.env).toEqual({
        LOG_LEVEL: 'debug',
        NODE_ENV: 'test'
      });
    });
  });

  describe('GET /api/mcps - 列表查询', () => {
    it('支持 name 过滤', async () => {
      await seedMcp({ name: 'Filesystem MCP' });
      await seedMcp({ name: 'Browser MCP' });

      const res = await api().get('/api/mcps?name=File');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Filesystem MCP');
    });
  });

  describe('GET /api/mcps/:id - 获取详情', () => {
    it('应返回完整的 MCP 详情', async () => {
      const created = await seedMcp();

      const res = await api().get(`/api/mcps/${created.id}`);
      const data = expectSuccess<{
        id: string;
        content: { type: string; command: string };
      }>(res);

      expect(data.id).toBe(created.id);
      expect(data.content.type).toBe('stdio');
    });
  });

  describe('PUT /api/mcps/:id - 更新 MCP', () => {
    it('应成功更新 args', async () => {
      const created = await seedMcp();

      const updatePayload = createMcpPayload({
        content: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@mcp/updated', '/new-path']
        }
      });
      const res = await api()
        .put(`/api/mcps/${created.id}`)
        .send(updatePayload);
      const data = expectSuccess<{
        content: { args: string[] };
      }>(res);

      expect(data.content.args).toEqual(['-y', '@mcp/updated', '/new-path']);
    });
  });

  describe('DELETE /api/mcps/:id - 删除 MCP', () => {
    it('应成功删除未被引用的 MCP', async () => {
      const created = await seedMcp();
      expectSuccess(await api().delete(`/api/mcps/${created.id}`));
      expectError(await api().get(`/api/mcps/${created.id}`), 404);
    });

    it('删除被 Profile 引用的 MCP 应返回 409', async () => {
      const mcp = await seedMcp();
      const profile = await seedProfile();

      await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [],
          mcps: [{ resourceId: mcp.id, order: 0 }],
          rules: []
        });

      expectError(await api().delete(`/api/mcps/${mcp.id}`), 409);
    });
  });

  // ---- 边界 & 错误场景（MCP 特有验证） ----

  describe('MCP content 验证', () => {
    it('content.type 非 "stdio" 时返回 400', async () => {
      const res = await api()
        .post('/api/mcps')
        .send(
          createMcpPayload({
            content: { type: 'http', command: 'curl', args: [] }
          })
        );
      expectError(res, 400);
    });

    it('content.command 为空时返回 400', async () => {
      const res = await api()
        .post('/api/mcps')
        .send(
          createMcpPayload({
            content: { type: 'stdio', command: '', args: [] }
          })
        );
      expectError(res, 400);
    });

    it('content.args 包含纯空白字符串时返回 400', async () => {
      const res = await api()
        .post('/api/mcps')
        .send(
          createMcpPayload({
            content: { type: 'stdio', command: 'echo', args: ['  ', 'valid'] }
          })
        );
      expectError(res, 400);
    });

    it('content.env 值为非字符串时返回 400', async () => {
      const res = await api()
        .post('/api/mcps')
        .send(
          createMcpPayload({
            content: {
              type: 'stdio',
              command: 'echo',
              args: ['ok'],
              env: { LEVEL: 123 }
            }
          })
        );
      expectError(res, 400);
    });

    it('缺少 content 字段时返回 400', async () => {
      const res = await api()
        .post('/api/mcps')
        .send({ name: 'No Content MCP' });
      expectError(res, 400);
    });
  });

  describe('资源不存在', () => {
    it('GET/PUT/DELETE 不存在的 ID 返回 404', async () => {
      expectError(await api().get('/api/mcps/nonexistent'), 404);
      expectError(
        await api().put('/api/mcps/nonexistent').send(createMcpPayload()),
        404
      );
      expectError(await api().delete('/api/mcps/nonexistent'), 404);
    });
  });
});
