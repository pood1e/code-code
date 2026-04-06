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
    it('应成功创建 Project（workspaceRootPath 为 /tmp）', async () => {
      const payload = createProjectPayload({ name: 'My Project' });
      const res = await api().post('/api/projects').send(payload);
      const data = expectSuccess<{
        id: string;
        name: string;
        repoGitUrl: string;
        workspaceRootPath: string;
      }>(res, 201);

      expect(data.id).toBeDefined();
      expect(data.name).toBe('My Project');
      expect(data.repoGitUrl).toBe(payload.repoGitUrl);
      expect(data.workspaceRootPath).toBe('/tmp');
    });

    it('空白 description 应归一化为 null', async () => {
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ description: '   ' }));
      const data = expectSuccess<{ description: string | null }>(res, 201);

      expect(data.description).toBeNull();
    });

    it('应支持保存 SSH 文档仓库地址', async () => {
      const docGitUrl = 'git@github.com:acme/workbench-docs.git';
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ docGitUrl }));
      const data = expectSuccess<{ docGitUrl?: string | null }>(res, 201);

      expect(data.docGitUrl).toBe(docGitUrl);
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

    it('name 仅为空白时不应误筛选', async () => {
      await seedProject({ name: 'Alpha' });
      await seedProject({ name: 'Beta' });

      const res = await api().get('/api/projects?name=%20%20%20');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(2);
    });
  });

  describe('GET /api/projects/:id - 获取详情', () => {
    it('应返回完整的 Project 详情', async () => {
      const created = await seedProject({ name: 'Detail' });

      const res = await api().get(`/api/projects/${created.id}`);
      const data = expectSuccess<{
        id: string;
        name: string;
        repoGitUrl: string;
        workspaceRootPath: string;
        createdAt: string;
        updatedAt: string;
      }>(res);

      expect(data.id).toBe(created.id);
      expect(data.createdAt).toBeDefined();
    });
  });

  describe('PATCH /api/projects/:id - 更新 Project', () => {
    it('应成功更新 name 和 workspaceRootPath', async () => {
      const created = await seedProject();

      const res = await api().patch(`/api/projects/${created.id}`).send({
        name: 'Updated Project',
        workspaceRootPath: '/tmp'
      });
      const data = expectSuccess<{ name: string; workspaceRootPath: string }>(res);

      expect(data.name).toBe('Updated Project');
      expect(data.workspaceRootPath).toBe('/tmp');
    });

    it('应支持仅更新 name，并保留其他字段', async () => {
      const created = await seedProject({
        name: 'Original Project',
        description: 'Original description',
        workspaceRootPath: '/tmp'
      });

      const res = await api().patch(`/api/projects/${created.id}`).send({
        name: 'Renamed Project'
      });
      const data = expectSuccess<{
        name: string;
        description: string | null;
        workspaceRootPath: string;
      }>(res);

      expect(data.name).toBe('Renamed Project');
      expect(data.description).toBe('Original description');
      expect(data.workspaceRootPath).toBe('/tmp');
    });

    it('应支持仅更新 workspaceRootPath', async () => {
      const created = await seedProject({
        name: 'Workspace Project',
        description: 'Keep description'
      });

      const res = await api().patch(`/api/projects/${created.id}`).send({
        workspaceRootPath: '/tmp'
      });
      const data = expectSuccess<{
        name: string;
        description: string | null;
        workspaceRootPath: string;
      }>(res);

      expect(data.name).toBe('Workspace Project');
      expect(data.description).toBe('Keep description');
      expect(data.workspaceRootPath).toBe('/tmp');
    });

    it('description 传 null 时应清空描述', async () => {
      const created = await seedProject({
        description: 'Will be cleared'
      });

      const res = await api().patch(`/api/projects/${created.id}`).send({
        description: null
      });
      const data = expectSuccess<{ description: string | null }>(res);

      expect(data.description).toBeNull();
    });

    it('应支持仅更新文档仓库地址', async () => {
      const created = await seedProject();

      const res = await api().patch(`/api/projects/${created.id}`).send({
        docGitUrl: 'git@github.com:acme/docs.git'
      });
      const data = expectSuccess<{ docGitUrl?: string | null }>(res);

      expect(data.docGitUrl).toBe('git@github.com:acme/docs.git');
    });

    it('应支持更新 repoGitUrl', async () => {
      const created = await seedProject();

      const res = await api().patch(`/api/projects/${created.id}`).send({
        repoGitUrl: 'git@github.com:acme/updated.git'
      });
      const data = expectSuccess<{ repoGitUrl: string }>(res);

      expect(data.repoGitUrl).toBe('git@github.com:acme/updated.git');
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

  describe('workspaceRootPath 验证', () => {
    it('相对路径返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ workspaceRootPath: './relative/path' }));
      expectError(res, 400);
    });

    it('不存在的目录返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(
          createProjectPayload({
            workspaceRootPath: '/nonexistent/path/that/surely/does/not/exist'
          })
        );
      expectError(res, 400);
    });

    it('指向文件而非目录返回 400', async () => {
      // /etc/hosts is a file, not a directory
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ workspaceRootPath: '/etc/hosts' }));
      expectError(res, 400);
    });
  });

  describe('docGitUrl 验证', () => {
    it('本地目录返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ docGitUrl: '/tmp/docs' }));
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

    it('repoGitUrl 为空时返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ repoGitUrl: '' }));
      expectError(res, 400);
    });

    it('name 超过 100 字符时返回 400', async () => {
      const res = await api()
        .post('/api/projects')
        .send(createProjectPayload({ name: 'X'.repeat(101) }));
      expectError(res, 400);
    });

    it('PATCH 空 payload 返回 400', async () => {
      const created = await seedProject();

      const error = expectError(
        await api().patch(`/api/projects/${created.id}`).send({}),
        400
      );

      expect(error.message).toContain('At least one project field must be provided');
    });
  });

  describe('资源不存在', () => {
    it('GET/PATCH/DELETE 不存在的 ID 返回 404', async () => {
      expectError(await api().get('/api/projects/nonexistent'), 404);
      expectError(
        await api()
          .patch('/api/projects/nonexistent')
          .send({ name: 'X', workspaceRootPath: '/tmp' }),
        404
      );
      expectError(await api().delete('/api/projects/nonexistent'), 404);
    });
  });
});
