import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@agent-workbench/shared';

import {
  listAgentRunners,
  listAgentRunnerTypes
} from '@/api/agent-runners';
import { listProjects } from '@/api/projects';
import { listProfiles } from '@/api/profiles';
import { listResources } from '@/api/resources';
import { useProjectStore } from '@/store/project-store';
import { useUiStore } from '@/store/ui-store';
import { renderWithProviders } from '@/test/render';

import { AppLayout } from './AppLayout';

vi.mock('@/api/agent-runners', () => ({
  listAgentRunners: vi.fn(),
  listAgentRunnerTypes: vi.fn()
}));

vi.mock('@/api/projects', () => ({
  listProjects: vi.fn()
}));

vi.mock('@/api/profiles', () => ({
  listProfiles: vi.fn()
}));

vi.mock('@/api/resources', () => ({
  listResources: vi.fn()
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

function renderAppLayout(route: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/projects" element={<RouteEcho />} />
        <Route path="/skills" element={<RouteEcho />} />
        <Route path="/projects/:id/dashboard" element={<RouteEcho />} />
        <Route path="/projects/:id/sessions" element={<RouteEcho />} />
        <Route path="/projects/:id/config" element={<RouteEcho />} />
      </Route>
    </Routes>,
    {
      route
    }
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listProjects).mockResolvedValue([
      createProject('project-1', 'Alpha'),
      createProject('project-2', 'Beta')
    ]);
    vi.mocked(listResources).mockResolvedValue([]);
    vi.mocked(listProfiles).mockResolvedValue([]);
    vi.mocked(listAgentRunnerTypes).mockResolvedValue([]);
    vi.mocked(listAgentRunners).mockResolvedValue([]);
    useProjectStore.setState({ currentProjectId: 'project-1' });
    useUiStore.setState({
      sidebarCollapsed: false
    });
  });

  it('Project 页面应展示二级导航，且顺序为概览→会话→配置', async () => {
    const { user } = renderAppLayout('/projects/project-1/sessions');

    expect(await screen.findByLabelText('选择当前 Project')).toHaveValue(
      'project-1'
    );

    const dashboardButton = screen.getByRole('button', { name: '概览' });
    const sessionsButton = screen.getByRole('button', { name: '会话' });
    const configButton = screen.getByRole('button', { name: '配置' });

    expect(
      Boolean(
        dashboardButton.compareDocumentPosition(sessionsButton) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        sessionsButton.compareDocumentPosition(configButton) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    await user.click(dashboardButton);

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/dashboard'
      );
    });
  });

  it('资源页应展示资源二级导航；点击 Projects 应优先回到当前 Project 的 Dashboard', async () => {
    const { user } = renderAppLayout('/skills');

    expect(await screen.findByRole('button', { name: '资源库' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MCPs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profiles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Runners' })).toBeInTheDocument();
    expect(
      screen.queryByLabelText('选择当前 Project')
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Projects'
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/dashboard'
      );
    });
  });

  it('没有当前 Project 时，点击 Projects 应回到 Project 列表而不是伪造 Dashboard', async () => {
    useProjectStore.setState({ currentProjectId: null });

    const { user } = renderAppLayout('/skills');

    await user.click(
      screen.getByRole('button', {
        name: 'Projects'
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects'
      );
    });
  });

  it('在 Project 列表页切换当前 Project 时，默认应进入目标 Project 概览页', async () => {
    const { user } = renderAppLayout('/projects');

    const projectSelect = await screen.findByLabelText('选择当前 Project');
    await user.selectOptions(projectSelect, 'project-2');

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-2/dashboard'
      );
    });
  });

  it('切换当前 Project 选择器时，应保留当前 tab 语义并导航到目标 Project', async () => {
    const { user } = renderAppLayout('/projects/project-1/config');

    const projectSelect = await screen.findByLabelText('选择当前 Project');
    await user.selectOptions(projectSelect, 'project-2');

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-2/config'
      );
    });
  });

  it('收起侧栏后应隐藏文字标题，并切换成展开侧栏按钮', async () => {
    const { user } = renderAppLayout('/projects/project-1/dashboard');

    expect((await screen.findAllByText('Agent Workbench')).length).toBeGreaterThan(1);
    expect(
      screen.getByRole('button', { name: '收起侧栏' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '收起侧栏' }));

    await waitFor(() => {
      expect(screen.getAllByText('Agent Workbench')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: '展开侧栏' })
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText('选择当前 Project')
      ).not.toBeInTheDocument();
    });
  });

  it('移动端菜单打开后，选择资源导航应跳转并关闭菜单', async () => {
    const { user } = renderAppLayout('/projects/project-1/dashboard');

    await user.click(
      screen.getByRole('button', { name: '打开导航菜单' })
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '资源库' }));

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/skills'
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
