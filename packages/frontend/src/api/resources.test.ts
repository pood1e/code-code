import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './client';
import {
  createResource,
  deleteResource,
  getResource,
  listResources,
  saveResource,
  saveResourceByKind,
  updateResource
} from './resources';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('resources api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应支持带名称和不带名称的资源列表查询', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: [{ id: 'skill-1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'mcp-1' }] });

    await expect(listResources('skills', 'search')).resolves.toEqual([
      { id: 'skill-1' }
    ]);
    await expect(listResources('mcps')).resolves.toEqual([{ id: 'mcp-1' }]);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/skills', {
      params: { name: 'search' }
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/mcps', {
      params: undefined
    });
  });

  it('应请求资源详情、创建、更新和删除', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { id: 'rule-1' } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'rule-2' } });
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { id: 'rule-1' } });
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: null });

    await expect(getResource('rules', 'rule-1')).resolves.toEqual({
      id: 'rule-1'
    });
    await expect(
      createResource('rules', {
        name: 'rule',
        content: 'content'
      })
    ).resolves.toEqual({ id: 'rule-2' });
    await expect(
      updateResource('rules', 'rule-1', {
        name: 'rule',
        content: 'next'
      })
    ).resolves.toEqual({ id: 'rule-1' });
    await expect(deleteResource('rules', 'rule-1')).resolves.toBeNull();

    expect(apiClient.get).toHaveBeenCalledWith('/rules/rule-1');
    expect(apiClient.post).toHaveBeenCalledWith('/rules', {
      name: 'rule',
      content: 'content'
    });
    expect(apiClient.put).toHaveBeenCalledWith('/rules/rule-1', {
      name: 'rule',
      content: 'next'
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/rules/rule-1');
  });

  it('saveResource 应为 skill 选择创建或更新路径', async () => {
    const payload = {
      name: 'skill',
      content: 'content'
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'created' } });
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { id: 'updated' } });

    await expect(saveResource('skills', payload)).resolves.toEqual({
      id: 'created'
    });
    await expect(saveResource('skills', payload, 'skill-1')).resolves.toEqual({
      id: 'updated'
    });

    expect(apiClient.post).toHaveBeenCalledWith('/skills', payload);
    expect(apiClient.put).toHaveBeenCalledWith('/skills/skill-1', payload);
  });

  it('saveResource 应为 mcp 选择创建或更新路径', async () => {
    const payload = {
      name: 'mcp',
      content: {
        type: 'stdio' as const,
        command: 'qwen',
        args: ['--help']
      }
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'created' } });
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { id: 'updated' } });

    await expect(saveResource('mcps', payload)).resolves.toEqual({
      id: 'created'
    });
    await expect(saveResource('mcps', payload, 'mcp-1')).resolves.toEqual({
      id: 'updated'
    });

    expect(apiClient.post).toHaveBeenCalledWith('/mcps', payload);
    expect(apiClient.put).toHaveBeenCalledWith('/mcps/mcp-1', payload);
  });

  it('saveResource 应为 rule 选择创建或更新路径', async () => {
    const payload = {
      name: 'rule',
      content: 'content'
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'created' } });
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { id: 'updated' } });

    await expect(saveResource('rules', payload)).resolves.toEqual({
      id: 'created'
    });
    await expect(saveResource('rules', payload, 'rule-1')).resolves.toEqual({
      id: 'updated'
    });

    expect(apiClient.post).toHaveBeenCalledWith('/rules', payload);
    expect(apiClient.put).toHaveBeenCalledWith('/rules/rule-1', payload);
  });

  it('saveResourceByKind 应透传到对应 kind 的保存逻辑', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { id: 'skill-1' } })
      .mockResolvedValueOnce({ data: { id: 'mcp-1' } })
      .mockResolvedValueOnce({ data: { id: 'rule-1' } });

    await expect(
      saveResourceByKind.skills({
        name: 'skill',
        content: 'content'
      })
    ).resolves.toEqual({ id: 'skill-1' });
    await expect(
      saveResourceByKind.mcps({
        name: 'mcp',
        content: {
          type: 'stdio',
          command: 'qwen',
          args: ['--help']
        }
      })
    ).resolves.toEqual({ id: 'mcp-1' });
    await expect(
      saveResourceByKind.rules({
        name: 'rule',
        content: 'content'
      })
    ).resolves.toEqual({ id: 'rule-1' });

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/skills', {
      name: 'skill',
      content: 'content'
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/mcps', {
      name: 'mcp',
      content: {
        type: 'stdio',
        command: 'qwen',
        args: ['--help']
      }
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(3, '/rules', {
      name: 'rule',
      content: 'content'
    });
  });
});
