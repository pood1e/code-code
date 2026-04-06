import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import {
  buildCreateSessionFormValues,
  type CreateSessionFormValues
} from '@/pages/projects/project-sessions.input';

import { CreateSessionComposer } from './CreateSessionComposer';

function renderComposer({
  supportsStructuredInitialInput = true,
  canCancel = true,
  isCreating = false,
  hasInitialMessageDraft = true,
  submitError = null,
  onCancel = vi.fn(),
  onSubmit = vi.fn(),
  onPromptKeyDown = vi.fn(),
  runtimeFields = [],
  additionalInputFields = []
}: {
  supportsStructuredInitialInput?: boolean;
  canCancel?: boolean;
  isCreating?: boolean;
  hasInitialMessageDraft?: boolean;
  submitError?: string | null;
  onCancel?: () => void;
  onSubmit?: () => void;
  onPromptKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  runtimeFields?: Array<{
    name: string;
    label: string;
    kind: 'string' | 'boolean' | 'enum';
    required: boolean;
    enumOptions?: Array<{ label: string; value: string }>;
  }>;
  additionalInputFields?: Array<{
    name: string;
    label: string;
    kind: 'string' | 'boolean' | 'enum';
    required: boolean;
    enumOptions?: Array<{ label: string; value: string }>;
  }>;
} = {}) {
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
        runtimeFields={runtimeFields}
        additionalInputFields={additionalInputFields}
        runnerContext={undefined}
        supportsStructuredInitialInput={supportsStructuredInitialInput}
        hasInitialMessageDraft={hasInitialMessageDraft}
        submitError={submitError}
        canCancel={canCancel}
        isCreating={isCreating}
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

  it('应展示固定的工作区与资源区块入口文案，取消仍可触发；创建中应禁用发送', async () => {
    const { user, onCancel } = renderComposer({
      isCreating: true
    });

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
  });

  it('运行参数应位于输入框下方', () => {
    renderComposer({
      runtimeFields: [
        {
          name: 'model',
          label: '模型',
          kind: 'enum',
          required: false,
          enumOptions: [{ label: 'gpt-5', value: 'gpt-5' }]
        }
      ]
    });

    expect(screen.getByRole('combobox', { name: '模型' })).toBeInTheDocument();
  });
});
