import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { SchemaFieldDescriptor } from '@agent-workbench/shared';

import { DynamicConfigFieldInput } from './DynamicConfigFieldInput';

type FormValues = {
  runnerConfig: Record<string, unknown>;
};

function renderField({
  field,
  discoveredOptions
}: {
  field: SchemaFieldDescriptor;
  discoveredOptions?: Record<
    string,
    Array<{ label: string; value: string } | string>
  >;
}) {
  function TestForm() {
    const form = useForm<FormValues>({
      defaultValues: {
        runnerConfig: {}
      }
    });

    return (
      <form>
        <DynamicConfigFieldInput<FormValues>
          field={field}
          namePrefix="runnerConfig"
          control={form.control}
          discoveredOptions={discoveredOptions}
        />
        <output aria-label="form-values">
          {JSON.stringify(form.watch('runnerConfig'))}
        </output>
      </form>
    );
  }

  return {
    user: userEvent.setup(),
    ...render(<TestForm />)
  };
}

describe('DynamicConfigFieldInput', () => {
  it('应按 label 关联文本输入并写回表单值', async () => {
    const { user } = renderField({
      field: {
        name: 'prompt',
        label: 'Prompt',
        kind: 'string',
        required: true,
        description: '输入首条消息'
      }
    });

    expect(screen.getByText('输入首条消息')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Prompt'), 'hello world');

    expect(screen.getByLabelText('form-values')).toHaveTextContent(
      '{"prompt":"hello world"}'
    );
  });

  it('应支持动态发现的枚举选项', async () => {
    const { user } = renderField({
      field: {
        name: 'model',
        label: '模型',
        kind: 'string',
        required: false,
        contextKey: 'models'
      },
      discoveredOptions: {
        models: ['qwen-max', 'qwen-coder']
      }
    });

    const select = screen.getByRole('combobox', { name: '模型' });
    expect(screen.queryByRole('option', { name: '未设置' })).not.toBeInTheDocument();

    await user.selectOptions(select, 'qwen-coder');

    expect(screen.getByLabelText('form-values')).toHaveTextContent(
      '{"model":"qwen-coder"}'
    );
  });

  it('枚举字段有默认值时，不应渲染未设置空选项', () => {
    renderField({
      field: {
        name: 'approvalMode',
        label: '审批模式',
        kind: 'enum',
        required: false,
        defaultValue: 'default',
        enumOptions: [
          { label: 'plan', value: 'plan' },
          { label: 'default', value: 'default' }
        ]
      }
    });

    expect(screen.queryByRole('option', { name: '未设置' })).not.toBeInTheDocument();
  });

  it('应支持布尔配置开关', async () => {
    const { user } = renderField({
      field: {
        name: 'sandbox',
        label: '沙箱',
        kind: 'boolean',
        required: false
      }
    });

    const checkbox = screen.getByLabelText('沙箱');
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.getByLabelText('form-values')).toHaveTextContent(
      '{"sandbox":true}'
    );
  });

  it('应支持添加字符串映射配置项', async () => {
    const { user } = renderField({
      field: {
        name: 'env',
        label: '环境变量',
        kind: 'string_map',
        required: false,
        description: '以 KEY=VALUE 注入进程'
      }
    });

    await user.click(screen.getByRole('button', { name: '添加环境变量' }));

    const [keyInput, valueInput] = screen.getAllByPlaceholderText(/KEY|VALUE/);
    await user.type(keyInput, 'OPENAI_API_KEY');
    await user.type(valueInput, 'secret');

    expect(screen.getByLabelText('form-values')).toHaveTextContent(
      '{"env":{"OPENAI_API_KEY":"secret"}}'
    );
  });
});
