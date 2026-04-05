import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ResourceByKind } from '@agent-workbench/shared';

import { SessionResourcePicker } from './SessionResourcePicker';

function createSkill(
  id: string,
  name: string,
  description: string
): ResourceByKind['skills'] {
  return {
    id,
    name,
    description,
    content: 'content',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createRule(
  id: string,
  name: string,
  description: string
): ResourceByKind['rules'] {
  return {
    id,
    name,
    description,
    content: 'content',
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

describe('SessionResourcePicker', () => {
  it('应支持统一搜索并按类型切换资源', async () => {
    const onToggleSelection = vi.fn();
    const user = userEvent.setup();

    render(
      <SessionResourcePicker
        resources={{
          skills: [createSkill('skill-1', 'React Skill', 'Frontend helper')],
          rules: [createRule('rule-1', 'Commit Rule', 'Commit convention')],
          mcps: [createMcp('mcp-1', 'Filesystem MCP')]
        }}
        selectedSkillIds={['skill-1']}
        selectedRuleIds={[]}
        selectedMcpIds={[]}
        onToggleSelection={onToggleSelection}
      />
    );

    expect(screen.getByText('React Skill')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加资源' }));
    await user.type(screen.getByRole('textbox', { name: '搜索资源' }), 'commit');
    await user.click(screen.getByRole('button', { name: /Commit Rule/i }));

    expect(onToggleSelection).toHaveBeenCalledWith('ruleIds', 'rule-1');
  });

  it('应显示空状态并允许从标签移除资源', async () => {
    const onToggleSelection = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <SessionResourcePicker
        resources={{
          skills: [createSkill('skill-1', 'React Skill', 'Frontend helper')],
          rules: [],
          mcps: []
        }}
        selectedSkillIds={[]}
        selectedRuleIds={[]}
        selectedMcpIds={[]}
        onToggleSelection={onToggleSelection}
      />
    );

    expect(screen.getByText('未附加资源')).toBeInTheDocument();

    rerender(
      <SessionResourcePicker
        resources={{
          skills: [createSkill('skill-1', 'React Skill', 'Frontend helper')],
          rules: [],
          mcps: []
        }}
        selectedSkillIds={['skill-1']}
        selectedRuleIds={[]}
        selectedMcpIds={[]}
        onToggleSelection={onToggleSelection}
      />
    );

    await user.click(screen.getByRole('button', { name: '移除 React Skill' }));
    expect(onToggleSelection).toHaveBeenCalledWith('skillIds', 'skill-1');
  });

  it('点击外部时应关闭资源选择框', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <button type="button">外部区域</button>
        <SessionResourcePicker
          resources={{
            skills: [createSkill('skill-1', 'React Skill', 'Frontend helper')],
            rules: [],
            mcps: []
          }}
          selectedSkillIds={[]}
          selectedRuleIds={[]}
          selectedMcpIds={[]}
          onToggleSelection={vi.fn()}
        />
      </div>
    );

    await user.click(screen.getByRole('button', { name: '添加资源' }));
    expect(screen.getByRole('textbox', { name: '搜索资源' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '外部区域' }));
    expect(
      screen.queryByRole('textbox', { name: '搜索资源' })
    ).not.toBeInTheDocument();
  });
});
