import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { ResourceRecord } from '@agent-workbench/shared';

import { ApiRequestError } from '@/api/client';
import { deleteResource, listResources } from '@/api/resources';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useUiStore } from '@/store/ui-store';
import { renderWithProviders } from '@/test/render';

import { ResourceListPage } from './ResourceListPage';

vi.mock('@/api/resources', () => ({
  deleteResource: vi.fn(),
  listResources: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

function createSkillResource(): ResourceRecord {
  return {
    id: 'skill-1',
    name: 'Skill One',
    description: '用于测试',
    content: '# Skill',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderSkillListPage(route = '/skills') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/skills"
        element={
          <>
            <ResourceListPage kind="skills" />
            <RouteEcho />
          </>
        }
      />
      <Route path="/skills/new" element={<RouteEcho />} />
      <Route path="/skills/:resourceId/edit" element={<RouteEcho />} />
    </Routes>,
    {
      route
    }
  );
}

describe('ResourceListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(vi.fn());
    useUiStore.setState({
      resourceSearch: {
        skills: '',
        mcps: '',
        rules: ''
      }
    });
  });

  it('空列表时应展示空态，并可进入新建页', async () => {
    vi.mocked(listResources).mockResolvedValue([]);
    const { user } = renderSkillListPage();

    expect(await screen.findByText('暂无 Skills')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '新建 Skill'
      })
    );

    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/skills/new'
    );
  });

  it('点击资源名称应进入编辑页', async () => {
    vi.mocked(listResources).mockResolvedValue([createSkillResource()]);
    const { user } = renderSkillListPage();

    await user.click(await screen.findByRole('button', { name: 'Skill One' }));

    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/skills/skill-1/edit'
    );
  });

  it('确认删除后应调用删除 API 并关闭确认弹窗', async () => {
    vi.mocked(listResources)
      .mockResolvedValueOnce([createSkillResource()])
      .mockResolvedValueOnce([]);
    vi.mocked(deleteResource).mockResolvedValue(null);
    const { user } = renderSkillListPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 Skill One'
      })
    );
    expect(screen.getByText('删除 Skill One？')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '删除'
      })
    );

    await waitFor(() => {
      expect(deleteResource).toHaveBeenCalledWith('skills', 'skill-1');
      expect(screen.queryByText('删除 Skill One？')).not.toBeInTheDocument();
    });
  });

  it('删除被 Profile 引用的资源时，应展示引用详情弹窗', async () => {
    vi.mocked(listResources).mockResolvedValue([createSkillResource()]);
    vi.mocked(deleteResource).mockRejectedValue(
      new ApiRequestError({
        code: 409,
        message: 'Skill 正被 Profile 引用',
        data: {
          referencedBy: [
            {
              id: 'profile-1',
              name: '默认 Profile'
            }
          ]
        }
      })
    );
    const { user } = renderSkillListPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 Skill One'
      })
    );
    await user.click(
      screen.getByRole('button', {
        name: '删除'
      })
    );

    expect(
      await screen.findByText('资源仍被 Profile 引用')
    ).toBeInTheDocument();
    expect(screen.getByText('Skill 正被 Profile 引用')).toBeInTheDocument();
    expect(screen.getByText('默认 Profile')).toBeInTheDocument();
    expect(screen.getByText('profile-1')).toBeInTheDocument();
  });

  it('资源列表查询失败时应通过 useErrorMessage 上报', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(listResources).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'list failed',
        data: null
      })
    );

    renderSkillListPage();

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError.mock.calls[0]?.[0]).toMatchObject({
        message: 'list failed'
      });
    });
  });

  it('删除普通失败时应通过 useErrorMessage 上报，而不是展示引用弹窗', async () => {
    vi.mocked(listResources).mockResolvedValue([createSkillResource()]);
    vi.mocked(deleteResource).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'delete failed',
        data: null
      })
    );

    const { user } = renderSkillListPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 Skill One'
      })
    );
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(await screen.findByText('delete failed')).toBeInTheDocument();
    expect(screen.queryByText('资源仍被 Profile 引用')).not.toBeInTheDocument();
    expect(screen.getByText('删除 Skill One？')).toBeInTheDocument();
  });

  it('搜索词存在但结果为空时，仍应展示搜索工具栏', async () => {
    useUiStore.setState({
      resourceSearch: {
        skills: 'Skill',
        mcps: '',
        rules: ''
      }
    });
    vi.mocked(listResources).mockResolvedValue([]);

    renderSkillListPage();

    expect(await screen.findByPlaceholderText('按名称搜索')).toHaveValue(
      'Skill'
    );
    expect(
      screen.getByRole('button', { name: '刷新 Skills' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '新建 Skill' })
    ).toBeInTheDocument();
  });

  it('点击刷新时应重新请求资源列表', async () => {
    vi.mocked(listResources).mockResolvedValue([createSkillResource()]);
    const { user } = renderSkillListPage();

    await screen.findByRole('button', { name: 'Skill One' });
    expect(listResources).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '刷新 Skills' }));

    await waitFor(() => {
      expect(listResources).toHaveBeenCalledTimes(2);
    });
  });

  it('409 冲突未返回引用详情时，应展示通用冲突提示', async () => {
    vi.mocked(listResources).mockResolvedValue([createSkillResource()]);
    vi.mocked(deleteResource).mockRejectedValue(
      new ApiRequestError({
        code: 409,
        message: 'Skill 正被 Profile 引用',
        data: null
      })
    );

    const { user } = renderSkillListPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 Skill One'
      })
    );
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(
      await screen.findByText(
        '当前冲突未返回引用详情，请先检查 Profiles 页面中的依赖关系。'
      )
    ).toBeInTheDocument();
  });

  it('删除错误在关闭确认弹窗后应被清空', async () => {
    vi.mocked(listResources).mockResolvedValue([createSkillResource()]);
    vi.mocked(deleteResource).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'delete failed',
        data: null
      })
    );

    const { user } = renderSkillListPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 Skill One'
      })
    );
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(await screen.findByText('delete failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(
      screen.getByRole('button', {
        name: '删除 Skill One'
      })
    );

    expect(screen.queryByText('delete failed')).not.toBeInTheDocument();
  });
});
