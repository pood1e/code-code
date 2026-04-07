import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '@/test/render';

import { App } from './App';

vi.mock('./layout/AppLayout', () => ({
  AppLayout: () => (
    <div>
      <p>App Layout</p>
      <Outlet />
    </div>
  )
}));

vi.mock('./pages/projects/ProjectListPage', () => ({
  ProjectListPage: () => <p>Project List Page</p>
}));

vi.mock('./pages/projects/ProjectConfigPage', () => ({
  ProjectConfigPage: () => <p>Project Config Page</p>
}));

vi.mock('./pages/projects/ProjectDashboardPage', () => ({
  ProjectDashboardPage: () => <p>Project Dashboard Page</p>
}));

vi.mock('./pages/projects/ProjectResourcesPage', () => ({
  ProjectResourcesPage: () => <p>Project Resources Page</p>
}));

vi.mock('./pages/projects/ProjectGovernancePage', () => ({
  ProjectGovernancePage: () => <p>Project Governance Page</p>
}));

vi.mock('./pages/projects/ProjectReviewsPage', () => ({
  ProjectReviewsPage: () => <p>Project Reviews Page</p>
}));

vi.mock('./pages/projects/ProjectSessionsPage', () => ({
  ProjectSessionsPage: () => {
    const location = useLocation();
    return <p>Project Sessions Page: {location.pathname}</p>;
  }
}));

vi.mock('./pages/resources/ResourceListPage', () => ({
  ResourceListPage: ({ kind }: { kind: string }) => <p>Resource List: {kind}</p>
}));

vi.mock('./pages/resources/ResourceEditPage', () => ({
  ResourceEditPage: ({ kind }: { kind: string }) => <p>Resource Edit: {kind}</p>
}));

vi.mock('./pages/profiles/ProfilesPage', () => ({
  ProfilesPage: () => <p>Profiles Page</p>
}));

vi.mock('./pages/profiles/ProfileEditorPage', () => ({
  ProfileEditorPage: () => <p>Profile Editor Page</p>
}));

vi.mock('./pages/agent-runners/AgentRunnerListPage', () => ({
  AgentRunnerListPage: () => <p>Agent Runner List Page</p>
}));

vi.mock('./pages/agent-runners/AgentRunnerEditorPage', () => ({
  AgentRunnerEditorPage: () => <p>Agent Runner Editor Page</p>
}));

function renderApp(route: string) {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App', () => {
  it('根路径应重定向到 Projects 列表', async () => {
    renderApp('/');

    expect(await screen.findByText('Project List Page')).toBeInTheDocument();
    expect(screen.getByText('App Layout')).toBeInTheDocument();
  });

  it('chat 深链路由应命中 ProjectSessionsPage', async () => {
    renderApp('/projects/project-1/chats/chat-1');

    expect(
      await screen.findByText(
        'Project Sessions Page: /projects/project-1/chats/chat-1'
      )
    ).toBeInTheDocument();
  });

  it('Project dashboard/config 路由应命中对应懒加载页面', async () => {
    renderApp('/projects/project-1/dashboard');
    expect(await screen.findByText('Project Dashboard Page')).toBeInTheDocument();

    renderApp('/projects/project-1/config');
    expect(await screen.findByText('Project Config Page')).toBeInTheDocument();
  });

  it('Project reviews 路由应命中审核队列页面', async () => {
    renderApp('/projects/project-1/reviews');

    expect(await screen.findByText('Project Reviews Page')).toBeInTheDocument();
  });

  it('Project resources/governance 路由应命中对应页面', async () => {
    renderApp('/projects/project-1/resources');
    expect(await screen.findByText('Project Resources Page')).toBeInTheDocument();

    renderApp('/projects/project-1/governance');
    expect(await screen.findByText('Project Governance Page')).toBeInTheDocument();
  });

  it('资源新建路由应命中对应 kind 的编辑页', async () => {
    renderApp('/skills/new');

    expect(await screen.findByText('Resource Edit: skills')).toBeInTheDocument();
  });

  it('Profile 编辑路由应命中编辑页', async () => {
    renderApp('/profiles/profile-1/edit');

    expect(await screen.findByText('Profile Editor Page')).toBeInTheDocument();
  });

  it('AgentRunner 编辑路由应命中编辑页', async () => {
    renderApp('/agent-runners/runner-1/edit');

    expect(
      await screen.findByText('Agent Runner Editor Page')
    ).toBeInTheDocument();
  });
});
