import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

import { setupTestApp, teardownTestApp, resetDatabase } from './setup';
import {
  api,
  expectSuccess,
  expectError,
  createProjectPayload,
  seedProject
} from './helpers';

describe('Projects API', () => {
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

  describe('POST /api/projects - 创建 Project', () => {
    it('应成功创建 Project（workspacePath 为 /tmp）', async () => {
      const payload = createProjectPayload({ name: 'My Project' });
      const res = await api().post('/api/projects').send(payload);
      const data = expectSuccess<{
        id: string;
        name: string;
        gitUrl: string;
        workspacePath: string;
      }>(res, 201);

      expect(data.id).toBeDefined();
      expect(data.name).toBe('My Project');
      expect(data.gitUrl).toBe(payload.gitUrl);
      expect(data.workspacePath).toBe('/tmp');
    });
  });

  describe('GET /api/projects - 列表查询', () => {
    it('返回所有 Projects', async () => {
      await seedProject({ name: 'Project A' });
      await seedProject({ name: 'Project B' });

      const res = await api().get('/api/projects');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(2);
    });

    it('支持 name 过滤', async () => {
      await seedProject({ name: 'Alpha' });
      await seedProject({ name: 'Beta' });

      const res = await api().get('/api/projects?name=Alp');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Alpha');
    });
  });

  describe('GET /api/projects/:id - 获取详情', () => {
    it('应返回完整的 Project 详情', async () => {
      const created = await seedProject({ name: 'Detail' });

      const res = await api().get(`/api/projects/${created.id}`);
      const data = expectSuccess<{
        id: string;
        name: string;
        gitUrl: string;
        workspacePath: string;
        createdAt: string;
        updatedAt: string;
      }>(res);

      expect(data.id).toBe(created.id);
      expect(data.createdAt).toBeDefined();
    });
  });

  describe('PATCH /api/projects/:id - 更新 Project', () => {
    it('应成功更新 name 和 workspacePath', async () => {
      const created = await seedProject();

      const res = await api().patch(`/api/projects/${created.id}`).send({
        name: 'Updated Project',
        workspacePath: '/tmp'
      });
      const data = expectSuccess<{ name: string; workspacePath: string }>(res);

      expect(data.name).toBe('Updated Project');
      expect(data.workspacePath).toBe('/tmp');
    });
  });

  describe('DELETE /api/projects/:id - 删除 Project', () => {
    it('应成功删除 Project', async () => {
      const created = await seedProject();

      expectSuccess(await api().delete(`/api/projects/${created.id}`));
      expectError(await api().get(`/api/projects/${created.id}`), 404);
    });
  });

  // ---- 边界 & 错误场景 ----

  describe('workspacePath 验证', () => {
    it('相对路径返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ workspacePath: './relative/path' }));
      expectError(res, 400);
    });

    it('不存在的目录返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(
          createProjectPayload({
            workspacePath: '/nonexistent/path/that/surely/does/not/exist'
          })
        );
      expectError(res, 400);
    });

    it('指向文件而非目录返回 400', async () => {
      // /etc/hosts is a file, not a directory
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ workspacePath: '/etc/hosts' }));
      expectError(res, 400);
    });
  });

  describe('字段验证', () => {
    it('name 为空时返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ name: '' }));
      expectError(res, 400);
    });

    it('gitUrl 为空时返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ gitUrl: '' }));
      expectError(res, 400);
    });

    it('name 超过 100 字符时返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ name: 'X'.repeat(101) }));
      expectError(res, 400);
    });
  });

  describe('资源不存在', () => {
    it('GET/PATCH/DELETE 不存在的 ID 返回 404', async () => {
      expectError(await api().get('/api/projects/nonexistent'), 404);
      expectError(
        await api()
          .patch('/api/projects/nonexistent')
          .send({ name: 'X', workspacePath: '/tmp' }),
        404
      );
      expectError(await api().delete('/api/projects/nonexistent'), 404);
    });
  });
});
