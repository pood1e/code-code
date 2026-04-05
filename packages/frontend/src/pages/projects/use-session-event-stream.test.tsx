import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MessageRole,
  MessageStatus,
  SessionStatus,
  SessionWorkspaceMode,
  type OutputChunk,
  type PagedSessionMessages,
  type SessionDetail,
  type SessionMessageDetail,
  type SessionSummary
} from '@agent-workbench/shared';

import { queryKeys } from '@/query/query-keys';
import { useSessionRuntimeStore } from '@/store/session-runtime-store';
import { createTestQueryClient } from '@/test/render';

import { useSessionEventStream } from './use-session-event-stream';

const sessionsApiMock = vi.hoisted(() => ({
  createSessionEventSource: vi.fn(),
  parseSessionEvent: vi.fn()
}));

vi.mock('@/api/sessions', () => sessionsApiMock);

class FakeSessionEventSource {
  onerror: ((event: Event) => void) | null = null;

  private readonly listeners = new Map<
    string,
    Array<(event: MessageEvent<string> | Event) => void>
  >();

  private closed = false;

  addEventListener(
    type: string,
    listener: (event: MessageEvent<string> | Event) => void
  ) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, chunk: OutputChunk) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(chunk)
    });

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  fail() {
    this.onerror?.(new Event('error'));
  }

  isClosed() {
    return this.closed;
  }
}

function createSessionDetail(overrides: Partial<SessionDetail> = {}): SessionDetail {
  return {
    id: 'session-1',
    scopeId: 'project-1',
    runnerId: 'runner-1',
    runnerType: 'mock',
    status: SessionStatus.Running,
    lastEventId: 2,
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
    defaultRuntimeConfig: null,
    ...overrides
  };
}

function createSessionSummary(): SessionSummary {
  return {
    id: 'session-1',
    scopeId: 'project-1',
    runnerId: 'runner-1',
    runnerType: 'mock',
    status: SessionStatus.Running,
    lastEventId: 2,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createAssistantMessage(
  overrides: Partial<SessionMessageDetail> = {}
): SessionMessageDetail {
  return {
    id: 'message-assistant',
    sessionId: 'session-1',
    role: MessageRole.Assistant,
    status: MessageStatus.Streaming,
    inputContent: null,
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: 5,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T10:00:01.000Z',
    ...overrides
  };
}

function createUserMessage(
  overrides: Partial<SessionMessageDetail> = {}
): SessionMessageDetail {
  return {
    id: 'message-user',
    sessionId: 'session-1',
    role: MessageRole.User,
    status: MessageStatus.Complete,
    inputContent: {
      prompt: '第一轮问题'
    },
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: 4,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T10:00:00.000Z',
    ...overrides
  };
}

function renderEventStreamHook({
  session = createSessionDetail(),
  messages = [createAssistantMessage()],
  messagesReady = true,
  queryClient = createTestQueryClient()
}: {
  session?: SessionDetail;
  messages?: SessionMessageDetail[];
  messagesReady?: boolean;
  queryClient?: ReturnType<typeof createTestQueryClient>;
} = {}) {
  return {
    queryClient,
    ...renderHook(
      ({
        currentSession,
        currentMessages,
        currentMessagesReady
      }: {
        currentSession?: SessionDetail;
        currentMessages: SessionMessageDetail[];
        currentMessagesReady: boolean;
      }) =>
        useSessionEventStream({
          scopeId: 'project-1',
          session: currentSession,
          messages: currentMessages,
          messagesReady: currentMessagesReady,
          queryClient
        }),
      {
        initialProps: {
          currentSession: session,
          currentMessages: messages,
          currentMessagesReady: messagesReady
        }
      }
    )
  };
}

describe('useSessionEventStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    useSessionRuntimeStore.setState({ stateBySessionId: {} });
    sessionsApiMock.parseSessionEvent.mockImplementation(
      (event: { data: string }) => JSON.parse(event.data) as OutputChunk
    );
  });

  it('messagesReady=false 时不应建立 SSE；切到 true 后应从 session/message 最大 eventId 之后开始订阅', () => {
    const source = new FakeSessionEventSource();
    sessionsApiMock.createSessionEventSource.mockReturnValue(source);

    const { rerender } = renderEventStreamHook({
      messagesReady: false,
      session: createSessionDetail({ lastEventId: 2 }),
      messages: [createAssistantMessage({ eventId: 8 })]
    });

    expect(sessionsApiMock.createSessionEventSource).not.toHaveBeenCalled();

    rerender({
      currentSession: createSessionDetail({ lastEventId: 2 }),
      currentMessages: [createAssistantMessage({ eventId: 8 })],
      currentMessagesReady: true
    });

    expect(sessionsApiMock.createSessionEventSource).toHaveBeenCalledWith(
      'session-1',
      8
    );
  });

  it('应把 thinking/text/tool/result 按 contentParts 合并进消息缓存，usage 进 runtime store，done 不应关闭流，非 running 状态应清掉 thinking', async () => {
    const source = new FakeSessionEventSource();
    const queryClient = createTestQueryClient();
    const session = createSessionDetail();
    const initialMessage = createAssistantMessage();

    queryClient.setQueryData(queryKeys.sessions.detail('session-1'), session);
    queryClient.setQueryData(queryKeys.sessions.list('project-1'), [
      createSessionSummary()
    ]);
    queryClient.setQueryData(queryKeys.sessions.messages('session-1'), {
      pages: [
        {
          data: [initialMessage],
          nextCursor: null
        } satisfies PagedSessionMessages
      ],
      pageParams: [undefined]
    });

    sessionsApiMock.createSessionEventSource.mockReturnValue(source);
    renderEventStreamHook({
      session,
      messages: [initialMessage],
      messagesReady: true,
      queryClient
    });

    act(() => {
      source.emit('thinking_delta', {
        kind: 'thinking_delta',
        sessionId: 'session-1',
        eventId: 6,
        timestampMs: 1000,
        messageId: 'message-assistant',
        data: {
          deltaText: '思考中',
          accumulatedText: '思考中'
        }
      });
      source.emit('message_delta', {
        kind: 'message_delta',
        sessionId: 'session-1',
        eventId: 7,
        timestampMs: 1001,
        messageId: 'message-assistant',
        data: {
          deltaText: '第一段',
          accumulatedText: '第一段'
        }
      });
      source.emit('tool_use', {
        kind: 'tool_use',
        sessionId: 'session-1',
        eventId: 8,
        timestampMs: 1002,
        messageId: 'message-assistant',
        data: {
          toolKind: 'fallback',
          toolName: 'read_file',
          callId: 'call-1',
          args: { path: 'AGENTS.md' },
          result: { ok: true }
        }
      });
      source.emit('message_delta', {
        kind: 'message_delta',
        sessionId: 'session-1',
        eventId: 9,
        timestampMs: 1003,
        messageId: 'message-assistant',
        data: {
          deltaText: '第二段',
          accumulatedText: '第一段第二段'
        }
      });
      source.emit('usage', {
        kind: 'usage',
        sessionId: 'session-1',
        eventId: 10,
        timestampMs: 1004,
        messageId: 'message-assistant',
        data: {
          inputTokens: 11,
          outputTokens: 22,
          modelId: 'mock-runner'
        }
      });
      source.emit('message_result', {
        kind: 'message_result',
        sessionId: 'session-1',
        eventId: 11,
        timestampMs: 1005,
        messageId: 'message-assistant',
        data: {
          text: '第一段第二段',
          stopReason: 'stop'
        }
      });
      source.emit('done', {
        kind: 'done',
        sessionId: 'session-1',
        eventId: 12,
        timestampMs: 1006,
        messageId: 'message-assistant'
      });
      source.emit('session_status', {
        kind: 'session_status',
        sessionId: 'session-1',
        eventId: 13,
        timestampMs: 1007,
        data: {
          status: SessionStatus.Ready,
          prevStatus: SessionStatus.Running
        }
      });
    });

    const messagesCache = queryClient.getQueryData<{
      pages: PagedSessionMessages[];
    }>(queryKeys.sessions.messages('session-1'));
    const assistantMessage = messagesCache?.pages[0]?.data[0];

    expect(assistantMessage).toMatchObject({
      id: 'message-assistant',
      status: MessageStatus.Complete,
      outputText: '第一段第二段',
      contentParts: [
        {
          type: 'thinking',
          text: '思考中'
        },
        {
          type: 'text',
          text: '第一段'
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
          text: '第二段'
        }
      ]
    });
    expect(
      useSessionRuntimeStore.getState().stateBySessionId['session-1'][
        'message-assistant'
      ]
    ).toEqual({
      thinkingText: undefined,
      usage: {
        inputTokens: 11,
        outputTokens: 22,
        modelId: 'mock-runner'
      },
      cancelledAt: undefined
    });
    expect(
      queryClient.getQueryData<SessionDetail>(
        queryKeys.sessions.detail('session-1')
      )
    ).toMatchObject({
      lastEventId: 13,
      status: SessionStatus.Ready
    });
    expect(
      queryClient.getQueryData<SessionSummary[]>(
        queryKeys.sessions.list('project-1')
      )
    ).toEqual([
      expect.objectContaining({
        id: 'session-1',
        lastEventId: 13,
        status: SessionStatus.Ready
      })
    ]);
    expect(source.isClosed()).toBe(false);
  });

  it('SSE 断线时应关闭旧连接、失效消息/详情/列表缓存，并在 2s 后重连', async () => {
    vi.useFakeTimers();
    const firstSource = new FakeSessionEventSource();
    const secondSource = new FakeSessionEventSource();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    sessionsApiMock.createSessionEventSource
      .mockReturnValueOnce(firstSource)
      .mockReturnValueOnce(secondSource);

    renderEventStreamHook({
      session: createSessionDetail(),
      messages: [createAssistantMessage()],
      messagesReady: true,
      queryClient
    });

    act(() => {
      firstSource.fail();
    });

    expect(firstSource.isClosed()).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.messages('session-1')
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.detail('session-1')
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.list('project-1')
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(sessionsApiMock.createSessionEventSource).toHaveBeenCalledTimes(2);
    expect(sessionsApiMock.createSessionEventSource).toHaveBeenLastCalledWith(
      'session-1',
      5
    );

    invalidateSpy.mockRestore();
    vi.useRealTimers();
  });

  it('同一轮断线连续触发多次 onerror 时，应只失效一次缓存并只重连一次', async () => {
    vi.useFakeTimers();
    const firstSource = new FakeSessionEventSource();
    const secondSource = new FakeSessionEventSource();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    sessionsApiMock.createSessionEventSource
      .mockReturnValueOnce(firstSource)
      .mockReturnValueOnce(secondSource);

    renderEventStreamHook({
      session: createSessionDetail(),
      messages: [createAssistantMessage()],
      messagesReady: true,
      queryClient
    });

    act(() => {
      firstSource.fail();
      firstSource.fail();
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(sessionsApiMock.createSessionEventSource).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(sessionsApiMock.createSessionEventSource).toHaveBeenCalledTimes(2);

    invalidateSpy.mockRestore();
    vi.useRealTimers();
  });

  it('收到 USER_CANCELLED 错误时，应把取消时间写入 runtime store 并更新消息错误状态', async () => {
    const source = new FakeSessionEventSource();
    const queryClient = createTestQueryClient();
    const session = createSessionDetail();
    const initialMessage = createAssistantMessage();

    queryClient.setQueryData(queryKeys.sessions.messages('session-1'), {
      pages: [
        {
          data: [initialMessage],
          nextCursor: null
        } satisfies PagedSessionMessages
      ],
      pageParams: [undefined]
    });

    sessionsApiMock.createSessionEventSource.mockReturnValue(source);
    renderEventStreamHook({
      session,
      messages: [initialMessage],
      messagesReady: true,
      queryClient
    });

    act(() => {
      source.emit('session_error', {
        kind: 'error',
        sessionId: 'session-1',
        eventId: 14,
        timestampMs: 2_000,
        messageId: 'message-assistant',
        data: {
          code: 'USER_CANCELLED',
          message: '用户取消了本轮生成',
          recoverable: true
        }
      });
    });

    await waitFor(() => {
      expect(
        useSessionRuntimeStore.getState().stateBySessionId['session-1'][
          'message-assistant'
        ]
      ).toEqual({
        thinkingText: undefined,
        cancelledAt: new Date(2_000).toISOString()
      });
    });

    const messagesCache = queryClient.getQueryData<{
      pages: PagedSessionMessages[];
    }>(queryKeys.sessions.messages('session-1'));
    expect(messagesCache?.pages[0]?.data[0]).toMatchObject({
      status: MessageStatus.Error,
      eventId: 14,
      errorPayload: {
        code: 'USER_CANCELLED',
        message: '用户取消了本轮生成',
        recoverable: true
      }
    });
  });

  it('当 SSE 先于消息 refetch 到达且目标 assistant 消息还不在缓存里时，应先补占位消息再合并增量', () => {
    const source = new FakeSessionEventSource();
    const queryClient = createTestQueryClient();
    const userMessage = createUserMessage();

    queryClient.setQueryData(queryKeys.sessions.messages('session-1'), {
      pages: [
        {
          data: [userMessage],
          nextCursor: null
        } satisfies PagedSessionMessages
      ],
      pageParams: [undefined]
    });

    sessionsApiMock.createSessionEventSource.mockReturnValue(source);
    renderEventStreamHook({
      session: createSessionDetail({ lastEventId: 4 }),
      messages: [userMessage],
      messagesReady: true,
      queryClient
    });

    act(() => {
      source.emit('thinking_delta', {
        kind: 'thinking_delta',
        sessionId: 'session-1',
        eventId: 5,
        timestampMs: 2_000,
        messageId: 'message-assistant-late',
        data: {
          deltaText: '正在处理',
          accumulatedText: '正在处理'
        }
      });
      source.emit('message_delta', {
        kind: 'message_delta',
        sessionId: 'session-1',
        eventId: 6,
        timestampMs: 2_001,
        messageId: 'message-assistant-late',
        data: {
          deltaText: '第二轮回复',
          accumulatedText: '第二轮回复'
        }
      });
      source.emit('message_result', {
        kind: 'message_result',
        sessionId: 'session-1',
        eventId: 7,
        timestampMs: 2_002,
        messageId: 'message-assistant-late',
        data: {
          text: '第二轮回复',
          stopReason: 'stop'
        }
      });
    });

    const messagesCache = queryClient.getQueryData<{
      pages: PagedSessionMessages[];
    }>(queryKeys.sessions.messages('session-1'));

    expect(messagesCache?.pages[0]?.data).toEqual([
      userMessage,
      expect.objectContaining({
        id: 'message-assistant-late',
        role: MessageRole.Assistant,
        status: MessageStatus.Complete,
        outputText: '第二轮回复',
        thinkingText: '正在处理',
        contentParts: [
          {
            type: 'thinking',
            text: '正在处理'
          },
          {
            type: 'text',
            text: '第二轮回复'
          }
        ],
        eventId: 7,
        createdAt: new Date(2_000).toISOString()
      })
    ]);
  });

  it('切换到另一条 session 时，应关闭旧 SSE 并从新 session 的最新 eventId 重新订阅', () => {
    const firstSource = new FakeSessionEventSource();
    const secondSource = new FakeSessionEventSource();

    sessionsApiMock.createSessionEventSource
      .mockReturnValueOnce(firstSource)
      .mockReturnValueOnce(secondSource);

    const { rerender } = renderEventStreamHook({
      session: createSessionDetail({
        id: 'session-1',
        lastEventId: 4
      }),
      messages: [createAssistantMessage({ sessionId: 'session-1', eventId: 6 })],
      messagesReady: true
    });

    expect(sessionsApiMock.createSessionEventSource).toHaveBeenNthCalledWith(
      1,
      'session-1',
      6
    );

    rerender({
      currentSession: createSessionDetail({
        id: 'session-2',
        lastEventId: 10
      }),
      currentMessages: [
        createAssistantMessage({
          id: 'message-session-2',
          sessionId: 'session-2',
          eventId: 12
        })
      ],
      currentMessagesReady: true
    });

    expect(firstSource.isClosed()).toBe(true);
    expect(sessionsApiMock.createSessionEventSource).toHaveBeenNthCalledWith(
      2,
      'session-2',
      12
    );
  });
});
