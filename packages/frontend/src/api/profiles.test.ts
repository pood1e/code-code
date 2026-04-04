import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './client';
import {
  createProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  saveProfile
} from './profiles';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('profiles api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应请求 profile 列表和详情', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: [{ id: 'profile-1' }] })
      .mockResolvedValueOnce({ data: { id: 'profile-1' } });

    await expect(listProfiles()).resolves.toEqual([{ id: 'profile-1' }]);
    await expect(getProfile('profile-1')).resolves.toEqual({
      id: 'profile-1'
    });

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/profiles');
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/profiles/profile-1');
  });

  it('应请求创建、保存和删除 profile', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'profile-2' } });
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { id: 'profile-1' } });
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: null });

    await expect(
      createProfile({
        name: '默认配置',
        description: 'demo'
      })
    ).resolves.toEqual({ id: 'profile-2' });
    await expect(
      saveProfile('profile-1', {
        name: '默认配置',
        skills: [],
        mcps: [],
        rules: []
      })
    ).resolves.toEqual({ id: 'profile-1' });
    await expect(deleteProfile('profile-1')).resolves.toBeNull();

    expect(apiClient.post).toHaveBeenCalledWith('/profiles', {
      name: '默认配置',
      description: 'demo'
    });
    expect(apiClient.put).toHaveBeenCalledWith('/profiles/profile-1', {
      name: '默认配置',
      skills: [],
      mcps: [],
      rules: []
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/profiles/profile-1');
  });
});
