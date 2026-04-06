import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@agent-workbench/shared';

import { listProjects } from '@/api/projects';
import { useProjectStore } from '@/store/project-store';
import { renderWithProviders } from '@/test/render';

import { ProjectListPage } from './ProjectListPage';

vi.mock('@/api/projects', () => ({
  listProjects: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: () => vi.fn()
}));

vi.mock('@/pages/projects/ProjectCreateDialog', () => ({
  ProjectCreateDialog: ({
    open
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (open ? <div role="dialog">新建 Project 表单</div> : null)
}));

function createProjectRecord(id: string, name: string): Project {
  return {
    id,
    name,
    description: 'Project description',
    repoGitUrl: `git@github.com:acme/${id}.git`,
    workspaceRootPath: `/tmp/${id}`,
    docGitUrl: null,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

describe('ProjectListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({ currentProjectId: null });
  });

  it('没有 Project 时应展示空态，并可打开新建弹窗', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    const { user } = renderWithProviders(<ProjectListPage />);

    expect(await screen.findByText('暂无 Project')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '新建 Project' }));

    expect(screen.getByRole('dialog', { name: '' })).toHaveTextContent(
      '新建 Project 表单'
    );
  });

  it('应展示 Project 列表，点击项目后写入当前 Project 状态', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      createProjectRecord('project-1', 'Alpha'),
      createProjectRecord('project-2', 'Beta')
    ]);

    const { user } = renderWithProviders(<ProjectListPage />);

    await user.click(await screen.findByRole('button', { name: /Beta/ }));

    expect(useProjectStore.getState().currentProjectId).toBe('project-2');
  });

  it('当前 Project 应展示“当前”标记', async () => {
    useProjectStore.setState({ currentProjectId: 'project-1' });
    vi.mocked(listProjects).mockResolvedValue([
      createProjectRecord('project-1', 'Alpha')
    ]);

    renderWithProviders(<ProjectListPage />);

    expect(await screen.findByText('当前')).toBeInTheDocument();
  });
});
