import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import {
  SessionWorkspaceResourceKind,
  type ResourceByKind
} from '@agent-workbench/shared';

import {
  buildCreateSessionFormValues,
  type CreateSessionFormValues
} from '@/pages/projects/project-sessions.input';

import { CreateSessionAdvancedSettings } from './CreateSessionAdvancedSettings';

function createSkill(id: string, name: string): ResourceByKind['skills'] {
  return {
    id,
    name,
    description: `${name} description`,
    content: `${name} content`,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createMcp(id: string, name: string): ResourceByKind['mcps'] {
  return {
    id,
    name,
    description: `${name} description`,
    content: {
      type: 'stdio',
      command: 'node',
      args: ['server.js']
    },
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function renderAdvancedSettings({
  onToggleSelection = vi.fn(),
  selectedWorkspaceResources = []
}: {
  onToggleSelection?: (
    fieldName: 'workspaceResources' | 'skillIds' | 'ruleIds' | 'mcpIds',
    resourceId: string
  ) => void;
  selectedWorkspaceResources?: SessionWorkspaceResourceKind[];
} = {}) {
  function Harness() {
    const form = useForm<CreateSessionFormValues>({
      defaultValues: buildCreateSessionFormValues()
    });

    return (
      <CreateSessionAdvancedSettings
        control={form.control}
        resources={{
          skills: [createSkill('skill-1', 'Skill One')],
          rules: [],
          mcps: [createMcp('mcp-1', 'Filesystem MCP')]
        }}
        selectedWorkspaceResources={selectedWorkspaceResources}
        selectedSkillIds={[]}
        selectedRuleIds={[]}
        selectedMcpIds={[]}
        onToggleSelection={onToggleSelection}
      />
    );
  }

  const user = userEvent.setup();
  render(<Harness />);

  return { user, onToggleSelection };
}

describe('CreateSessionAdvancedSettings', () => {
  it('应展示工作目录和资源区块', () => {
    renderAdvancedSettings();

    expect(screen.getByText('工作区与资源')).toBeInTheDocument();
    expect(screen.getByText('工作目录')).toBeInTheDocument();
    expect(screen.getByText('资源')).toBeInTheDocument();
  });

  it('添加资源时应调用对应的 toggle selection', async () => {
    const { user, onToggleSelection } = renderAdvancedSettings();

    await user.click(screen.getByRole('button', { name: '添加资源' }));
    await user.click(screen.getByRole('button', { name: /Skill One/i }));

    expect(onToggleSelection).toHaveBeenCalledWith('skillIds', 'skill-1');
  });

  it('MCP 应显示 command 作为 hint', () => {
    function Harness() {
      const form = useForm<CreateSessionFormValues>({
        defaultValues: buildCreateSessionFormValues()
      });

      return (
        <CreateSessionAdvancedSettings
          control={form.control}
          resources={{
            skills: [],
            rules: [],
            mcps: [createMcp('mcp-1', 'Filesystem MCP')]
          }}
          selectedWorkspaceResources={[]}
          selectedSkillIds={[]}
          selectedRuleIds={[]}
          selectedMcpIds={['mcp-1']}
          onToggleSelection={vi.fn()}
        />
      );
    }

    render(<Harness />);

    expect(
      screen.getByText('Filesystem MCP').closest('[title]')
    ).toHaveAttribute('title', 'node');
  });

  it('勾选工作目录初始化项时应触发 workspaceResources 切换', async () => {
    const { user, onToggleSelection } = renderAdvancedSettings();

    await user.click(screen.getByRole('checkbox', { name: /Code/i }));
    await user.click(screen.getByRole('checkbox', { name: /Doc/i }));

    expect(onToggleSelection).toHaveBeenCalledWith(
      'workspaceResources',
      SessionWorkspaceResourceKind.Code
    );
    expect(onToggleSelection).toHaveBeenCalledWith(
      'workspaceResources',
      SessionWorkspaceResourceKind.Doc
    );
  });

  it('选中后应展示 code 和 doc 的 branch 输入框', () => {
    renderAdvancedSettings({
      selectedWorkspaceResources: [
        SessionWorkspaceResourceKind.Code,
        SessionWorkspaceResourceKind.Doc
      ]
    });

    expect(screen.getByLabelText('Code Branch')).toBeInTheDocument();
    expect(screen.getByLabelText('Doc Branch')).toBeInTheDocument();
  });
});
