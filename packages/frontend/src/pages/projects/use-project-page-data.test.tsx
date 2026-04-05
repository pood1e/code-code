import { screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@agent-workbench/shared';

import { listProjects } from '@/api/projects';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useProjectStore } from '@/store/project-store';
import { createTestQueryClient, renderWithProviders } from '@/test/render';

import { useProjectPageData } from './use-project-page-data';

vi.mock('@/api/projects', () => ({
  listProjects: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

function createProject(id: string, name: string): Project {
  return {
    id,
    name,
    description: `${name} description`,
    gitUrl: `git@github.com:example/${id}.git`,
    workspacePath: `/tmp/${id}`,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function HookProbe() {
  const {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects,
    goToProjectTab
  } = useProjectPageData();

  return (
    <div>
      <p>{id ?? 'no-project-id'}</p>
      <p>{project?.name ?? 'no-project'}</p>
      <p>{projects.length}</p>
      <p>{isLoading ? 'loading' : 'idle'}</p>
      <p>{isNotFound ? 'not-found' : 'found'}</p>
      <button type="button" onClick={goToProjects}>
        返回 Projects
      </button>
      <button
        type="button"
        onClick={() => goToProjectTab('project-2', 'dashboard')}
      >
        切换到 Beta 概览
      </button>
      <RouteEcho />
    </div>
  );
}

function renderHookProbe(route: string) {
  const queryClient = createTestQueryClient();

  return renderWithProviders(
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route
          path="/projects/:id/:tab"
          element={<HookProbe />}
        />
        <Route path="/projects" element={<RouteEcho />} />
      </Routes>
    </QueryClientProvider>,
    {
      route,
      queryClient
    }
  );
}

describe('useProjectPageData', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(vi.fn());
    useProjectStore.setState({ currentProjectId: null });
  });

  it('应根据当前路由同步 currentProject，并返回匹配到的 Project', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      createProject('project-1', 'Alpha'),
      createProject('project-2', 'Beta')
    ]);

    renderHookProbe('/projects/project-1/chats');

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('found')).toBeInTheDocument();
    expect(useProjectStore.getState().currentProjectId).toBe('project-1');
  });

  it('当前路由 Project 不存在时，应返回 not-found 状态', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      createProject('project-1', 'Alpha')
    ]);

    renderHookProbe('/projects/project-missing/config');

    expect(await screen.findByText('no-project')).toBeInTheDocument();
    expect(await screen.findByText('idle')).toBeInTheDocument();
    expect(screen.getByText('not-found')).toBeInTheDocument();
    expect(useProjectStore.getState().currentProjectId).toBe('project-missing');
  });

  it('goToProjects 和 goToProjectTab 应驱动路由跳转，并同步 currentProject', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      createProject('project-1', 'Alpha'),
      createProject('project-2', 'Beta')
    ]);

    const { user } = renderHookProbe('/projects/project-1/chats');

    await screen.findByText('Alpha');

    await user.click(
      screen.getByRole('button', {
        name: '切换到 Beta 概览'
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-2/dashboard'
      );
      expect(useProjectStore.getState().currentProjectId).toBe('project-2');
    });

    await user.click(
      screen.getByRole('button', {
        name: '返回 Projects'
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects'
      );
    });
  });
});
