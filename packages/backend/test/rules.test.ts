import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

import { setupTestApp, teardownTestApp, resetDatabase } from './setup';
import {
  api,
  expectSuccess,
  expectError,
  createRulePayload,
  seedRule,
  seedProfile
} from './helpers';

describe('Rules API', () => {
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

  describe('POST /api/rules - 创建 Rule', () => {
    it('应成功创建 Rule', async () => {
      const payload = createRulePayload({ name: 'Cite Sources' });
      const res = await api().post('/api/rules').send(payload);
      const data = expectSuccess<{ id: string; name: string }>(res, 201);

      expect(data.id).toBeDefined();
      expect(data.name).toBe('Cite Sources');
    });
  });

  describe('GET /api/rules - 列表查询', () => {
    it('支持 name 模糊过滤', async () => {
      await seedRule({ name: 'Always Cite' });
      await seedRule({ name: 'No Guessing' });

      const res = await api().get('/api/rules?name=Cite');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Always Cite');
    });
  });

  describe('GET /api/rules/:id - 获取详情', () => {
    it('应返回完整的 Rule 详情', async () => {
      const created = await seedRule({ name: 'Detail Rule' });

      const res = await api().get(`/api/rules/${created.id}`);
      const data = expectSuccess<{ id: string; name: string }>(res);

      expect(data.id).toBe(created.id);
    });
  });

  describe('PUT /api/rules/:id - 更新 Rule', () => {
    it('应成功更新 Rule', async () => {
      const created = await seedRule();

      const res = await api()
        .put(`/api/rules/${created.id}`)
        .send(createRulePayload({ name: 'Updated Rule', content: '## New' }));
      const data = expectSuccess<{ name: string }>(res);

      expect(data.name).toBe('Updated Rule');
    });
  });

  describe('DELETE /api/rules/:id - 删除 Rule', () => {
    it('应成功删除未被引用的 Rule', async () => {
      const created = await seedRule();

      expectSuccess(await api().delete(`/api/rules/${created.id}`));
      expectError(await api().get(`/api/rules/${created.id}`), 404);
    });

    it('删除被 Profile 引用的 Rule 应返回 409', async () => {
      const rule = await seedRule();
      const profile = await seedProfile();

      await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [],
          mcps: [],
          rules: [{ resourceId: rule.id, order: 0 }]
        });

      const deleteRes = await api().delete(`/api/rules/${rule.id}`);
      expectError(deleteRes, 409);
    });
  });

  // ---- 边界 & 错误场景 ----

  describe('验证错误', () => {
    it('name 为空时返回 400', async () => {
      const res = await api()
        .post('/api/rules')
        .send(createRulePayload({ name: '' }));
      expectError(res, 400);
    });

    it('content 为空时返回 400', async () => {
      const res = await api()
        .post('/api/rules')
        .send(createRulePayload({ content: '' }));
      expectError(res, 400);
    });
  });

  describe('资源不存在', () => {
    it('GET/PUT/DELETE 不存在的 ID 返回 404', async () => {
      expectError(await api().get('/api/rules/nonexistent'), 404);
      expectError(
        await api().put('/api/rules/nonexistent').send(createRulePayload()),
        404
      );
      expectError(await api().delete('/api/rules/nonexistent'), 404);
    });
  });
});
