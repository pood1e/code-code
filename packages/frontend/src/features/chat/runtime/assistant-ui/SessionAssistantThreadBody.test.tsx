import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDetail, SessionMessageDetail } from '@agent-workbench/shared';
import {
  MessageRole,
  MessageStatus,
  SessionStatus,
  SessionWorkspaceMode
} from '@agent-workbench/shared';

import { SessionAssistantThreadBody } from './SessionAssistantThreadBody';
import type { SessionAssistantMessageRecord } from './thread-adapter';

vi.mock('@assistant-ui/react', () => ({
  ThreadPrimitive: {
    Root: ({
      children,
      className
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <div data-testid="thread-root" className={className}>{children}</div>
  }
}));

vi.mock('./components/ThreadComposerUI', () => ({
  ThreadComposerUI: ({
    mode,
    composerError
  }: {
    mode: string;
    composerError: string | null;
  }) => (
    <div>
      <p>composer:{mode}</p>
      <p>{composerError ?? 'no-error'}</p>
    </div>
  )
}));

vi.mock('./SessionAssistantThreadHistory', () => ({
  SessionAssistantThreadHistory: ({
    canReload,
    firstItemIndex,
    onLoadMore
  }: {
    canReload: boolean;
    firstItemIndex: number;
    onLoadMore?: () => void;
  }) => (
    <div>
      <p>{canReload ? 'reload-enabled' : 'reload-disabled'}</p>
      <p>history:{firstItemIndex}</p>
      <p>{onLoadMore ? 'load-more-enabled' : 'load-more-disabled'}</p>
    </div>
  )
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

function createUserMessage(): SessionMessageDetail {
  return {
    id: 'message-user',
    sessionId: 'session-1',
    role: MessageRole.User,
    status: MessageStatus.Complete,
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
    createdAt: '2026-04-03T10:00:00.000Z'
  };
}

function createRecord(): SessionAssistantMessageRecord {
  return {
    message: createUserMessage(),
    runtime: undefined
  };
}

function renderBody(
  overrides: Partial<React.ComponentProps<typeof SessionAssistantThreadBody>> = {}
) {
  return render(
    <SessionAssistantThreadBody
      additionalInputFields={[]}
      canReload={true}
      composerDisabledHint={null}
      composerRecoveryAction={undefined}
      composerError={null}
      composerKey={0}
      composerMode="text"
      editMessage={vi.fn()}
      firstItemIndex={0}
      handleAdditionalValueChange={vi.fn()}
      handleRuntimeValueChange={vi.fn()}
      initialAdditionalInputValues={{}}
      initialRuntimeValues={{}}
      messagesReady={true}
      onReload={vi.fn()}
      runtimeMessages={[]}
      runnerContext={{}}
      runtimeFields={[]}
      sendMessage={vi.fn()}
      {...overrides}
    />
  );
}

describe('SessionAssistantThreadBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('消息为空且 ready 时应展示开始对话空态', () => {
    renderBody();

    expect(screen.getByText('开始对话')).toBeInTheDocument();
    expect(screen.getByText('消息会显示在这里')).toBeInTheDocument();
    expect(screen.getByText('composer:text')).toBeInTheDocument();
  });

  it('消息为空且未 ready 时应展示历史加载态', () => {
    renderBody({ messagesReady: false });

    expect(screen.getByText('正在加载历史消息...')).toBeInTheDocument();
  });

  it('存在消息时应渲染历史区并透传分页能力', async () => {
    renderBody({
      canReload: false,
      firstItemIndex: 42,
      onLoadMore: vi.fn(),
      runtimeMessages: [createRecord()]
    });

    expect(await screen.findByText('history:42')).toBeInTheDocument();
    expect(screen.getByText('reload-disabled')).toBeInTheDocument();
    expect(screen.getByText('load-more-enabled')).toBeInTheDocument();
  });

  it('线程根节点应裁剪整体滚动，保持消息区与输入区分层布局', () => {
    renderBody();

    expect(screen.getByTestId('thread-root')).toHaveClass('overflow-hidden');
    expect(screen.getByTestId('thread-root')).toHaveClass('flex-1');
  });
});
