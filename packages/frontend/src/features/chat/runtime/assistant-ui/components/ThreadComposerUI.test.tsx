import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadConfigContext } from '../context';
import {
  AdditionalInputFields,
  RawJsonTemplateSync,
  ThreadComposerUI
} from './ThreadComposerUI';

type MockAssistantUiState = {
  thread: {
    isRunning: boolean;
    isDisabled: boolean;
  };
  composer: {
    text: string;
    isEditing: boolean;
  };
};

const assistantUiMock = vi.hoisted(() => ({
  state: {
    thread: {
      isRunning: false as boolean,
      isDisabled: false as boolean
    },
    composer: {
      text: '',
      isEditing: true
    }
  } as MockAssistantUiState,
  setText: vi.fn()
}));

vi.mock('@assistant-ui/react', () => ({
  ComposerPrimitive: {
    Root: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Input: (props: ComponentPropsWithoutRef<'textarea'>) => (
      <textarea aria-label="消息输入框" {...props} />
    ),
    Cancel: ({ children }: { children: ReactNode }) => <>{children}</>,
    Send: ({ children }: { children: ReactNode }) => <>{children}</>
  },
  useAui: () => ({
    composer: () => ({
      getState: () => assistantUiMock.state.composer,
      setText: assistantUiMock.setText
    })
  }),
  useAuiState: <T,>(selector: (state: MockAssistantUiState) => T) =>
    selector(assistantUiMock.state)
}));

function renderComposer(
  props: Partial<ComponentPropsWithoutRef<typeof ThreadComposerUI>> = {}
) {
  return render(
    <ThreadConfigContext.Provider value={{ assistantName: 'Mock Agent' }}>
      <ThreadComposerUI
        mode="text"
        additionalFields={[]}
        initialAdditionalValues={{}}
        runtimeFields={[]}
        initialRuntimeValues={{}}
        composerError={null}
        onAdditionalValueChange={vi.fn()}
        onRuntimeValueChange={vi.fn()}
        {...props}
      />
    </ThreadConfigContext.Provider>
  );
}

describe('ThreadComposerUI', () => {
  beforeEach(() => {
    assistantUiMock.state = {
      thread: {
        isRunning: false,
        isDisabled: false
      },
      composer: {
        text: '',
        isEditing: true
      }
    };
    assistantUiMock.setText.mockClear();
  });

  it('文本模式下应展示面向当前 Assistant 的占位文案，空输入时禁用发送', () => {
    renderComposer();

    expect(
      screen.getByRole('textbox', { name: '消息输入框' })
    ).toHaveAttribute('placeholder', '给 Mock Agent 发送消息...');
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
  });

  it('会话禁用时应提示不可用，并保持发送按钮禁用', () => {
    assistantUiMock.state.thread.isDisabled = true;
    assistantUiMock.state.composer.text = 'Hello';

    renderComposer();

    expect(screen.getByText('会话暂不可用')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
  });

  it('运行中应显示生成态和中止按钮', () => {
    assistantUiMock.state.thread.isRunning = true;
    assistantUiMock.state.composer.text = 'still typing';

    renderComposer();

    expect(screen.getByText('正在生成...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '中止' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
    expect(screen.queryByText('会话暂不可用')).not.toBeInTheDocument();
  });

  it('发送失败时应展示错误文案', () => {
    renderComposer({
      composerError: 'Request failed'
    });

    expect(screen.getByText('发送失败')).toBeInTheDocument();
    expect(screen.getByText('Request failed')).toBeInTheDocument();
  });

  it('raw-json 模式下空输入应自动写入 JSON 模板', async () => {
    renderComposer({
      mode: 'raw-json'
    });

    expect(
      screen.getByRole('textbox', { name: '消息输入框' })
    ).toHaveAttribute('placeholder', '输入 JSON');
    await waitFor(() => {
      expect(assistantUiMock.setText).toHaveBeenCalledWith(
        '{\n  "prompt": ""\n}'
      );
    });
  });

  it('raw-json 模式下已有内容或非编辑态时，不应覆盖用户输入', async () => {
    assistantUiMock.state.composer.text = '{\n  "prompt": "已有内容"\n}';
    render(<RawJsonTemplateSync enabled />);

    await waitFor(() => {
      expect(assistantUiMock.setText).not.toHaveBeenCalled();
    });

    assistantUiMock.state = {
      ...assistantUiMock.state,
      composer: {
        text: '',
        isEditing: false
      }
    } satisfies MockAssistantUiState;
    render(<RawJsonTemplateSync enabled />);

    await waitFor(() => {
      expect(assistantUiMock.setText).not.toHaveBeenCalled();
    });
  });

  it('应支持修改运行时参数和高级输入参数', async () => {
    const user = userEvent.setup();
    const onAdditionalValueChange = vi.fn();
    const onRuntimeValueChange = vi.fn();

    renderComposer({
      additionalFields: [
        {
          name: 'withTools',
          label: '启用工具',
          kind: 'boolean',
          required: false
        }
      ],
      initialAdditionalValues: {
        withTools: false as boolean
      },
      runtimeFields: [
        {
          name: 'model',
          label: '模型',
          kind: 'string',
          required: false
        }
      ],
      initialRuntimeValues: {
        model: ''
      },
      onAdditionalValueChange,
      onRuntimeValueChange
    });

    await user.type(screen.getByRole('textbox', { name: '模型' }), 'qwen-max');
    await user.click(screen.getByText('高级输入'));
    await user.click(screen.getByRole('checkbox', { name: /启用工具/ }));

    expect(onRuntimeValueChange).toHaveBeenLastCalledWith('model', 'qwen-max');
    expect(onAdditionalValueChange).toHaveBeenCalledWith('withTools', true);
  });

  it('应支持通过发现式枚举切换运行时参数', async () => {
    const user = userEvent.setup();
    const onRuntimeValueChange = vi.fn();

    renderComposer({
      runtimeFields: [
        {
          name: 'model',
          label: '模型',
          kind: 'string',
          required: false,
          contextKey: 'models'
        }
      ],
      initialRuntimeValues: {
        model: ''
      },
      discoveredOptions: {
        models: ['qwen-max', 'qwen-coder']
      },
      onRuntimeValueChange
    });

    await user.selectOptions(
      screen.getByRole('combobox', { name: '模型' }),
      'qwen-coder'
    );

    expect(onRuntimeValueChange).toHaveBeenCalledWith('model', 'qwen-coder');
  });

  it('应支持静态 enum runtime 参数和 url 参数输入', async () => {
    const user = userEvent.setup();
    const onRuntimeValueChange = vi.fn();

    renderComposer({
      runtimeFields: [
        {
          name: 'approvalMode',
          label: '审批模式',
          kind: 'enum',
          required: false,
          enumOptions: [
            {
              label: '自动',
              value: 'auto'
            }
          ]
        },
        {
          name: 'endpoint',
          label: '服务地址',
          kind: 'url',
          required: false
        }
      ],
      initialRuntimeValues: {
        approvalMode: '',
        endpoint: ''
      },
      onRuntimeValueChange
    });

    await user.selectOptions(
      screen.getByRole('combobox', { name: '审批模式' }),
      'auto'
    );
    const endpointInput = screen.getByLabelText('服务地址');
    await user.type(endpointInput, 'https://example.com');

    expect(onRuntimeValueChange).toHaveBeenCalledWith('approvalMode', 'auto');
    expect(onRuntimeValueChange).toHaveBeenLastCalledWith(
      'endpoint',
      'https://example.com'
    );
  });

  it('runtime enum 有默认值时，应显示默认值而不是字段名占位', () => {
    renderComposer({
      runtimeFields: [
        {
          name: 'approvalMode',
          label: '审批模式',
          kind: 'enum',
          required: false,
          defaultValue: 'plan',
          enumOptions: [
            {
              label: '计划',
              value: 'plan'
            },
            {
              label: '自动编辑',
              value: 'auto-edit'
            }
          ]
        }
      ],
      initialRuntimeValues: {
        approvalMode: 'plan'
      }
    });

    expect(screen.getByRole('combobox', { name: '审批模式' })).toHaveValue(
      'plan'
    );
    expect(screen.queryByRole('option', { name: '未设置' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '审批模式' })).not.toBeInTheDocument();
  });

  it('runtime enum 为空时，占位应显示未设置而不是字段名', () => {
    renderComposer({
      runtimeFields: [
        {
          name: 'approvalMode',
          label: '审批模式',
          kind: 'enum',
          required: false,
          enumOptions: [
            {
              label: '计划',
              value: 'plan'
            }
          ]
        }
      ],
      initialRuntimeValues: {
        approvalMode: ''
      }
    });

    expect(screen.getByRole('option', { name: '未设置' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '审批模式' })).not.toBeInTheDocument();
  });
});

describe('AdditionalInputFields', () => {
  it('没有高级字段时不应渲染任何内容', () => {
    const { container } = render(
      <AdditionalInputFields
        fields={[]}
        values={{}}
        disabled={false}
        onChange={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('应支持 enum 和 multiline 字段，并在禁用时阻止交互', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AdditionalInputFields
        fields={[
          {
            name: 'mode',
            label: '模式',
            kind: 'enum',
            required: false,
            description: '选择执行模式',
            enumOptions: [
              { label: '默认', value: 'default' },
              { label: '自动', value: 'auto' }
            ]
          },
          {
            name: 'notes',
            label: '备注',
            kind: 'string',
            required: false,
            description: '附加说明'
          }
        ]}
        values={{
          mode: '',
          notes: ''
        }}
        disabled={false}
        onChange={onChange}
      />
    );

    await user.click(screen.getByText('高级输入'));
    await user.selectOptions(screen.getByRole('combobox', { name: '模式' }), 'auto');
    await user.type(screen.getByRole('textbox', { name: '备注' }), '额外说明');

    expect(screen.getByText('选择执行模式')).toBeInTheDocument();
    expect(screen.getByText('附加说明')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('mode', 'auto');
    expect(onChange.mock.calls.some(([fieldName]) => fieldName === 'notes')).toBe(
      true
    );

    onChange.mockClear();
    render(
      <AdditionalInputFields
        fields={[
          {
            name: 'enabled',
            label: '启用功能',
            kind: 'boolean',
            required: false
          }
        ]}
        values={{
          enabled: true
        }}
        disabled
        onChange={onChange}
      />
    );

    await user.click(screen.getAllByText('高级输入')[1]);
    expect(screen.getByRole('checkbox', { name: /启用功能/ })).toBeDisabled();
  });
});
