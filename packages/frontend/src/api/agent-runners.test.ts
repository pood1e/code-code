import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './client';
import {
  checkAgentRunnerHealth,
  createAgentRunner,
  deleteAgentRunner,
  getAgentRunner,
  listAgentRunners,
  listAgentRunnerTypes,
  probeAgentRunnerContext,
  updateAgentRunner
} from './agent-runners';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

describe('agent-runners api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应请求 runner types 列表', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [{ type: 'mock' }]
    });

    await expect(listAgentRunnerTypes()).resolves.toEqual([{ type: 'mock' }]);

    expect(apiClient.get).toHaveBeenCalledWith('/agent-runner-types');
  });

  it('应按名称过滤或返回全部 runner 列表', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: [{ id: 'runner-1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'runner-2' }] });

    await expect(listAgentRunners('Qwen')).resolves.toEqual([
      { id: 'runner-1' }
    ]);
    await expect(listAgentRunners()).resolves.toEqual([{ id: 'runner-2' }]);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/agent-runners', {
      params: { name: 'Qwen' }
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/agent-runners', {
      params: undefined
    });
  });

  it('应请求 runner 详情、创建、更新和删除', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { id: 'runner-1' } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'runner-2' } });
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { id: 'runner-1' } });
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: null });

    await expect(getAgentRunner('runner-1')).resolves.toEqual({
      id: 'runner-1'
    });
    await expect(
      createAgentRunner({
        name: 'Qwen',
        type: 'qwen',
        runnerConfig: {}
      })
    ).resolves.toEqual({ id: 'runner-2' });
    await expect(
      updateAgentRunner('runner-1', {
        name: 'Qwen',
        runnerConfig: {}
      })
    ).resolves.toEqual({ id: 'runner-1' });
    await expect(deleteAgentRunner('runner-1')).resolves.toBeNull();

    expect(apiClient.get).toHaveBeenCalledWith('/agent-runners/runner-1');
    expect(apiClient.post).toHaveBeenCalledWith('/agent-runners', {
      name: 'Qwen',
      type: 'qwen',
      runnerConfig: {}
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/agent-runners/runner-1', {
      name: 'Qwen',
      runnerConfig: {}
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/agent-runners/runner-1');
  });

  it('应请求 runner 健康状态和上下文探测', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { status: 'online' } })
      .mockResolvedValueOnce({
        data: { shell: [{ label: 'zsh', value: 'zsh' }] }
      });

    await expect(checkAgentRunnerHealth('runner-1')).resolves.toEqual({
      status: 'online'
    });
    await expect(probeAgentRunnerContext('runner-1')).resolves.toEqual({
      shell: [{ label: 'zsh', value: 'zsh' }]
    });

    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      '/agent-runners/runner-1/health'
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      '/agent-runners/runner-1/context'
    );
  });
});
