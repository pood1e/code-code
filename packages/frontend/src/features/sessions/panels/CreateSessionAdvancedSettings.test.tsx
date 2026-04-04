import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { ResourceByKind } from '@agent-workbench/shared';

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
  onToggleSelection = vi.fn()
}: {
  onToggleSelection?: (
    fieldName: 'skillIds' | 'ruleIds' | 'mcpIds',
    resourceId: string
  ) => void;
} = {}) {
  function Harness() {
    const form = useForm<CreateSessionFormValues>({
      defaultValues: buildCreateSessionFormValues()
    });

    return (
      <CreateSessionAdvancedSettings
        open
        control={form.control}
        additionalInputFields={[
          {
            name: 'tone',
            label: '语气',
            kind: 'string',
            required: false
          }
        ]}
        sessionConfigFields={[
          {
            name: 'sandbox',
            label: '沙箱',
            kind: 'boolean',
            required: false
          }
        ]}
        runtimeFields={[
          {
            name: 'approvalMode',
            label: '审批模式',
            kind: 'enum',
            required: false,
            enumOptions: [{ label: 'default', value: 'default' }]
          }
        ]}
        runnerContext={{
          tone: ['formal', 'casual']
        }}
        resources={{
          skills: [createSkill('skill-1', 'Skill One')],
          rules: [],
          mcps: [createMcp('mcp-1', 'Filesystem MCP')]
        }}
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
  it('应展示输入、会话、运行参数区块和资源区块', () => {
    renderAdvancedSettings();

    expect(screen.getByText('输入参数')).toBeInTheDocument();
    expect(screen.getByText('会话参数 (Session Config)')).toBeInTheDocument();
    expect(screen.getByText('运行参数 (Runtime Config)')).toBeInTheDocument();
    expect(screen.getByLabelText('语气')).toBeInTheDocument();
    expect(screen.getByLabelText('审批模式')).toBeInTheDocument();
    expect(screen.getByText('资源')).toBeInTheDocument();
  });

  it('添加资源时应调用对应的 toggle selection', async () => {
    const { user, onToggleSelection } = renderAdvancedSettings();

    await user.selectOptions(
      screen.getByRole('combobox', { name: '选择技能' }),
      'skill-1'
    );
    await user.click(screen.getByRole('button', { name: '添加技能' }));

    expect(onToggleSelection).toHaveBeenCalledWith('skillIds', 'skill-1');
  });

  it('MCP 应显示 command 作为 hint', () => {
    function Harness() {
      const form = useForm<CreateSessionFormValues>({
        defaultValues: buildCreateSessionFormValues()
      });

      return (
        <CreateSessionAdvancedSettings
          open
          control={form.control}
          additionalInputFields={[]}
          sessionConfigFields={[]}
          runtimeFields={[]}
          runnerContext={undefined}
          resources={{
            skills: [],
            rules: [],
            mcps: [createMcp('mcp-1', 'Filesystem MCP')]
          }}
          selectedSkillIds={[]}
          selectedRuleIds={[]}
          selectedMcpIds={['mcp-1']}
          onToggleSelection={vi.fn()}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByText('node')).toBeInTheDocument();
  });
});
