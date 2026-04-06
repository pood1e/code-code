import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MessageRole,
  MessageStatus,
  SessionStatus,
  SessionWorkspaceMode,
  type RunnerTypeResponse,
  type SendSessionMessageInput,
  type SessionDetail,
  type SessionMessageDetail
} from '@agent-workbench/shared';

import { probeAgentRunnerContext } from '@/api/agent-runners';
import { createTestQueryClient } from '@/test/render';

import { SessionAssistantThread } from './SessionAssistantThread';
import { ThreadConfigContext } from './context';
import type { SessionMessageRuntimeMap } from './thread-adapter';

const threadRuntimeMock = vi.hoisted(() => ({
  providerProps: undefined as Record<string, unknown> | undefined,
  composerProps: undefined as Record<string, unknown> | undefined,
  historyProps: undefined as Record<string, unknown> | undefined,
  historyCopyText: undefined as string | undefined
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'light'
  })
}));

vi.mock('@assistant-ui/react', () => ({
  ThreadPrimitive: {
    Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  }
}));

vi.mock('./SessionAssistantRuntimeProvider', () => ({
  SessionAssistantRuntimeProvider: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  } & Record<string, unknown>) => {
    threadRuntimeMock.providerProps = props;
    return <>{children}</>;
  }
}));

vi.mock('./components/ThreadComposerUI', () => ({
  ThreadComposerUI: (
    props: {
      mode: 'text' | 'raw-json';
      composerError?: string | null;
      discoveredOptions?: unknown;
      disabledHint?: string | null;
      recoveryAction?: {
        label: string;
        onClick: () => void;
      };
    } & Record<string, unknown>
  ) => {
    threadRuntimeMock.composerProps = props;
    const recoveryAction = props.recoveryAction;
    return (
      <div>
        <div aria-label="composer-mode">{props.mode}</div>
        <div aria-label="composer-error">{String(props.composerError ?? '')}</div>
        <div aria-label="discovered-options">
          {JSON.stringify(props.discoveredOptions ?? null)}
        </div>
        <div aria-label="composer-disabled-hint">
          {String(props.disabledHint ?? '')}
        </div>
        {recoveryAction ? (
          <button type="button" onClick={() => recoveryAction.onClick()}>
            {String(recoveryAction.label)}
          </button>
        ) : null}
        {!recoveryAction ? <button type="button">发送</button> : null}
      </div>
    );
  }
}));

vi.mock('./SessionAssistantThreadHistory', () => ({
  SessionAssistantThreadHistory: ({
    canReload,
    records,
    firstItemIndex,
    onLoadMore,
    onReload
  }: {
    canReload: boolean;
    records: Array<{
      message: SessionMessageDetail;
      runtime?: {
        thinkingText?: string;
      };
    }>;
    firstItemIndex: number;
    onLoadMore?: () => void;
    onReload: () => Promise<void>;
  }) => {
    const { assistantName } = React.useContext(ThreadConfigContext);
    threadRuntimeMock.historyProps = {
      records,
      firstItemIndex,
      onLoadMore,
      onReload
    };

    return (
      <div>
        <div>{assistantName ?? 'Assistant'}</div>
        {onLoadMore ? (
          <button type="button" onClick={onLoadMore}>
            加载更早消息
          </button>
        ) : null}
        {records.map((record, index) => (
          <div key={record.message.id}>
            {record.message.role === MessageRole.User ? (
              <>
                <div>{String(record.message.inputContent?.prompt ?? '')}</div>
                <button
                  type="button"
                  onClick={() => {
                    threadRuntimeMock.historyCopyText = String(
                      record.message.inputContent?.prompt ?? ''
                    );
                  }}
                >
                  复制用户消息
                </button>
              </>
            ) : (
              <>
                {record.runtime?.thinkingText ? (
                  <>
                    <button type="button">Thinking</button>
                    <div>{record.runtime.thinkingText}</div>
                  </>
                ) : null}
                {record.message.contentParts.map((part, partIndex) => {
                  if (part.type === 'text') {
                    return <div key={partIndex}>{part.text}</div>;
                  }
                  if (part.type === 'tool_call') {
                    return (
                      <button key={partIndex} type="button">
                        Tool • {part.toolName}
                      </button>
                    );
                  }
                  if (part.type === 'thinking') {
                    return (
                      <button key={partIndex} type="button">
                        Thinking
                      </button>
                    );
                  }
                  return null;
                })}
                {record.message.errorPayload ? (
                  <>
                    <div>{record.message.errorPayload.code}</div>
                    <div>{record.message.errorPayload.message}</div>
                  </>
                ) : null}
                {record.message.cancelledAt ? <div>已中止</div> : null}
                {canReload && index === records.length - 1 ? (
                  <button type="button" onClick={() => void onReload()}>
                    重跑
                  </button>
                ) : null}
              </>
            )}
          </div>
        ))}
      </div>
    );
  }
}));

vi.mock('@/api/agent-runners', () => ({
  probeAgentRunnerContext: vi.fn()
}));

function createSession(): SessionDetail {
  return {
    id: 'session-1',
    scopeId: 'project-1',
    runnerId: 'runner-1',
    runnerType: 'mock',
    status: SessionStatus.Ready,
    lastEventId: 0,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z',
    platformSessionConfig: {
      workspaceMode: SessionWorkspaceMode.Project,
      workspaceRoot: '/tmp',
      cwd: '/tmp',
      workspaceResources: [],
      skillIds: [],
      ruleIds: [],
      mcps: []
    },
    runnerSessionConfig: {},
    defaultRuntimeConfig: null
  };
}

function createRunnerType(): RunnerTypeResponse {
  return {
    id: 'mock',
    name: 'Mock Runner',
    capabilities: {
      skill: false,
      rule: false,
      mcp: false
    },
    runnerConfigSchema: { fields: [] },
    runnerSessionConfigSchema: { fields: [] },
    inputSchema: {
      fields: [
        {
          name: 'prompt',
          label: 'Prompt',
          kind: 'string',
          required: true
        }
      ]
    },
      runtimeConfigSchema: { fields: [] }
  };
}

function createStructuredRunnerType(): RunnerTypeResponse {
  return {
    ...createRunnerType(),
    inputSchema: {
      fields: [
        {
          name: 'prompt',
          label: 'Prompt',
          kind: 'string',
          required: true
        },
        {
          name: 'branch',
          label: 'Branch',
          kind: 'string',
          required: false
        }
      ]
    },
    runtimeConfigSchema: {
      fields: [
        {
          name: 'maxTurns',
          label: 'Max Turns',
          kind: 'integer',
          required: false
        }
      ]
    }
  };
}

function createRawJsonRunnerType(): RunnerTypeResponse {
  return {
    ...createRunnerType(),
    inputSchema: {
      fields: []
    }
  };
}

function createUserMessage(): SessionMessageDetail {
  return {
    id: 'message-user',
    sessionId: 'session-1',
    role: MessageRole.User,
    status: MessageStatus.Complete,
    inputContent: { prompt: '原始问题' },
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: 1,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T10:00:00.000Z'
  };
}

function createAssistantMessage(): SessionMessageDetail {
  return {
    id: 'message-assistant',
    sessionId: 'session-1',
    role: MessageRole.Assistant,
    status: MessageStatus.Complete,
    inputContent: null,
    runtimeConfig: null,
    outputText: '旧 outputText 不应再作为主渲染来源',
    thinkingText: '旧 thinkingText 不应再作为主渲染来源',
    contentParts: [
      {
        type: 'thinking',
        text: '正在分析'
      },
      {
        type: 'text',
        text: '第一段回答'
      },
      {
        type: 'tool_call',
        toolCallId: 'call-1',
        toolName: 'read_file',
        args: { path: 'AGENTS.md' },
        result: { ok: true }
      },
      {
        type: 'text',
        text: '第二段结论'
      }
    ],
    errorPayload: null,
    cancelledAt: null,
    eventId: 2,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T10:00:01.000Z'
  };
}

function renderSessionThread({
  messages,
  messagesReady,
  runtimeState = {},
  onLoadMore,
  onReload = vi.fn(),
  onEdit = vi.fn(),
  onSend = vi.fn(),
  onCancel = vi.fn(),
  onCreateNewSession,
  runnerType = createRunnerType(),
  assistantName,
  session = createSession()
}: {
  messages: SessionMessageDetail[];
  messagesReady: boolean;
  runtimeState?: SessionMessageRuntimeMap;
  onLoadMore?: () => void;
  onReload?: () => Promise<void>;
  onEdit?: (
    messageId: string,
    payload: SendSessionMessageInput
  ) => Promise<void>;
  onSend?: (payload: SendSessionMessageInput) => Promise<void>;
  onCancel?: () => Promise<void>;
  onCreateNewSession?: () => void;
  runnerType?: RunnerTypeResponse;
  assistantName?: string;
  session?: SessionDetail;
}) {
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();

  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <SessionAssistantThread
        assistantName={assistantName}
        onCreateNewSession={onCreateNewSession}
        session={session}
        messages={messages}
        messagesReady={messagesReady}
        runnerType={runnerType}
        runtimeState={runtimeState}
        onSend={onSend}
        onCancel={onCancel}
        onReload={onReload}
        onEdit={onEdit}
        onLoadMore={onLoadMore}
      />
    </QueryClientProvider>
  );

  return {
    ...renderResult,
    queryClient,
    user,
    onReload,
    onEdit,
    onSend,
    onCancel
  };
}

describe('SessionAssistantThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    threadRuntimeMock.providerProps = undefined;
    threadRuntimeMock.composerProps = undefined;
    threadRuntimeMock.historyProps = undefined;
    threadRuntimeMock.historyCopyText = undefined;
    vi.mocked(probeAgentRunnerContext).mockResolvedValue({});
  });

  it('历史消息未就绪且消息为空时，应展示加载态', () => {
    renderSessionThread({
      messages: [],
      messagesReady: false
    });

    expect(
      screen.getByText('正在加载历史消息...', { selector: 'p' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('composer-disabled-hint')).toHaveTextContent(
      '正在加载历史消息...'
    );
    expect(screen.queryByText('开始对话')).not.toBeInTheDocument();
  });

  it('历史消息已就绪且消息为空时，应展示空态', () => {
    renderSessionThread({
      messages: [],
      messagesReady: true
    });

    expect(screen.getByText('开始对话')).toBeInTheDocument();
    expect(screen.getByText('消息会显示在这里')).toBeInTheDocument();
  });

  it('assistant 消息应按 contentParts 时序透传给线程历史区，并带上 runtime thinking', async () => {
    renderSessionThread({
      messages: [createUserMessage(), createAssistantMessage()],
      messagesReady: true,
      runtimeState: {
        'message-assistant': {
          thinkingText: '实时 thinking 覆盖'
        }
      }
    });

    expect(await screen.findByText('原始问题')).toBeInTheDocument();
    expect(await screen.findByText('实时 thinking 覆盖')).toBeInTheDocument();
    expect(await screen.findByText('第一段回答')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Tool • read_file' })
    ).toBeInTheDocument();
    expect(await screen.findByText('第二段结论')).toBeInTheDocument();
  });

  it('点击加载更早消息、重跑、复制时，应触发对应交互', async () => {
    const onLoadMore = vi.fn();
    const onReload = vi.fn().mockResolvedValue(undefined);
    const { user } = renderSessionThread({
      messages: [createUserMessage(), createAssistantMessage()],
      messagesReady: true,
      onLoadMore,
      onReload
    });

    (await screen.findByRole('button', {
      name: '加载更早消息'
    })).click();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await user.click(
      await screen.findByRole('button', {
        name: '重跑'
      })
    );
    await waitFor(() => {
      expect(onReload).toHaveBeenCalledTimes(1);
    });

    await user.click(await screen.findByRole('button', { name: '复制用户消息' }));
    expect(threadRuntimeMock.historyCopyText).toBe('原始问题');
  });

  it('重跑失败时应把错误透传给调用方', async () => {
    const onReload = vi.fn().mockRejectedValue(new Error('重跑失败'));
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      onReload
    });

    await expect(
      (
        threadRuntimeMock.historyProps as {
          onReload: () => Promise<void>;
        }
      ).onReload()
    ).rejects.toThrow('重跑失败');
  });

  it('无结构化输入 schema 时，应切到 raw-json composer 模式', () => {
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      runnerType: createRawJsonRunnerType()
    });

    expect(screen.getByLabelText('composer-mode')).toHaveTextContent(
      'raw-json'
    );
  });

  it('runnerType 未加载时，仍应以文本模式发送 prompt', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      onSend,
      runnerType: undefined
    });

    expect(screen.getByLabelText('composer-mode')).toHaveTextContent('text');

    const providerProps = threadRuntimeMock.providerProps as {
      onNew: (composerText: string) => Promise<void>;
    };

    await providerProps.onNew('  hello while loading  ');

    expect(onSend).toHaveBeenCalledWith({
      input: {
        prompt: 'hello while loading'
      }
    });
  });

  it('runner context 加载完成后，应把发现式选项传给 composer', async () => {
    vi.mocked(probeAgentRunnerContext).mockResolvedValue({
      models: ['qwen-max', 'qwen-coder']
    });

    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true
    });

    await waitFor(() => {
      expect(screen.getByLabelText('discovered-options')).toHaveTextContent(
        'qwen-max'
      );
    });
  });

  it('文本模式发送时，应构造结构化 payload 并透传 runtimeConfig', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      onSend,
      runnerType: createStructuredRunnerType()
    });

    const composerProps = threadRuntimeMock.composerProps as {
      onAdditionalValueChange: (fieldName: string, value: unknown) => void;
      onRuntimeValueChange: (fieldName: string, value: unknown) => void;
    };
    const providerProps = threadRuntimeMock.providerProps as {
      onNew: (composerText: string) => Promise<void>;
    };

    composerProps.onAdditionalValueChange('branch', '  main  ');
    composerProps.onRuntimeValueChange('maxTurns', '3');

    await providerProps.onNew('  hello  ');

    expect(onSend).toHaveBeenCalledWith({
      input: {
        prompt: 'hello',
        branch: 'main'
      },
      runtimeConfig: {
        maxTurns: 3
      }
    });
    expect(screen.getByLabelText('composer-error')).toHaveTextContent('');
  });

  it('session.defaultRuntimeConfig 应合并到 composer 的初始 runtime 值', () => {
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      runnerType: createStructuredRunnerType(),
      session: {
        ...createSession(),
        defaultRuntimeConfig: {
          maxTurns: 7
        }
      }
    });

    expect(
      (
        threadRuntimeMock.composerProps as {
          initialRuntimeValues: Record<string, unknown>;
        }
      ).initialRuntimeValues
    ).toEqual({
      maxTurns: 7
    });
  });

  it('文本模式发送成功后，应重置额外输入草稿，避免串到下一条消息', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      onSend,
      runnerType: createStructuredRunnerType()
    });

    const composerProps = threadRuntimeMock.composerProps as {
      onAdditionalValueChange: (fieldName: string, value: unknown) => void;
    };
    const providerProps = threadRuntimeMock.providerProps as {
      onNew: (composerText: string) => Promise<void>;
    };

    composerProps.onAdditionalValueChange('branch', 'feature/test');
    await providerProps.onNew('第一条消息');
    await providerProps.onNew('第二条消息');

    expect(onSend).toHaveBeenNthCalledWith(1, {
      input: {
        prompt: '第一条消息',
        branch: 'feature/test'
      },
      runtimeConfig: {}
    });
    expect(onSend).toHaveBeenNthCalledWith(2, {
      input: {
        prompt: '第二条消息'
      },
      runtimeConfig: {}
    });
  });

  it('文本模式发送失败时，应展示发送错误', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('发送失败'));
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      onSend,
      runnerType: createStructuredRunnerType()
    });

    const providerProps = threadRuntimeMock.providerProps as {
      onNew: (composerText: string) => Promise<void>;
    };

    await expect(providerProps.onNew('hello')).rejects.toThrow('发送失败');

    await waitFor(() => {
      expect(screen.getByLabelText('composer-error')).toHaveTextContent(
        '发送失败'
      );
    });
  });

  it('raw-json 模式输入非法 JSON 时，应阻止发送并展示字段错误', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      onSend,
      runnerType: createRawJsonRunnerType()
    });

    const providerProps = threadRuntimeMock.providerProps as {
      onNew: (composerText: string) => Promise<void>;
    };

    await expect(providerProps.onNew('{invalid json')).rejects.toThrow();

    expect(onSend).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByLabelText('composer-error').textContent).not.toBe('');
    });
  });

  it('raw-json 模式输入合法 JSON 时，应按新契约发送 input 对象', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      onSend,
      runnerType: createRawJsonRunnerType()
    });

    const providerProps = threadRuntimeMock.providerProps as {
      onNew: (composerText: string) => Promise<void>;
    };

    await providerProps.onNew('{"prompt":"raw json message","branch":"main"}');

    expect(onSend).toHaveBeenCalledWith({
      input: {
        prompt: 'raw json message',
        branch: 'main'
      }
    });
  });

  it('runnerType 未加载时编辑消息，应按文本 prompt 提交', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    renderSessionThread({
      messages: [createUserMessage(), createAssistantMessage()],
      messagesReady: true,
      onEdit,
      runnerType: undefined
    });

    const providerProps = threadRuntimeMock.providerProps as {
      onEdit: (messageId: string, composerText: string) => Promise<void>;
    };

    await providerProps.onEdit('message-user', '  edited while loading  ');

    expect(onEdit).toHaveBeenCalledWith('message-user', {
      input: {
        prompt: 'edited while loading'
      }
    });
  });

  it('编辑消息时应复用原消息额外字段并带上当前 runtimeConfig', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    renderSessionThread({
      messages: [
        {
          ...createUserMessage(),
          inputContent: {
            prompt: '原始问题',
            branch: 'feature/test'
          }
        },
        createAssistantMessage()
      ],
      messagesReady: true,
      onEdit,
      runnerType: createStructuredRunnerType()
    });

    const composerProps = threadRuntimeMock.composerProps as {
      onRuntimeValueChange: (fieldName: string, value: unknown) => void;
    };
    const providerProps = threadRuntimeMock.providerProps as {
      onEdit: (messageId: string, composerText: string) => Promise<void>;
    };

    composerProps.onRuntimeValueChange('maxTurns', '4');
    await providerProps.onEdit('message-user', '修改后的问题');

    expect(onEdit).toHaveBeenCalledWith('message-user', {
      input: {
        prompt: '修改后的问题',
        branch: 'feature/test'
      },
      runtimeConfig: {
        maxTurns: 4
      }
    });
  });

  it('raw-json 模式编辑消息时，应按新契约直接提交解析后的 input 对象', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    renderSessionThread({
      messages: [createUserMessage(), createAssistantMessage()],
      messagesReady: true,
      onEdit,
      runnerType: createRawJsonRunnerType()
    });

    const providerProps = threadRuntimeMock.providerProps as {
      onEdit: (messageId: string, composerText: string) => Promise<void>;
    };

    await providerProps.onEdit(
      'message-user',
      '{"prompt":"raw edited","branch":"release"}'
    );

    expect(onEdit).toHaveBeenCalledWith('message-user', {
      input: {
        prompt: 'raw edited',
        branch: 'release'
      }
    });
  });

  it('raw-json 模式编辑非法 JSON 时，应阻止编辑并抛出校验错误', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    renderSessionThread({
      messages: [createUserMessage(), createAssistantMessage()],
      messagesReady: true,
      onEdit,
      runnerType: createRawJsonRunnerType()
    });

    const providerProps = threadRuntimeMock.providerProps as {
      onEdit: (messageId: string, composerText: string) => Promise<void>;
    };

    await expect(
      providerProps.onEdit('message-user', '{invalid json')
    ).rejects.toThrow();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('编辑目标消息不存在时，应抛出明确错误', async () => {
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      runnerType: createStructuredRunnerType()
    });

    const providerProps = threadRuntimeMock.providerProps as {
      onEdit: (messageId: string, composerText: string) => Promise<void>;
    };

    await expect(
      providerProps.onEdit('missing-message', '修改后的问题')
    ).rejects.toThrow('编辑目标消息不存在');
  });

  it('历史顶部追加更早消息时，应调整 firstItemIndex 保持滚动锚点稳定', async () => {
    const renderResult = renderSessionThread({
      messages: [createUserMessage(), createAssistantMessage()],
      messagesReady: true
    });

    await waitFor(() => {
      expect(
        (
          threadRuntimeMock.historyProps as {
            firstItemIndex: number;
          }
        ).firstItemIndex
      ).toBe(100_000);
    });

    renderResult.rerender(
      <QueryClientProvider client={renderResult.queryClient}>
        <SessionAssistantThread
          session={createSession()}
          messages={[
            {
              ...createUserMessage(),
              id: 'message-user-older',
              eventId: 0,
              createdAt: '2026-04-03T09:59:59.000Z',
              inputContent: { prompt: '更早的问题' }
            },
            createUserMessage(),
            createAssistantMessage()
          ]}
          messagesReady
          runnerType={createRunnerType()}
          runtimeState={{}}
          onSend={vi.fn()}
          onCancel={vi.fn()}
          onReload={vi.fn()}
          onEdit={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        (
          threadRuntimeMock.historyProps as {
            firstItemIndex: number;
          }
        ).firstItemIndex
      ).toBe(99_999);
    });
  });

  it('用户取消的 assistant 消息应展示错误卡片和已中止状态，且仅最后一条 assistant 显示重跑', async () => {
    renderSessionThread({
      session: {
        ...createSession(),
        status: SessionStatus.Ready
      },
      messages: [
        createAssistantMessage(),
        {
          ...createAssistantMessage(),
          id: 'message-assistant-2',
          outputText: null,
          contentParts: [],
          status: MessageStatus.Error,
          cancelledAt: '2026-04-03T10:00:05.000Z',
          errorPayload: {
            code: 'USER_CANCELLED',
            message: '用户已取消',
            recoverable: true
          }
        }
      ],
      messagesReady: true
    });

    expect(await screen.findByText('USER_CANCELLED')).toBeInTheDocument();
    expect(await screen.findByText('用户已取消')).toBeInTheDocument();
    expect(await screen.findByText('已中止')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '重跑' })).toHaveLength(1);
  });

  it('error 会话应展示新建会话恢复动作，并隐藏重跑', async () => {
    const onCreateNewSession = vi.fn();
    renderSessionThread({
      onCreateNewSession,
      session: {
        ...createSession(),
        status: SessionStatus.Error
      },
      messages: [createAssistantMessage()],
      messagesReady: true
    });

    expect(await screen.findByText('会话已异常，请新建会话')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建会话' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '发送' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重跑' })).not.toBeInTheDocument();
  });

  it('assistant 名称应优先使用 runner 实例名，而不是 runner type 名', async () => {
    renderSessionThread({
      messages: [createAssistantMessage()],
      messagesReady: true,
      runnerType: createRunnerType(),
      assistantName: 'Dev Runner'
    });

    expect(await screen.findByText('Dev Runner')).toBeInTheDocument();
    expect(screen.queryByText('Mock Runner')).not.toBeInTheDocument();
  });

});
