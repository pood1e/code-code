import { describe, expect, it } from 'vitest';
import {
  MessageRole,
  MessageStatus,
  type SessionMessageDetail
} from '@agent-workbench/shared';

import {
  convertSessionMessageRecord,
  getComposerText,
  getSessionMessagePromptText,
  toAssistantToolArgs
} from './message-converters';
import type { SessionAssistantMessageRecord } from './thread-adapter';

function createMessage(
  overrides: Partial<SessionMessageDetail> = {}
): SessionMessageDetail {
  return {
    id: 'message_1',
    sessionId: 'session_1',
    role: MessageRole.User,
    status: MessageStatus.Sent,
    inputContent: { prompt: 'hello' },
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: 1,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T00:00:00.000Z',
    ...overrides
  };
}

describe('message-converters', () => {
  it('应把 user 消息转换为 assistant-ui 文本消息，并复用缓存结果', () => {
    const record: SessionAssistantMessageRecord = {
      message: createMessage(),
      runtime: undefined
    };

    const converted = convertSessionMessageRecord(record);

    expect(converted).toEqual({
      id: 'message_1',
      role: 'user',
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      content: [
        {
          type: 'text',
          text: 'hello'
        }
      ],
      metadata: {
        custom: expect.objectContaining({
          domainMessageId: 'message_1',
          domainStatus: MessageStatus.Sent,
          inputContent: { prompt: 'hello' }
        })
      }
    });
    expect(convertSessionMessageRecord(record)).toBe(converted);
  });

  it('应把 assistant 消息输出、thinking、tool、usage 和错误状态转换为 UI 结构', () => {
    const record: SessionAssistantMessageRecord = {
      message: createMessage({
        id: 'assistant_1',
        role: MessageRole.Assistant,
        status: MessageStatus.Error,
        inputContent: null,
        outputText: 'final answer',
        errorPayload: {
          message: 'runner failed',
          code: 'RUNNER_FAILED',
          recoverable: true
        },
        toolUses: [
          {
            id: 'tool_1',
            eventId: 2,
            callId: 'call_1',
            toolKind: 'shell',
            toolName: 'bash',
            args: { command: 'pwd' },
            result: { ok: true },
            error: null,
            createdAt: '2026-04-03T00:00:00.000Z'
          }
        ]
      }),
      runtime: {
        thinkingText: 'runtime thinking',
        usage: {
          inputTokens: 12,
          outputTokens: 34,
          modelId: 'mock-runner'
        }
      }
    };

    const converted = convertSessionMessageRecord(record);

    expect(converted.role).toBe('assistant');
    expect(converted.status).toEqual({
      type: 'incomplete',
      reason: 'error',
      error: {
        code: 'RUNNER_FAILED',
        message: 'runner failed',
        recoverable: true
      }
    });
    expect(converted.content).toEqual([
      {
        type: 'reasoning',
        text: 'runtime thinking'
      },
      {
        type: 'text',
        text: 'final answer'
      },
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'bash',
        args: { command: 'pwd' },
        argsText: '{\n  "command": "pwd"\n}',
        result: { ok: true },
        isError: false
      }
    ]);
    expect(converted.metadata?.custom).toMatchObject({
      usage: {
        inputTokens: 12,
        outputTokens: 34,
        modelId: 'mock-runner'
      },
      recoverableError: {
        code: 'RUNNER_FAILED'
      }
    });
  });

  it('contentParts 应按时序转换，并在缺少 toolCallId 时回退到 toolName', () => {
    const converted = convertSessionMessageRecord({
      message: createMessage({
        id: 'assistant_parts',
        role: MessageRole.Assistant,
        status: MessageStatus.Complete,
        inputContent: null,
        contentParts: [
          {
            type: 'thinking',
            text: '静态 thinking'
          },
          {
            type: 'text',
            text: '第一段'
          },
          {
            type: 'tool_call',
            toolCallId: 'tool-read-file',
            toolName: 'read_file',
            args: ['AGENTS.md'],
            result: null
          },
          {
            type: 'text',
            text: '第二段'
          }
        ]
      }),
      runtime: {
        thinkingText: 'runtime thinking'
      }
    });

    expect(converted.status).toEqual({
      type: 'complete',
      reason: 'stop'
    });
    expect(converted.content).toEqual([
      {
        type: 'reasoning',
        text: 'runtime thinking'
      },
      {
        type: 'text',
        text: '第一段'
      },
      {
        type: 'tool-call',
        toolCallId: 'tool-read-file',
        toolName: 'read_file',
        args: {
          value: ['AGENTS.md']
        },
        argsText: '[\n  "AGENTS.md"\n]',
        result: null,
        isError: undefined
      },
      {
        type: 'text',
        text: '第二段'
      }
    ]);
  });

  it('USER_CANCELLED 应被映射为 complete/stop 而非错误态', () => {
    const converted = convertSessionMessageRecord({
      message: createMessage({
        id: 'assistant_cancelled',
        role: MessageRole.Assistant,
        status: MessageStatus.Error,
        inputContent: null,
        errorPayload: {
          message: '当前输出已中止',
          code: 'USER_CANCELLED',
          recoverable: true
        },
        cancelledAt: '2026-04-03T00:01:00.000Z'
      }),
      runtime: undefined
    });

    expect(converted.status).toEqual({
      type: 'complete',
      reason: 'stop'
    });
    expect(converted.metadata?.custom).toMatchObject({
      cancelledAt: '2026-04-03T00:01:00.000Z',
      recoverableError: null
    });
  });

  it('非 recoverable 错误应进入 nonRecoverableError，sent/streaming 应映射 running', () => {
    const sentMessage = convertSessionMessageRecord({
      message: createMessage({
        id: 'assistant_running',
        role: MessageRole.Assistant,
        status: MessageStatus.Sent,
        inputContent: null
      }),
      runtime: undefined
    });

    const failedMessage = convertSessionMessageRecord({
      message: createMessage({
        id: 'assistant_failed',
        role: MessageRole.Assistant,
        status: MessageStatus.Error,
        inputContent: null,
        errorPayload: {
          message: 'fatal',
          code: 'FATAL',
          recoverable: false
        }
      }),
      runtime: undefined
    });

    expect(sentMessage.status).toEqual({
      type: 'running'
    });
    expect(failedMessage.metadata?.custom).toMatchObject({
      recoverableError: null,
      nonRecoverableError: {
        code: 'FATAL'
      }
    });
  });

  it('应按 prompt、首个文本字段、JSON stringify 的顺序提取用户消息文本', () => {
    expect(
      getSessionMessagePromptText(
        createMessage({
          inputContent: { prompt: '直接 prompt', branch: 'main' }
        })
      )
    ).toBe('直接 prompt');
    expect(
      getSessionMessagePromptText(
        createMessage({
          inputContent: { branch: 'main', note: '备用文本' }
        })
      )
    ).toBe('main');
    expect(
      getSessionMessagePromptText(
        createMessage({
          inputContent: { turns: 3, enabled: true }
        })
      )
    ).toBe('{\n  "turns": 3,\n  "enabled": true\n}');
  });

  it('toAssistantToolArgs 应归一化 primitive、array 和 object', () => {
    expect(toAssistantToolArgs('bash')).toEqual({
      value: 'bash'
    });
    expect(
      toAssistantToolArgs({
        nested: [1, true, { path: 'AGENTS.md' }]
      })
    ).toEqual({
      nested: [1, true, { path: 'AGENTS.md' }]
    });
  });

  it('getComposerText 应兼容字符串和多文本分段输入', () => {
    expect(
      getComposerText({
        parentId: null,
        sourceId: null,
        runConfig: undefined,
        role: 'user',
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
        metadata: {
          custom: {}
        },
        content: 'plain text'
      } as never)
    ).toBe('plain text');

    expect(
      getComposerText({
        parentId: null,
        sourceId: null,
        runConfig: undefined,
        role: 'user',
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
        metadata: {
          custom: {}
        },
        content: [
          { type: 'text', text: 'line1' },
          { type: 'text', text: 'line2' }
        ]
      })
    ).toBe('line1\nline2');
  });
});
