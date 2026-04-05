import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@agent-workbench/shared';

import { ApiRequestError } from '@/api/client';
import { deleteProject, updateProject } from '@/api/projects';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useProjectStore } from '@/store/project-store';
import { renderWithProviders } from '@/test/render';

import { ProjectConfigPage } from './ProjectConfigPage';
import { useProjectPageData } from './use-project-page-data';

vi.mock('@/api/projects', () => ({
  deleteProject: vi.fn(),
  updateProject: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

function createProject(): Project {
  return {
    id: 'project-1',
    name: 'Old Name',
    description: '旧描述',
    gitUrl: 'git@github.com:example/workbench.git',
    workspacePath: '/tmp/workbench',
    docSource: '/tmp/docs',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function mockProjectPageData(overrides?: Partial<ReturnType<typeof useProjectPageData>>) {
  vi.mocked(useProjectPageData).mockReturnValue({
    id: 'project-1',
    project: createProject(),
    projects: [createProject()],
    isLoading: false,
    isNotFound: false,
    goToProjects: vi.fn(),
    goToProjectTab: vi.fn(),
    ...overrides
  });
}

function renderProjectConfigPage() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/:id/config"
        element={
          <>
            <ProjectConfigPage />
            <RouteEcho />
          </>
        }
      />
      <Route path="/projects" element={<RouteEcho />} />
    </Routes>,
    {
      route: '/projects/project-1/config'
    }
  );
}

describe('ProjectConfigPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(vi.fn());
    mockProjectPageData();
    useProjectStore.setState({ currentProjectId: null });
  });

  it('编辑并保存 Project 配置后，应提交更新并保持当前 Project', async () => {
    vi.mocked(updateProject).mockResolvedValue({
      ...createProject(),
      name: 'New Name',
      workspacePath: '/tmp/new-workbench'
    });

    const { user } = renderProjectConfigPage();

    const nameInput = await screen.findByDisplayValue('Old Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const workspaceInput = screen.getByLabelText('Workspace Path');
    await user.clear(workspaceInput);
    await user.type(workspaceInput, '/tmp/new-workbench');

    await user.click(
      screen.getByRole('button', {
        name: '保存'
      })
    );

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledTimes(1);
      expect(vi.mocked(updateProject).mock.calls[0]?.[0]).toBe('project-1');
      expect(vi.mocked(updateProject).mock.calls[0]?.[1]).toEqual({
        name: 'New Name',
        description: '旧描述',
        workspacePath: '/tmp/new-workbench',
        docSource: '/tmp/docs'
      });
      expect(useProjectStore.getState().currentProjectId).toBe('project-1');
    });
  });

  it('保存遇到 workspacePath 400 错误时，应就地展示字段错误和失败提示', async () => {
    vi.mocked(updateProject).mockRejectedValue(
      new ApiRequestError({
        code: 400,
        message: 'workspacePath 必须是已存在的绝对目录',
        data: null
      })
    );

    const { user } = renderProjectConfigPage();

    await screen.findByDisplayValue('Old Name');

    await user.click(
      screen.getByRole('button', {
        name: '保存'
      })
    );

    const errorMessages = await screen.findAllByText(
      'workspacePath 必须是已存在的绝对目录'
    );

    expect(errorMessages).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent('保存失败');
  });

  it('保存遇到 docSource 400 错误时，应就地展示字段错误', async () => {
    vi.mocked(updateProject).mockRejectedValue(
      new ApiRequestError({
        code: 400,
        message: 'docSource does not exist or is not a directory',
        data: null
      })
    );

    const { user } = renderProjectConfigPage();

    await screen.findByDisplayValue('Old Name');
    await user.clear(screen.getByLabelText('文档地址'));
    await user.type(screen.getByLabelText('文档地址'), '/bad/docs');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(
      await screen.findAllByText(
        'docSource does not exist or is not a directory'
      )
    ).toHaveLength(2);
  });

  it('删除当前 Project 后，应回到 Projects 列表并清空当前 Project 状态', async () => {
    vi.mocked(deleteProject).mockResolvedValue(null);

    const { user } = renderProjectConfigPage();

    await user.click(
      screen.getByRole('button', {
        name: '删除 Project'
      })
    );
    await user.click(
      screen.getByRole('button', {
        name: '删除'
      })
    );

    await waitFor(() => {
      expect(deleteProject).toHaveBeenCalledTimes(1);
      expect(useProjectStore.getState().currentProjectId).toBeNull();
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects'
      );
    });
  });

  it('Project 不存在时应展示空态，并提供返回 Projects 操作', async () => {
    const goToProjects = vi.fn();
    mockProjectPageData({
      project: null,
      isNotFound: true,
      goToProjects
    });

    const { user } = renderProjectConfigPage();

    expect(screen.getByText('Project 不存在')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '返回 Projects'
      })
    );

    expect(goToProjects).toHaveBeenCalledTimes(1);
  });
});
