import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { ProjectSectionHeader } from './ProjectSectionHeader';

function createProject(id: string, name: string): Project {
  return {
    id,
    name,
    description: null,
    gitUrl: `git@github.com:example/${id}.git`,
    workspacePath: `/workspace/${id}`,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

describe('ProjectSectionHeader', () => {
  it('应展示当前项目选择器和中文 tab，并支持切换项目与 tab', async () => {
    const onProjectChange = vi.fn();
    const onTabChange = vi.fn();
    const { user } = renderWithProviders(
      <ProjectSectionHeader
        projects={[
          createProject('project-1', 'Project One'),
          createProject('project-2', 'Project Two')
        ]}
        currentProjectId="project-1"
        activeTab="chats"
        onProjectChange={onProjectChange}
        onTabChange={onTabChange}
      />
    );

    const projectSelect = screen.getByRole('combobox', {
      name: '选择当前 Project'
    });
    expect(projectSelect).toHaveValue('project-1');
    expect(
      screen.getAllByRole('button').map((button) => button.textContent)
    ).toEqual(['概览', '会话', '配置']);

    await user.selectOptions(projectSelect, 'project-2');
    expect(onProjectChange).toHaveBeenCalledWith('project-2');

    await user.click(screen.getByRole('button', { name: '配置' }));
    expect(onTabChange).toHaveBeenCalledWith('config');
  });
});
