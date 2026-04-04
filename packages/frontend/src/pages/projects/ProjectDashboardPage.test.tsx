import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { ProjectDashboardPage } from './ProjectDashboardPage';
import { useProjectPageData } from './use-project-page-data';

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

function createProject(): Project {
  return {
    id: 'project-1',
    name: 'Workbench',
    description: 'Demo project',
    gitUrl: 'https://github.com/example/workbench.git',
    workspacePath: '/tmp/workbench',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderProjectDashboardPage() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/:id/dashboard"
        element={
          <>
            <ProjectDashboardPage />
            <RouteEcho />
          </>
        }
      />
      <Route path="/projects/:id/config" element={<RouteEcho />} />
      <Route path="/projects" element={<RouteEcho />} />
    </Routes>,
    {
      route: '/projects/project-1/dashboard'
    }
  );
}

describe('ProjectDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应展示概览占位内容，并可跳转到配置页', async () => {
    vi.mocked(useProjectPageData).mockReturnValue({
      id: 'project-1',
      project: createProject(),
      projects: [createProject()],
      isLoading: false,
      isNotFound: false,
      goToProjects: vi.fn(),
      goToProjectTab: vi.fn()
    });

    const { user } = renderProjectDashboardPage();

    expect(screen.getByText('概览敬请期待')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '前往配置页'
      })
    );

    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/projects/project-1/config'
    );
  });

  it('Project 不存在时应展示空态，并允许返回 Projects', async () => {
    const goToProjects = vi.fn();
    vi.mocked(useProjectPageData).mockReturnValue({
      id: 'project-missing',
      project: null,
      projects: [createProject()],
      isLoading: false,
      isNotFound: true,
      goToProjects,
      goToProjectTab: vi.fn()
    });

    const { user } = renderProjectDashboardPage();

    expect(screen.getByText('Project 不存在')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '返回 Projects'
      })
    );

    expect(goToProjects).toHaveBeenCalledTimes(1);
  });
});
