import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MessageRole,
  MessageStatus,
  type SessionMessageDetail
} from '@agent-workbench/shared';

import { SessionAssistantThreadHistory } from './SessionAssistantThreadHistory';
import { ThreadConfigContext } from './context';
import type { SessionAssistantMessageRecord } from './thread-adapter';

const virtuosoMock = vi.hoisted(() => ({
  scrollToIndex: vi.fn(),
  lastInitialTopMostItemIndex: undefined as number | undefined
}));

vi.mock('react-virtuoso', async () => {
  const ReactImpl = await import('react');

  const Virtuoso = ReactImpl.forwardRef<
    { scrollToIndex: typeof virtuosoMock.scrollToIndex },
    {
      firstItemIndex: number;
      totalCount: number;
      initialTopMostItemIndex?: number;
      itemContent: (index: number) => React.ReactNode;
      components?: {
        Scroller?: React.ComponentType<React.ComponentPropsWithoutRef<'div'>>;
        Header?: React.ComponentType;
        Footer?: React.ComponentType;
      };
    }
  >(function VirtuosoMock(
    {
      firstItemIndex,
      totalCount,
      initialTopMostItemIndex,
      itemContent,
      components
    },
    ref
  ) {
    virtuosoMock.lastInitialTopMostItemIndex = initialTopMostItemIndex;
    ReactImpl.useImperativeHandle(ref, () => ({
      scrollToIndex: virtuosoMock.scrollToIndex
    }));

    const Scroller = components?.Scroller ?? 'div';
    const Header = components?.Header;
    const Footer = components?.Footer;

    return (
      <Scroller>
        {Header ? <Header /> : null}
        {Array.from({ length: totalCount }, (_, index) => (
          <ReactImpl.Fragment key={firstItemIndex + index}>
            {itemContent(firstItemIndex + index)}
          </ReactImpl.Fragment>
        ))}
        {Footer ? <Footer /> : null}
      </Scroller>
    );
  });

  return { Virtuoso };
});

vi.mock('./components/AssistantMessageContent', () => ({
  AssistantTextPart: ({ text }: { text: string }) => <div>{text}</div>,
  AssistantReasoningPart: ({ text }: { text: string }) => (
    <div>thinking:{text}</div>
  ),
  AssistantToolPart: ({
    toolName,
    args,
    result
  }: {
    toolName: string;
    args: unknown;
    result?: unknown;
  }) => (
    <div>
      <span>tool:{toolName}</span>
      <span>{JSON.stringify(args)}</span>
      {result ? <span>{JSON.stringify(result)}</span> : null}
    </div>
  ),
  AssistantEmptyPart: () => <div>running</div>
}));

function createUserRecord(): SessionAssistantMessageRecord {
  const message: SessionMessageDetail = {
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

  return {
    message,
    runtime: undefined
  };
}

function createAssistantRecord(
  overrides?: Partial<SessionAssistantMessageRecord>
): SessionAssistantMessageRecord {
  const message: SessionMessageDetail = {
    id: 'message-assistant',
    sessionId: 'session-1',
    role: MessageRole.Assistant,
    status: MessageStatus.Complete,
    inputContent: null,
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [
      { type: 'text', text: '这是回复' },
      {
        type: 'tool_call',
        toolCallId: 'tool-1',
        toolName: 'read_file',
        args: { path: 'AGENTS.md' },
        result: { ok: true }
      }
    ],
    errorPayload: null,
    cancelledAt: null,
    eventId: 2,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T10:00:01.000Z'
  };

  return {
    message,
    runtime: {
      usage: {
        inputTokens: 10,
        outputTokens: 6,
        costUsd: 0.12,
        modelId: 'qwen-max'
      }
    },
    ...overrides
  };
}

function renderHistory(props: {
  records: SessionAssistantMessageRecord[];
  firstItemIndex?: number;
  onLoadMore?: () => void;
  onReload?: () => Promise<void>;
}) {
  return render(
    <ThreadConfigContext.Provider value={{ assistantName: 'Mock Agent' }}>
      <SessionAssistantThreadHistory
        records={props.records}
        firstItemIndex={props.firstItemIndex ?? 100_000}
        onLoadMore={props.onLoadMore}
        onReload={props.onReload ?? vi.fn().mockResolvedValue(undefined)}
      />
    </ThreadConfigContext.Provider>
  );
}

describe('SessionAssistantThreadHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    virtuosoMock.lastInitialTopMostItemIndex = undefined;
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('用户消息历史应只提供复制，不提供编辑', async () => {
    renderHistory({
      records: [createUserRecord(), createAssistantRecord()]
    });

    expect(screen.getByText('原始问题')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '编辑用户消息' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '复制用户消息' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('原始问题');
    });
    expect(
      screen.getByRole('button', { name: '已复制用户消息' })
    ).toBeInTheDocument();
  });

  it('assistant 消息应展示 usage 汇总，并且没有 loadMore 时不显示入口', () => {
    renderHistory({
      records: [createAssistantRecord()]
    });

    expect(
      screen.queryByRole('button', { name: '加载更早消息' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('In: 10 · Out: 6 · $0.12 · qwen-max')
    ).toBeInTheDocument();
  });

  it('首屏应锚到第一条消息，只有最后一条消息 id 变化后才滚到底', async () => {
    const { rerender } = render(
      <ThreadConfigContext.Provider value={{ assistantName: 'Mock Agent' }}>
        <SessionAssistantThreadHistory
          records={[createUserRecord(), createAssistantRecord()]}
          firstItemIndex={100_000}
          onReload={vi.fn().mockResolvedValue(undefined)}
        />
      </ThreadConfigContext.Provider>
    );

    expect(virtuosoMock.scrollToIndex).toHaveBeenCalledTimes(1);
    expect(virtuosoMock.scrollToIndex).toHaveBeenCalledWith({
      index: 0,
      align: 'start',
      behavior: 'auto'
    });
    expect(virtuosoMock.lastInitialTopMostItemIndex).toBe(0);

    rerender(
      <ThreadConfigContext.Provider value={{ assistantName: 'Mock Agent' }}>
        <SessionAssistantThreadHistory
          records={[
            createUserRecord(),
            createAssistantRecord(),
            createAssistantRecord({
              message: {
                ...createAssistantRecord().message,
                id: 'message-assistant-2',
                contentParts: [{ type: 'text', text: '新增回复' }],
                createdAt: '2026-04-03T10:00:02.000Z'
              }
            })
          ]}
          firstItemIndex={100_000}
          onReload={vi.fn().mockResolvedValue(undefined)}
        />
      </ThreadConfigContext.Provider>
    );

    await waitFor(() => {
      expect(virtuosoMock.scrollToIndex).toHaveBeenCalledTimes(2);
    });
    expect(virtuosoMock.scrollToIndex).toHaveBeenLastCalledWith({
      index: 2,
      align: 'end',
      behavior: 'auto'
    });
  });

  it('重跑失败时应展示就地错误', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn().mockRejectedValue(new Error('reload failed'));

    renderHistory({
      records: [createAssistantRecord()],
      onReload
    });

    await user.click(screen.getByRole('button', { name: '重跑' }));

    expect(await screen.findByText('reload failed')).toBeInTheDocument();
  });

  it('应展示加载更早消息入口、运行中占位与 runtime thinking 覆盖', async () => {
    const onLoadMore = vi.fn();
    renderHistory({
      firstItemIndex: 42,
      onLoadMore,
      records: [
        createAssistantRecord({
          message: {
            ...createAssistantRecord().message,
            id: 'message-assistant-thinking',
            status: MessageStatus.Streaming,
            contentParts: [{ type: 'thinking', text: '旧 thinking' }],
            createdAt: '2026-04-03T10:00:02.000Z'
          },
          runtime: {
            thinkingText: '新的 thinking'
          }
        }),
        createAssistantRecord({
          message: {
            ...createAssistantRecord().message,
            id: 'message-assistant-empty',
            status: MessageStatus.Streaming,
            contentParts: [],
            createdAt: '2026-04-03T10:00:03.000Z'
          },
          runtime: undefined
        })
      ]
    });

    expect(
      screen.getByRole('button', { name: '加载更早消息' })
    ).toBeInTheDocument();
    expect(screen.getByText('thinking:新的 thinking')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '加载更早消息' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('assistant 错误与中止状态应对用户可见', () => {
    renderHistory({
      records: [
        createAssistantRecord({
          message: {
            ...createAssistantRecord().message,
            id: 'message-assistant-error',
            cancelledAt: '2026-04-03T10:00:04.000Z',
            errorPayload: {
              code: 'USER_CANCELLED',
              message: '用户已取消',
              recoverable: true
            },
            createdAt: '2026-04-03T10:00:04.000Z'
          }
        })
      ]
    });

    expect(screen.getByText('USER_CANCELLED')).toBeInTheDocument();
    expect(screen.getByText('用户已取消')).toBeInTheDocument();
    expect(screen.getByText('已中止')).toBeInTheDocument();
  });
});
