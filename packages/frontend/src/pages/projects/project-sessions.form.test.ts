import { describe, expect, it } from 'vitest';
import {
  MessageRole,
  MessageStatus,
  SessionStatus,
  SessionWorkspaceResourceKind,
  type OutputChunk,
  type ProfileDetail,
  type SessionMessageDetail
} from '@agent-workbench/shared';

import {
  buildCreateSessionPayload,
  buildCreateSessionFormValues,
  buildTextMessagePayload,
  applyOutputChunkToMessages,
  getMessagePreview,
  getPromptValue,
  getSessionStatusLabel
} from './project-sessions.form';

function createAssistantMessage(): SessionMessageDetail {
  return {
    id: 'message-1',
    sessionId: 'session-1',
    role: MessageRole.Assistant,
    status: MessageStatus.Sent,
    inputContent: null,
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: null,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T10:00:00.000Z'
  };
}

function createChunk(chunk: OutputChunk): OutputChunk {
  return chunk;
}

describe('project-sessions.form', () => {
  it('getMessagePreview 应优先返回用户 prompt 和助手输出', () => {
    expect(
      getMessagePreview({
        ...createAssistantMessage(),
        role: MessageRole.User,
        inputContent: {
          prompt: 'hello'
        }
      })
    ).toBe('hello');

    expect(
      getMessagePreview({
        ...createAssistantMessage(),
        outputText: 'assistant reply'
      })
    ).toBe('assistant reply');

    expect(getMessagePreview(createAssistantMessage())).toBe('等待响应...');

    expect(
      getMessagePreview({
        ...createAssistantMessage(),
        role: MessageRole.User,
        inputContent: {
          branch: 'main'
        }
      })
    ).toBe('{"branch":"main"}');

    expect(
      getMessagePreview({
        ...createAssistantMessage(),
        errorPayload: {
          code: 'RUNNER_ERROR',
          message: '执行失败',
          recoverable: true
        }
      })
    ).toBe('执行失败');
  });

  it('applyOutputChunkToMessages 应按时序合并 thinking、tool_call 和文本 parts', () => {
    let messages = [createAssistantMessage()];

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'thinking_delta',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 1,
        timestampMs: 1,
        data: {
          deltaText: '先分析'
        }
      })
    );

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'thinking_delta',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 2,
        timestampMs: 2,
        data: {
          deltaText: '一下'
        }
      })
    );

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'tool_use',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 3,
        timestampMs: 3,
        data: {
          callId: 'call-1',
          toolKind: 'file_grep',
          toolName: 'grep',
          args: {
            pattern: 'session'
          },
          result: {
            matches: 3
          }
        }
      })
    );

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'message_delta',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 4,
        timestampMs: 4,
        data: {
          deltaText: '结论'
        }
      })
    );

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'message_delta',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 5,
        timestampMs: 5,
        data: {
          deltaText: '如下'
        }
      })
    );

    expect(messages[0]).toMatchObject({
      status: MessageStatus.Streaming,
      thinkingText: '先分析一下',
      outputText: '结论如下',
      contentParts: [
        {
          type: 'thinking',
          text: '先分析一下'
        },
        {
          type: 'tool_call',
          toolCallId: 'call-1',
          toolName: 'grep',
          args: {
            pattern: 'session'
          },
          result: {
            matches: 3
          }
        },
        {
          type: 'text',
          text: '结论如下'
        }
      ]
    });
    expect(messages[0].toolUses).toHaveLength(1);
  });

  it('applyOutputChunkToMessages 应在结果和错误事件后更新最终状态', () => {
    const baseMessages = [createAssistantMessage()];

    const completedMessages = applyOutputChunkToMessages(
      baseMessages,
      createChunk({
        kind: 'message_result',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 6,
        timestampMs: 6,
        data: {
          text: '最终答案'
        }
      })
    );

    expect(completedMessages[0]).toMatchObject({
      status: MessageStatus.Complete,
      outputText: '最终答案',
      eventId: 6
    });

    const errorMessages = applyOutputChunkToMessages(
      baseMessages,
      createChunk({
        kind: 'error',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 7,
        timestampMs: 7,
        data: {
          code: 'RUNNER_ERROR',
          message: '执行失败',
          recoverable: true
        }
      })
    );

    expect(errorMessages[0]).toMatchObject({
      status: MessageStatus.Error,
      eventId: 7,
      errorPayload: {
        code: 'RUNNER_ERROR',
        message: '执行失败',
        recoverable: true
      }
    });
  });

  it('applyOutputChunkToMessages 应支持 accumulatedText 增量推导与 tool error 标记', () => {
    let messages: SessionMessageDetail[] = [
      {
        ...createAssistantMessage(),
        thinkingText: '先',
        outputText: '旧'
      }
    ];

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'thinking_delta',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 8,
        timestampMs: 8,
        data: {
          deltaText: '',
          accumulatedText: '先分析'
        }
      })
    );

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'message_delta',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 9,
        timestampMs: 9,
        data: {
          deltaText: '',
          accumulatedText: '旧答案'
        }
      })
    );

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'tool_use',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 10,
        timestampMs: 10,
        data: {
          toolKind: 'file_grep',
          toolName: 'grep',
          error: 'permission denied'
        }
      })
    );

    expect(messages[0]).toMatchObject({
      thinkingText: '先分析',
      outputText: '旧答案',
      contentParts: [
        { type: 'thinking', text: '分析' },
        { type: 'text', text: '答案' },
        {
          type: 'tool_call',
          toolName: 'grep',
          toolCallId: '10',
          isError: true
        }
      ]
    });
    expect(messages[0].toolUses[0]).toMatchObject({
      callId: null,
      toolName: 'grep',
      error: 'permission denied'
    });
  });

  it('同一个 callId 的 tool started/result 应合并成单个 tool_call 与 toolUse', () => {
    let messages = [createAssistantMessage()];

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'tool_use',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 20,
        timestampMs: 20,
        data: {
          callId: 'call-merge-1',
          toolKind: 'fallback',
          toolName: 'read_file',
          args: {
            path: 'AGENTS.md'
          }
        }
      })
    );

    messages = applyOutputChunkToMessages(
      messages,
      createChunk({
        kind: 'tool_use',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 21,
        timestampMs: 21,
        data: {
          callId: 'call-merge-1',
          toolKind: 'fallback',
          toolName: 'read_file',
          result: {
            ok: true
          }
        }
      })
    );

    expect(messages[0].contentParts).toEqual([
      {
        type: 'tool_call',
        toolCallId: 'call-merge-1',
        toolKind: 'fallback',
        toolName: 'read_file',
        args: {
          path: 'AGENTS.md'
        },
        result: {
          ok: true
        },
        isError: undefined
      }
    ]);
    expect(messages[0].toolUses).toEqual([
      {
        id: 'event_20',
        eventId: 21,
        callId: 'call-merge-1',
        toolKind: 'fallback',
        toolName: 'read_file',
        args: {
          path: 'AGENTS.md'
        },
        result: {
          ok: true
        },
        error: null,
        createdAt: '1970-01-01T00:00:00.021Z'
      }
    ]);
  });

  it('getSessionStatusLabel 应返回中文状态文案', () => {
    expect(getSessionStatusLabel(SessionStatus.Creating)).toBe('创建中');
    expect(getSessionStatusLabel(SessionStatus.Ready)).toBe('就绪');
    expect(getSessionStatusLabel(SessionStatus.Running)).toBe('运行中');
    expect(getSessionStatusLabel(SessionStatus.Disposing)).toBe('销毁中');
    expect(getSessionStatusLabel(SessionStatus.Disposed)).toBe('已销毁');
    expect(getSessionStatusLabel(SessionStatus.Error)).toBe('异常');
  });

  it('buildCreateSessionFormValues 和 getPromptValue 应返回稳定默认值', () => {
    expect(buildCreateSessionFormValues()).toEqual({
      runnerId: '',
      profileId: '',
      workspaceResources: [],
      workspaceResourceConfig: {},
      skillIds: [],
      ruleIds: [],
      mcpIds: [],
      runnerSessionConfig: {},
      initialMessageText: '',
      initialInputConfig: {},
      initialRuntimeConfig: {},
      initialRawInput: ''
    });

    expect(getPromptValue({ prompt: 'hello' })).toBe('hello');
    expect(getPromptValue({ prompt: 1 })).toBeNull();
    expect(getPromptValue(null)).toBeNull();
  });

  it('buildCreateSessionPayload 应合并 profile MCP override，buildTextMessagePayload 应裁剪 prompt', () => {
    const profileDetail: ProfileDetail = {
      id: 'profile-1',
      name: '默认配置',
      description: null,
      createdAt: '2026-04-03T10:00:00.000Z',
      updatedAt: '2026-04-03T10:00:00.000Z',
      skills: [],
      rules: [],
      mcps: [
        {
          id: 'mcp-1',
          name: 'MCP 1',
          description: null,
          order: 0,
          content: {
            type: 'stdio',
            command: 'qwen',
            args: ['--help']
          },
          configOverride: {
            command: 'qwen'
          },
          resolved: {
            type: 'stdio',
            command: 'qwen',
            args: ['--help']
          }
        },
        {
          id: 'mcp-3',
          name: 'MCP 3',
          description: null,
          order: 1,
          content: {
            type: 'stdio',
            command: 'other',
            args: []
          },
          configOverride: {
            command: 'other'
          },
          resolved: {
            type: 'stdio',
            command: 'other',
            args: []
          }
        }
      ]
    };

    expect(
      buildCreateSessionPayload(
        'project-1',
        {
          ...buildCreateSessionFormValues(),
          runnerId: 'runner-1',
          workspaceResources: [SessionWorkspaceResourceKind.Code],
          workspaceResourceConfig: {
            code: {
              branch: 'feature/test'
            }
          },
          skillIds: ['skill-1'],
          ruleIds: ['rule-1'],
          mcpIds: ['mcp-1', 'mcp-2'],
          runnerSessionConfig: {
            cwd: '/tmp/demo'
          }
        },
        profileDetail,
        {
          input: {
            prompt: '首条消息'
          },
          runtimeConfig: {
            model: 'qwen'
          }
        }
      )
    ).toEqual({
      scopeId: 'project-1',
      runnerId: 'runner-1',
      workspaceResources: [SessionWorkspaceResourceKind.Code],
      workspaceResourceConfig: {
        code: {
          branch: 'feature/test'
        }
      },
      skillIds: ['skill-1'],
      ruleIds: ['rule-1'],
      mcps: [
        {
          resourceId: 'mcp-1',
          configOverride: {
            command: 'qwen'
          }
        },
        {
          resourceId: 'mcp-2',
          configOverride: undefined
        }
      ],
      runnerSessionConfig: {
        cwd: '/tmp/demo'
      },
      initialMessage: {
        input: {
          prompt: '首条消息'
        },
        runtimeConfig: {
          model: 'qwen'
        }
      }
    });

    expect(
      buildTextMessagePayload({
        prompt: '  hello world  '
      })
    ).toEqual({
      input: {
        prompt: 'hello world'
      }
    });
  });

  it('applyOutputChunkToMessages 应替换同 eventId 的 toolUse，并忽略无关事件', () => {
    const baseMessages: SessionMessageDetail[] = [
      {
        ...createAssistantMessage(),
        toolUses: [
          {
            id: 'event_11',
            eventId: 11,
            callId: 'call-1',
            toolKind: 'file_grep',
            toolName: 'grep',
            args: { pattern: 'old' },
            result: null,
            error: null,
            createdAt: '2026-04-03T10:00:00.000Z'
          }
        ]
      }
    ];

    const toolUpdatedMessages = applyOutputChunkToMessages(
      baseMessages,
      createChunk({
        kind: 'tool_use',
        sessionId: 'session-1',
        messageId: 'message-1',
        eventId: 11,
        timestampMs: 11,
        data: {
          callId: 'call-1',
          toolKind: 'file_grep',
          toolName: 'grep',
          args: {
            pattern: 'new'
          },
          result: {
            matches: 1
          }
        }
      })
    );

    expect(toolUpdatedMessages[0].toolUses).toEqual([
      {
        id: 'event_11',
        eventId: 11,
        callId: 'call-1',
        toolKind: 'file_grep',
        toolName: 'grep',
        args: {
          pattern: 'new'
        },
        result: {
          matches: 1
        },
        error: null,
        createdAt: '1970-01-01T00:00:00.011Z'
      }
    ]);

    const unrelatedChunkMessages = applyOutputChunkToMessages(
      baseMessages,
      createChunk({
        kind: 'session_status',
        sessionId: 'session-1',
        eventId: 12,
        timestampMs: 12,
        data: {
          status: SessionStatus.Running,
          prevStatus: SessionStatus.Ready
        }
      })
    );

    expect(unrelatedChunkMessages).toBe(baseMessages);
  });
});
