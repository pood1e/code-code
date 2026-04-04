import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { Profile } from '@agent-workbench/shared';

import { ApiRequestError } from '@/api/client';
import {
  createProfile,
  deleteProfile,
  listProfiles
} from '@/api/profiles';
import { useErrorMessage } from '@/hooks/use-error-message';
import { renderWithProviders } from '@/test/render';

import { ProfilesPage } from './ProfilesPage';

vi.mock('@/api/profiles', () => ({
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  listProfiles: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

function createProfileRecord(): Profile {
  return {
    id: 'profile-1',
    name: '默认 Profile',
    description: '常用资源组合',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderProfilesPage(route = '/profiles') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/profiles"
        element={
          <>
            <ProfilesPage />
            <RouteEcho />
          </>
        }
      />
      <Route path="/profiles/:profileId/edit" element={<RouteEcho />} />
    </Routes>,
    {
      route
    }
  );
}

describe('ProfilesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(vi.fn());
  });

  it('空列表时应展示空态，并支持新建 Profile 后进入编辑页', async () => {
    vi.mocked(listProfiles).mockResolvedValue([]);
    vi.mocked(createProfile).mockResolvedValue(createProfileRecord());

    const { user } = renderProfilesPage();

    expect(await screen.findByText('暂无 Profiles')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '新建 Profile'
      })
    );
    await user.type(screen.getByLabelText('Name'), '默认 Profile');
    await user.type(screen.getByLabelText('Description'), '常用资源组合');
    await user.click(
      screen.getByRole('button', {
        name: '新建'
      })
    );

    await waitFor(() => {
      expect(createProfile).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createProfile).mock.calls[0]?.[0]).toEqual({
        name: '默认 Profile',
        description: '常用资源组合'
      });
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/profiles/profile-1/edit'
      );
    });
  });

  it('有数据时点击名称应进入编辑页', async () => {
    vi.mocked(listProfiles)
      .mockResolvedValueOnce([createProfileRecord()])
      .mockResolvedValueOnce([]);
    vi.mocked(deleteProfile).mockResolvedValue(null);

    const { user } = renderProfilesPage();

    await user.click(
      await screen.findByRole('button', {
        name: '默认 Profile'
      })
    );
    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/profiles/profile-1/edit'
    );
  });

  it('确认删除 Profile 后应关闭确认弹窗', async () => {
    vi.mocked(listProfiles).mockResolvedValue([createProfileRecord()]);
    vi.mocked(deleteProfile).mockResolvedValue(null);

    const { user } = renderProfilesPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 默认 Profile'
      })
    );
    expect(screen.getByText('删除 默认 Profile？')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '删除'
      })
    );

    await waitFor(() => {
      expect(deleteProfile).toHaveBeenCalledTimes(1);
      expect(vi.mocked(deleteProfile).mock.calls[0]?.[0]).toBe('profile-1');
      expect(screen.queryByText('删除 默认 Profile？')).not.toBeInTheDocument();
    });
  });

  it('Profiles 查询失败时应通过 useErrorMessage 上报', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(listProfiles).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'profiles failed',
        data: null
      })
    );

    renderProfilesPage();

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError.mock.calls[0]?.[0]).toMatchObject({
        message: 'profiles failed'
      });
    });
  });

  it('删除 Profile 失败时应通过 useErrorMessage 上报', async () => {
    vi.mocked(listProfiles).mockResolvedValue([createProfileRecord()]);
    vi.mocked(deleteProfile).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'delete failed',
        data: null
      })
    );

    const { user } = renderProfilesPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 默认 Profile'
      })
    );
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(await screen.findByText('delete failed')).toBeInTheDocument();
    expect(screen.getByText('删除 默认 Profile？')).toBeInTheDocument();
  });

  it('创建 Profile 失败时应在弹窗内展示错误并保留表单', async () => {
    vi.mocked(listProfiles).mockResolvedValue([]);
    vi.mocked(createProfile).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'create failed',
        data: null
      })
    );

    const { user } = renderProfilesPage();

    expect(await screen.findByText('暂无 Profiles')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '新建 Profile' }));
    await user.type(screen.getByLabelText('Name'), '默认 Profile');
    await user.click(screen.getByRole('button', { name: '新建' }));

    expect(await screen.findByText('create failed')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('默认 Profile');
    expect(screen.getByRole('button', { name: '新建' })).toBeInTheDocument();
  });

  it('关闭创建弹窗后，应清空表单和上一次创建错误', async () => {
    vi.mocked(listProfiles).mockResolvedValue([createProfileRecord()]);
    vi.mocked(createProfile).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'create failed',
        data: null
      })
    );

    const { user } = renderProfilesPage();

    await user.click(
      await screen.findByRole('button', {
        name: '新建 Profile'
      })
    );
    await user.type(screen.getByLabelText('Name'), '默认 Profile');
    await user.click(screen.getByRole('button', { name: '新建' }));

    expect(await screen.findByText('create failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '新建 Profile' }));

    expect(screen.queryByText('create failed')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('创建 Profile 时名称为空，应展示字段校验错误并阻止提交', async () => {
    vi.mocked(listProfiles).mockResolvedValue([]);

    const { user } = renderProfilesPage();

    await user.click(
      await screen.findByRole('button', {
        name: '新建 Profile'
      })
    );
    await user.click(screen.getByRole('button', { name: '新建' }));

    expect(await screen.findByText('Profile name is required')).toBeInTheDocument();
    expect(createProfile).not.toHaveBeenCalled();
  });

  it('删除错误在关闭确认弹窗后应被清空', async () => {
    vi.mocked(listProfiles).mockResolvedValue([createProfileRecord()]);
    vi.mocked(deleteProfile).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'delete failed',
        data: null
      })
    );

    const { user } = renderProfilesPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 默认 Profile'
      })
    );
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(await screen.findByText('delete failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(
      screen.getByRole('button', {
        name: '删除 默认 Profile'
      })
    );

    expect(screen.queryByText('delete failed')).not.toBeInTheDocument();
  });
});
