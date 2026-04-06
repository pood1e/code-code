import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './client';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject
} from './projects';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

describe('projects api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应支持带名称和不带名称的项目列表查询', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: [{ id: 'project-1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'project-2' }] });

    await expect(listProjects('Demo')).resolves.toEqual([{ id: 'project-1' }]);
    await expect(listProjects()).resolves.toEqual([{ id: 'project-2' }]);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/projects', {
      params: { name: 'Demo' }
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/projects', {
      params: undefined
    });
  });

  it('应请求项目详情、创建、更新和删除', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { id: 'project-1' } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'project-2' } });
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { id: 'project-1' } });
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: null });

    await expect(getProject('project-1')).resolves.toEqual({ id: 'project-1' });
    await expect(
      createProject({
        name: 'Demo',
        repoGitUrl: 'git@github.com:demo/repo.git',
        workspaceRootPath: '/tmp/demo'
      })
    ).resolves.toEqual({ id: 'project-2' });
    await expect(
      updateProject('project-1', {
        name: 'Demo 2',
        repoGitUrl: 'git@github.com:demo/repo-2.git',
        workspaceRootPath: '/tmp/demo'
      })
    ).resolves.toEqual({ id: 'project-1' });
    await expect(deleteProject('project-1')).resolves.toBeNull();

    expect(apiClient.get).toHaveBeenCalledWith('/projects/project-1');
    expect(apiClient.post).toHaveBeenCalledWith('/projects', {
      name: 'Demo',
      repoGitUrl: 'git@github.com:demo/repo.git',
      workspaceRootPath: '/tmp/demo'
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/projects/project-1', {
      name: 'Demo 2',
      repoGitUrl: 'git@github.com:demo/repo-2.git',
      workspaceRootPath: '/tmp/demo'
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/projects/project-1');
  });
});
