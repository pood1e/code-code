import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { AgentRunnerSummary, Profile } from '@agent-workbench/shared';

import {
  buildCreateSessionFormValues,
  type CreateSessionFormValues
} from '@/pages/projects/project-sessions.input';

import { CreateSessionComposer } from './CreateSessionComposer';

function createRunner(id: string, name: string): AgentRunnerSummary {
  return {
    id,
    name,
    description: null,
    type: 'mock',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createProfile(id: string, name: string): Profile {
  return {
    id,
    name,
    description: null,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function renderComposer({
  supportsStructuredInitialInput = true,
  canCancel = true,
  isCreating = false,
  hasInitialMessageDraft = true,
  advancedOpen = false,
  submitError = null,
  onToggleAdvanced = vi.fn(),
  onCancel = vi.fn(),
  onSubmit = vi.fn(),
  onPromptKeyDown = vi.fn()
}: {
  supportsStructuredInitialInput?: boolean;
  canCancel?: boolean;
  isCreating?: boolean;
  hasInitialMessageDraft?: boolean;
  advancedOpen?: boolean;
  submitError?: string | null;
  onToggleAdvanced?: () => void;
  onCancel?: () => void;
  onSubmit?: () => void;
  onPromptKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
} = {}) {
  const runners = [
    createRunner('runner-1', 'Mock Runner'),
    createRunner('runner-2', 'Raw Runner')
  ];
  const profiles = [createProfile('profile-1', 'Default Profile')];

  function Harness() {
    const form = useForm<CreateSessionFormValues>({
      defaultValues: {
        ...buildCreateSessionFormValues(),
        runnerId: 'runner-1'
      }
    });

    return (
      <CreateSessionComposer
        form={form}
        runners={runners}
        profiles={profiles}
        selectedRunnerId="runner-1"
        selectedProfileId=""
        supportsStructuredInitialInput={supportsStructuredInitialInput}
        hasInitialMessageDraft={hasInitialMessageDraft}
        advancedOpen={advancedOpen}
        submitError={submitError}
        canCancel={canCancel}
        isCreating={isCreating}
        onToggleAdvanced={onToggleAdvanced}
        onCancel={onCancel}
        onSubmit={onSubmit}
        onPromptKeyDown={onPromptKeyDown}
      />
    );
  }

  const user = userEvent.setup();

  render(<Harness />);

  return {
    user,
    onToggleAdvanced,
    onCancel,
    onSubmit,
    onPromptKeyDown
  };
}

describe('CreateSessionComposer', () => {
  it('结构化输入模式应显示首条消息输入和内嵌 hint', () => {
    renderComposer();

    expect(screen.getByLabelText('首条消息')).toBeInTheDocument();
    expect(screen.getByText('Enter 发送，Shift+Enter 换行')).toBeInTheDocument();
  });

  it('raw-json 模式应显示 JSON 输入框，并在不可取消时隐藏取消按钮', () => {
    renderComposer({
      supportsStructuredInitialInput: false,
      canCancel: false
    });

    expect(screen.getByLabelText('首条消息 JSON')).toBeInTheDocument();
    expect(
      screen.getByText('使用发送按钮提交，Enter 仅换行')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '取消' })
    ).not.toBeInTheDocument();
  });

  it('点击高级设置和取消时应触发对应动作；创建中应禁用发送', async () => {
    const { user, onToggleAdvanced, onCancel } = renderComposer({
      isCreating: true
    });

    await user.click(screen.getByRole('button', { name: '高级设置' }));
    expect(onToggleAdvanced).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
  });
});
