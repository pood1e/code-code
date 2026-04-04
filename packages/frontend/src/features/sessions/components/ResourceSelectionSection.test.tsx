import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ResourceByKind } from '@agent-workbench/shared';

import { ResourceSelectionSection } from './ResourceSelectionSection';

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

describe('ResourceSelectionSection', () => {
  it('应支持添加和移除资源', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <ResourceSelectionSection
        label="Skills"
        items={[
          createSkill('skill-1', 'Skill One', 'First skill'),
          createSkill('skill-2', 'Skill Two', 'Second skill')
        ]}
        value={['skill-1']}
        onToggle={onToggle}
        getHint={(item) => `Hint: ${item.name}`}
      />
    );

    expect(screen.getByText('已选 1')).toBeInTheDocument();
    expect(screen.getByText('Skill One')).toBeInTheDocument();
    expect(screen.getByText('Hint: Skill One')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: '选择Skills' }),
      'skill-2'
    );
    await user.click(screen.getByRole('button', { name: '添加Skills' }));
    expect(onToggle).toHaveBeenCalledWith('skill-2');

    await user.click(screen.getByRole('button', { name: '移除 Skill One' }));
    expect(onToggle).toHaveBeenCalledWith('skill-1');
  });

  it('全部资源已选中时应展示空可选状态', () => {
    render(
      <ResourceSelectionSection
        label="Rules"
        items={[createSkill('rule-1', 'Rule One', 'Only rule')]}
        value={['rule-1']}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(
      screen.getByRole('option', { name: '没有可添加的Rules' })
    ).toBeInTheDocument();
  });
});
