import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentRunnerDetail,
  AgentRunnerSummary,
  ChatSummary,
  Profile,
  RunnerTypeResponse,
  SessionDetail
} from '@agent-workbench/shared';
import type { SessionSummary } from '@agent-workbench/shared';
import { SessionStatus, SessionWorkspaceMode } from '@agent-workbench/shared';
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult
} from '@tanstack/react-query';

import { ProjectSessionsPageContent } from './ProjectSessionsPageContent';
import type { useProjectSessionsPageState } from './use-project-sessions-page-state';

vi.mock('@/features/sessions/components/SessionSelector', () => ({
  SessionSelector: ({
    placeholder,
    selectedChatId
  }: {
    placeholder?: string;
    selectedChatId: string | null;
  }) => <div>{placeholder ?? selectedChatId ?? '未选择会话'}</div>
}));

vi.mock('@/features/sessions/components/SessionStatusBadge', () => ({
  SessionStatusBadge: ({ status }: { status: string }) => <div>{status}</div>
}));

vi.mock('@/features/sessions/panels/CreateSessionPanel', () => ({
  CreateSessionPanel: ({
    onCreated
  }: {
    onCreated: (chat: ChatSummary) => void;
  }) => (
    <div>
      <p>创建会话面板</p>
      <button
        type="button"
        onClick={() => onCreated(createChatSummary('chat-new', 'session-new'))}
      >
        创建成功
      </button>
    </div>
  )
}));

vi.mock('@/features/sessions/panels/SessionDetailsPanel', () => ({
  SessionDetailsPanel: () => <div role="dialog">会话设置</div>
}));

vi.mock('@/features/chat/runtime/assistant-ui/SessionAssistantThread', () => ({
  SessionAssistantThread: ({
    assistantName
  }: {
    assistantName?: string;
  }) => <div>会话线程: {assistantName ?? '未命名'}</div>
}));

function createSessionSummary(id: string): SessionSummary {
  return {
    id,
    scopeId: 'project-1',
    runnerId: 'runner-1',
    runnerType: 'mock',
    status: SessionStatus.Ready,
    lastEventId: 0,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createChatSummary(id: string, sessionId: string): ChatSummary {
  return {
    id,
    scopeId: 'project-1',
    sessionId,
    title: null,
    runnerId: 'runner-1',
    runnerType: 'mock',
    status: SessionStatus.Ready,
    lastEventId: 0,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createSessionDetail(id: string): SessionDetail {
  return {
    ...createSessionSummary(id),
    platformSessionConfig: {
      workspaceMode: SessionWorkspaceMode.Project,
      workspaceRoot: '/tmp/project-1',
      cwd: '/tmp/project-1',
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
    inputSchema: { fields: [] },
    runtimeConfigSchema: { fields: [] }
  };
}

function createRunner(): AgentRunnerSummary {
  return {
    id: 'runner-1',
    name: 'Mock Runner',
    description: null,
    type: 'mock',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createRunnerDetail(): AgentRunnerDetail {
  return {
    ...createRunner(),
    runnerConfig: {}
  };
}

function createQuerySuccessResult<TData>(
  data: TData
): UseQueryResult<TData, Error> {
  const result: UseQueryResult<TData, Error> = {
    data,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isError: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isLoadingError: false,
    isInitialLoading: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: true,
    isEnabled: true,
    refetch: async () => result,
    status: 'success',
    fetchStatus: 'idle',
    promise: Promise.resolve(data)
  };

  return result;
}

function createInfiniteQuerySuccessResult(
  hasNextPage = false
): UseInfiniteQueryResult<InfiniteData<{ data: []; nextCursor: null }, undefined>, Error> {
  const data: InfiniteData<{ data: []; nextCursor: null }, undefined> = {
    pages: [{ data: [], nextCursor: null }],
    pageParams: [undefined]
  };
  const result: UseInfiniteQueryResult<
    InfiniteData<{ data: []; nextCursor: null }, undefined>,
    Error
  > = {
    data,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isError: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isLoadingError: false,
    isInitialLoading: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: true,
    isEnabled: true,
    refetch: async () => result,
    status: 'success',
    fetchStatus: 'idle',
    promise: Promise.resolve(data),
    fetchNextPage: async () => result,
    fetchPreviousPage: async () => result,
    hasNextPage,
    hasPreviousPage: false,
    isFetchNextPageError: false,
    isFetchingNextPage: false,
    isFetchPreviousPageError: false,
    isFetchingPreviousPage: false
  };

  return result;
}

function createPageState(
  overrides: Partial<ReturnType<typeof useProjectSessionsPageState>> = {}
): ReturnType<typeof useProjectSessionsPageState> {
  const chats = [createChatSummary('chat-1', 'session-1')];
  const selectedSession = createSessionDetail('session-1');

  return {
    chatsQuery: createQuerySuccessResult(chats),
    selectedChatQuery: createQuerySuccessResult(chats[0]),
    selectedChat: chats[0],
    sessionDetailQuery: createQuerySuccessResult(selectedSession),
    sessionMessagesQuery: createInfiniteQuerySuccessResult(),
    selectedRunnerQuery: createQuerySuccessResult(createRunnerDetail()),
    selectedSession,
    flatMessages: [],
    runnerTypes: [createRunnerType()],
    runners: [createRunner()],
    profiles: [],
    resources: {
      skills: [],
      mcps: [],
      rules: []
    },
    selectedRunnerType: createRunnerType(),
    runnerNameById: { 'runner-1': 'Mock Runner' },
    selectedSessionMessagesReady: true,
    queryError: null,
    closePanel: vi.fn(),
    cancelSession: vi.fn(),
    disposeFromSelector: vi.fn(),
    editMessage: vi.fn(),
    loadMoreMessages: vi.fn(),
    openCreatePanel: vi.fn(),
    refreshSession: vi.fn(),
    reloadSession: vi.fn(),
    renameFromSelector: vi.fn(),
    selectChat: vi.fn(),
    sendMessage: vi.fn(),
    setDetailsPanelOpen: vi.fn(),
    createPanelOpen: false,
    detailsPanelOpen: false,
    disposingChatId: null,
    goToProjects: vi.fn(),
    isLoading: false,
    isNotFound: false,
    project: {
      id: 'project-1',
      name: 'Project One',
      description: null,
      gitUrl: 'https://github.com/example/repo.git',
      workspacePath: '/tmp/project-1',
      createdAt: '2026-04-03T10:00:00.000Z',
      updatedAt: '2026-04-03T10:00:00.000Z'
    },
    projects: [
      {
        id: 'project-1',
        name: 'Project One',
        description: null,
        gitUrl: 'https://github.com/example/repo.git',
        workspacePath: '/tmp/project-1',
        createdAt: '2026-04-03T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z'
      }
    ],
    projectId: 'project-1',
    renamingChatId: null,
    selectedRuntimeState: {},
    selectedChatId: 'chat-1',
    selectedSessionId: 'session-1',
    chats,
    showCreatePanel: false,
    ...overrides
  };
}

describe('ProjectSessionsPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('showCreatePanel 时应渲染创建面板，并在创建成功后关闭并切到新会话', async () => {
    const user = userEvent.setup();
    const closePanel = vi.fn();
    const selectChat = vi.fn();

    render(
      <ProjectSessionsPageContent
        {...createPageState({
          showCreatePanel: true,
          selectedSession: undefined,
          selectedChat: undefined,
          selectedSessionId: null,
          selectedChatId: null,
          closePanel,
          selectChat
        })}
      />
    );

    expect(screen.getByText('新建会话')).toBeInTheDocument();
    expect(await screen.findByText('创建会话面板')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '创建成功' }));

    expect(closePanel).toHaveBeenCalledTimes(1);
    expect(selectChat).toHaveBeenCalledWith('chat-new');
  });

  it('选中会话时应渲染状态和线程视图', async () => {
    render(<ProjectSessionsPageContent {...createPageState()} />);

    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(await screen.findByText('会话线程: Mock Runner')).toBeInTheDocument();
  });

  it('没有选中会话且未打开创建面板时，应展示空态', () => {
    render(
      <ProjectSessionsPageContent
        {...createPageState({
          showCreatePanel: false,
          selectedSession: undefined,
          selectedChat: undefined,
          selectedSessionId: null
        })}
      />
    );

    expect(screen.getByText('选择会话')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建会话' })).toBeInTheDocument();
  });
});
