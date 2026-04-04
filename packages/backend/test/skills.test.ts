import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

import { setupTestApp, teardownTestApp, resetDatabase } from './setup';
import {
  api,
  expectSuccess,
  expectError,
  createSkillPayload,
  seedSkill,
  seedProfile
} from './helpers';

describe('Skills API', () => {
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

  describe('POST /api/skills - 创建 Skill', () => {
    it('应成功创建 Skill 并返回完整字段', async () => {
      const payload = createSkillPayload({ name: 'Web Search' });
      const res = await api().post('/api/skills').send(payload);
      const data = expectSuccess<{ id: string; name: string; content: string }>(
        res,
        201
      );

      expect(data.id).toBeDefined();
      expect(data.name).toBe('Web Search');
      expect(data.content).toBe(payload.content);
    });

    it('应支持可选的 description 为 null', async () => {
      const payload = createSkillPayload({ description: null });
      const res = await api().post('/api/skills').send(payload);
      const data = expectSuccess(res, 201) as { description: string | null };

      expect(data.description).toBeNull();
    });

    it('空白 description 应归一化为 null', async () => {
      const res = await api()
        .post('/api/skills')
        .send(createSkillPayload({ description: '   ' }));
      const data = expectSuccess(res, 201) as { description: string | null };

      expect(data.description).toBeNull();
    });
  });

  describe('GET /api/skills - 列表查询', () => {
    it('空数据库返回空数组', async () => {
      const res = await api().get('/api/skills');
      const data = expectSuccess<unknown[]>(res);

      expect(data).toEqual([]);
    });

    it('返回所有已创建的 Skills', async () => {
      await seedSkill({ name: 'Skill A' });
      await seedSkill({ name: 'Skill B' });

      const res = await api().get('/api/skills');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(2);
    });

    it('支持 name 过滤（模糊匹配）', async () => {
      await seedSkill({ name: 'Web Search' });
      await seedSkill({ name: 'Code Review' });

      const res = await api().get('/api/skills?name=Web');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Web Search');
    });

    it('name 过滤无匹配时返回空数组', async () => {
      await seedSkill({ name: 'Web Search' });

      const res = await api().get('/api/skills?name=NonExistent');
      const data = expectSuccess<unknown[]>(res);

      expect(data).toHaveLength(0);
    });

    it('name 仅为空白时不应误筛选', async () => {
      await seedSkill({ name: 'Web Search' });
      await seedSkill({ name: 'Code Review' });

      const res = await api().get('/api/skills?name=%20%20%20');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(2);
    });
  });

  describe('GET /api/skills/:id - 获取详情', () => {
    it('应返回完整的 Skill 详情', async () => {
      const created = await seedSkill({ name: 'Detail Test' });

      const res = await api().get(`/api/skills/${created.id}`);
      const data = expectSuccess<{
        id: string;
        name: string;
        content: string;
        createdAt: string;
        updatedAt: string;
      }>(res);

      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Detail Test');
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });
  });

  describe('PUT /api/skills/:id - 更新 Skill', () => {
    it('应成功更新 Skill 的 name 和 content', async () => {
      const created = await seedSkill();
      const updatePayload = createSkillPayload({
        name: 'Updated Skill',
        content: '# Updated Content'
      });

      const res = await api()
        .put(`/api/skills/${created.id}`)
        .send(updatePayload);
      const data = expectSuccess<{ name: string; content: string }>(res);

      expect(data.name).toBe('Updated Skill');
      expect(data.content).toBe('# Updated Content');
    });

    it('更新为空白 description 时应归一化为 null', async () => {
      const created = await seedSkill({ description: 'Has description' });

      const res = await api()
        .put(`/api/skills/${created.id}`)
        .send(createSkillPayload({ description: '  ' }));
      const data = expectSuccess<{ description: string | null }>(res);

      expect(data.description).toBeNull();
    });
  });

  describe('DELETE /api/skills/:id - 删除 Skill', () => {
    it('应成功删除未被引用的 Skill', async () => {
      const created = await seedSkill();

      const deleteRes = await api().delete(`/api/skills/${created.id}`);
      expectSuccess(deleteRes);

      // 确认已删除
      const getRes = await api().get(`/api/skills/${created.id}`);
      expectError(getRes, 404);
    });
  });

  // ---- 边界 & 错误场景 ----

  describe('验证错误', () => {
    it('name 为空字符串时返回 400', async () => {
      const res = await api()
        .post('/api/skills')
        .send(createSkillPayload({ name: '' }));
      expectError(res, 400);
    });

    it('name 超过 100 字符时返回 400', async () => {
      const res = await api()
        .post('/api/skills')
        .send(createSkillPayload({ name: 'A'.repeat(101) }));
      expectError(res, 400);
    });

    it('content 为空字符串时返回 400', async () => {
      const res = await api()
        .post('/api/skills')
        .send(createSkillPayload({ content: '' }));
      expectError(res, 400);
    });

    it('缺少必填字段 content 时返回 400', async () => {
      const res = await api()
        .post('/api/skills')
        .send({ name: 'Missing Content' });
      expectError(res, 400);
    });
  });

  describe('资源不存在', () => {
    it('GET 不存在的 ID 返回 404', async () => {
      const res = await api().get('/api/skills/nonexistent-id');
      const error = expectError(res, 404);
      expect(error.message).toBe('Skill not found: nonexistent-id');
    });

    it('PUT 不存在的 ID 返回 404', async () => {
      const res = await api()
        .put('/api/skills/nonexistent-id')
        .send(createSkillPayload());
      expectError(res, 404);
    });

    it('DELETE 不存在的 ID 返回 404', async () => {
      const res = await api().delete('/api/skills/nonexistent-id');
      expectError(res, 404);
    });
  });

  describe('引用冲突', () => {
    it('删除被 Profile 引用的 Skill 应返回 409', async () => {
      const skill = await seedSkill();
      const profile = await seedProfile();

      // Save profile with the skill
      await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [{ resourceId: skill.id, order: 0 }],
          mcps: [],
          rules: []
        });

      const deleteRes = await api().delete(`/api/skills/${skill.id}`);
      const error = expectError(deleteRes, 409);

      expect(error.data).toBeDefined();
      expect((error.data as { referencedBy: unknown[] }).referencedBy).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: profile.id, name: profile.name })
        ])
      );
    });
  });
});
