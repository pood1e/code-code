import { describe, expect, it } from 'vitest';
import {
  MessageRole,
  MessageStatus,
  MetricKind,
  SessionStatus,
  type SessionMessageDetail
} from '@agent-workbench/shared';

import {
  buildSessionAssistantMessageRecords,
  getSessionLastEventId,
  isSessionInteractionDisabled,
  isSessionRunning
} from './thread-adapter';

function createMessage(
  overrides: Partial<SessionMessageDetail> = {}
): SessionMessageDetail {
  return {
    id: 'message_1',
    sessionId: 'session_1',
    role: MessageRole.Assistant,
    status: MessageStatus.Streaming,
    inputContent: null,
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: 2,
    toolUses: [
      {
        id: 'tool_1',
        eventId: 5,
        callId: 'call_1',
        toolKind: 'shell',
        toolName: 'bash',
        args: { command: 'pwd' },
        result: null,
        error: null,
        createdAt: '2026-04-03T00:00:00.000Z'
      }
    ],
    metrics: [
      {
        id: 'metric_1',
        sessionId: 'session_1',
        messageId: 'message_1',
        eventId: 9,
        kind: MetricKind.TokenUsage,
        data: {
          inputTokens: 10,
          outputTokens: 20
        },
        createdAt: '2026-04-03T00:00:00.000Z'
      }
    ],
    createdAt: '2026-04-03T00:00:00.000Z',
    ...overrides
  };
}

describe('thread-adapter', () => {
  it('应合并消息持久态与运行态，并在依赖未变时复用旧记录引用', () => {
    const message = createMessage();
    const records = buildSessionAssistantMessageRecords(
      [message],
      {
        message_1: {
          thinkingText: 'runtime thinking',
          cancelledAt: '2026-04-03T01:00:00.000Z'
        }
      }
    );

    expect(records[0]).toEqual({
      message,
      runtime: {
        thinkingText: 'runtime thinking',
        usage: {
          inputTokens: 10,
          outputTokens: 20
        },
        cancelledAt: '2026-04-03T01:00:00.000Z'
      }
    });

    const reusedRecords = buildSessionAssistantMessageRecords(
      [message],
      {
        message_1: {
          thinkingText: 'runtime thinking',
          cancelledAt: '2026-04-03T01:00:00.000Z'
        }
      },
      records
    );

    expect(reusedRecords).toBe(records);
  });

  it('getSessionLastEventId 应取消息/tool/metric eventId 最大值', () => {
    expect(getSessionLastEventId([createMessage()], 3)).toBe(9);
  });

  it('应正确判断 session 是否运行中与是否禁用交互', () => {
    expect(isSessionRunning(SessionStatus.Running)).toBe(true);
    expect(isSessionInteractionDisabled(SessionStatus.Creating)).toBe(true);
    expect(isSessionInteractionDisabled(SessionStatus.Ready)).toBe(false);
  });
});
