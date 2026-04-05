import {
  QueryClientProvider,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type {
  AgentRunnerDetail,
  AgentRunnerSummary,
  ChatSummary,
  PagedSessionMessages,
  Project,
  RunnerTypeResponse,
  SendSessionMessageInput,
  SessionDetail,
  SessionSummary
} from '@agent-workbench/shared';
import { SessionStatus, SessionWorkspaceMode } from '@agent-workbench/shared';

import { useSessionPageMutations } from '@/features/sessions/hooks/use-session-page-mutations';
import { useSessionPageQueries } from '@/features/sessions/hooks/use-session-page-queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { createTestQueryClient } from '@/test/render';

import { useProjectPageData } from './use-project-page-data';
import { useProjectSessionsPageState } from './use-project-sessions-page-state';
import { useSessionEventStream } from './use-session-event-stream';

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

vi.mock('./use-session-event-stream', () => ({
  useSessionEventStream: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

vi.mock('@/features/sessions/hooks/use-session-page-queries', () => ({
  useSessionPageQueries: vi.fn()
}));

vi.mock('@/features/sessions/hooks/use-session-page-mutations', () => ({
  useSessionPageMutations: vi.fn()
}));

function createProject(): Project {
  return {
    id: 'project-1',
    name: 'Project One',
    description: null,
    gitUrl: 'https://github.com/example/repo.git',
    workspacePath: '/tmp/project-1',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

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

function createQueryPendingResult<TData>(): UseQueryResult<TData, Error> {
  const result: UseQueryResult<TData, Error> = {
    data: undefined,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isError: false,
    isFetched: false,
    isFetchedAfterMount: false,
    isFetching: false,
    isLoading: false,
    isPending: true,
    isLoadingError: false,
    isInitialLoading: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: false,
    isEnabled: false,
    refetch: async () => result,
    status: 'pending',
    fetchStatus: 'idle',
    promise: new Promise<TData>(() => undefined)
  };

  return result;
}

function createInfiniteQuerySuccessResult(
  data: InfiniteData<PagedSessionMessages, string | undefined>
): UseInfiniteQueryResult<
  InfiniteData<PagedSessionMessages, string | undefined>,
  Error
> {
  const result: UseInfiniteQueryResult<
    InfiniteData<PagedSessionMessages, string | undefined>,
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
    hasNextPage: true,
    hasPreviousPage: false,
    isFetchNextPageError: false,
    isFetchingNextPage: false,
    isFetchPreviousPageError: false,
    isFetchingPreviousPage: false
  };

  return result;
}

function createMutationIdleResult<TData, TVariables>(
  mutateAsync: (variables: TVariables) => Promise<TData>
): UseMutationResult<TData, Error, TVariables, unknown> {
  const mutate: UseMutationResult<
    TData,
    Error,
    TVariables,
    unknown
  >['mutate'] = (nextVariables) => {
    void mutateAsync(nextVariables);
  };

  return {
    context: undefined,
    data: undefined,
    error: null,
    failureCount: 0,
    failureReason: null,
    isError: false,
    isIdle: true,
    isPaused: false,
    isPending: false,
    isSuccess: false,
    mutate,
    mutateAsync,
    reset: vi.fn(),
    status: 'idle',
    submittedAt: 0,
    variables: undefined
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function HookProbe() {
  const state = useProjectSessionsPageState();

  return (
    <div>
      <p>{state.selectedChatId ?? 'no-chat'}</p>
      <p>{state.selectedSessionId ?? 'no-session'}</p>
      <p>{state.showCreatePanel ? 'create-open' : 'create-closed'}</p>
      <p>{state.detailsPanelOpen ? 'details-open' : 'details-closed'}</p>
      <button type="button" onClick={state.openCreatePanel}>
        打开新建
      </button>
      <button type="button" onClick={() => state.disposeFromSelector('chat-1')}>
        删除当前会话
      </button>
      <button type="button" onClick={state.refreshSession}>
        刷新会话
      </button>
      <RouteEcho />
    </div>
  );
}

function renderHookProbe(route: string) {
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/projects/:id/chats/:chatId?"
            element={<HookProbe />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { queryClient, user };
}

const handleErrorMock = vi.fn();
const disposeMutationMock = vi.fn();
const sendMutationMock = vi.fn();
const cancelMutationMock = vi.fn();
const reloadMutationMock = vi.fn();
const editMutationMock = vi.fn();
const renameMutationMock = vi.fn();
const invalidateSessionThreadStateMock = vi.fn();

function mockProjectPageData() {
  vi.mocked(useProjectPageData).mockReturnValue({
    id: 'project-1',
    project: createProject(),
    projects: [createProject()],
    isLoading: false,
    isNotFound: false,
    goToProjects: vi.fn(),
    goToProjectTab: vi.fn()
  });
}

function mockSessionPageQueries({
  selectedChatId,
  createPanelOpen
}: {
  selectedChatId: string | null;
  createPanelOpen: boolean;
}): ReturnType<typeof useSessionPageQueries> {
  const chats = [
    createChatSummary('chat-1', 'session-1'),
    createChatSummary('chat-2', 'session-2')
  ];
  const selectedChat =
    createPanelOpen || !selectedChatId
      ? undefined
      : chats.find((chat) => chat.id === selectedChatId);
  const selectedSession =
    !selectedChat ? undefined : createSessionDetail(selectedChat.sessionId);

  return {
    chatsQuery: createQuerySuccessResult(chats),
    selectedChatQuery: selectedChat
      ? createQuerySuccessResult(selectedChat)
      : createQueryPendingResult(),
    sessionDetailQuery: selectedSession
      ? createQuerySuccessResult(selectedSession)
      : createQueryPendingResult(),
    sessionMessagesQuery: createInfiniteQuerySuccessResult({
      pages: [{ data: [], nextCursor: null }],
      pageParams: [undefined]
    }),
    selectedRunnerQuery: selectedSession
      ? createQuerySuccessResult(createRunnerDetail())
      : createQueryPendingResult(),
    selectedChat,
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
    queryError: null
  };
}

function mockSessionPageMutations() {
  vi.mocked(useSessionPageMutations).mockReturnValue({
    sendMutation: createMutationIdleResult(sendMutationMock),
    cancelMutation: createMutationIdleResult(cancelMutationMock),
    reloadMutation: createMutationIdleResult(reloadMutationMock),
    editMutation: createMutationIdleResult(editMutationMock),
    disposeMutation: createMutationIdleResult(disposeMutationMock),
    renameMutation: createMutationIdleResult(renameMutationMock),
    invalidateSessionThreadState: invalidateSessionThreadStateMock
  });
}

describe('useProjectSessionsPageState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(handleErrorMock);
    vi.mocked(useSessionEventStream).mockReturnValue(undefined);
    mockProjectPageData();
    mockSessionPageMutations();
    vi.mocked(useSessionPageQueries).mockImplementation(
      (_projectId, selectedChatId, createPanelOpen) =>
        mockSessionPageQueries({
          selectedChatId,
          createPanelOpen
        })
    );
    disposeMutationMock.mockResolvedValue(
      createChatSummary('chat-1', 'session-1')
    );
    renameMutationMock.mockResolvedValue(createChatSummary('chat-1', 'session-1'));
  });

  it('无效 chatId 应被纠正到首个有效会话路由', async () => {
    renderHookProbe('/projects/project-1/chats/chat-missing');

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats/chat-1'
      );
      expect(screen.getByText('chat-1')).toBeInTheDocument();
      expect(screen.getByText('session-1')).toBeInTheDocument();
    });
  });

  it('打开新建会话应回到 chats 根路由并进入 create panel', async () => {
    const { user } = renderHookProbe('/projects/project-1/chats/chat-1');

    await user.click(screen.getByRole('button', { name: '打开新建' }));

    await waitFor(() => {
      expect(screen.getByText('create-open')).toBeInTheDocument();
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats'
      );
    });
  });

  it('删除当前会话后应跳到下一个有效 chat', async () => {
    const { user } = renderHookProbe('/projects/project-1/chats/chat-1');

    await user.click(screen.getByRole('button', { name: '删除当前会话' }));

    await waitFor(() => {
      expect(disposeMutationMock).toHaveBeenCalledWith('chat-1');
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats/chat-2'
      );
      expect(screen.getByText('create-closed')).toBeInTheDocument();
    });
  });

  it('删除最后一个 chat 后应打开 create panel', async () => {
    vi.mocked(useSessionPageQueries).mockImplementation(
      (_projectId, selectedChatId, createPanelOpen) => ({
        ...mockSessionPageQueries({
          selectedChatId,
          createPanelOpen
        }),
        chatsQuery: createQuerySuccessResult([
          createChatSummary('chat-1', 'session-1')
        ]),
        selectedChatQuery: selectedChatId
          ? createQuerySuccessResult(createChatSummary('chat-1', 'session-1'))
          : createQueryPendingResult()
      })
    );

    const { user } = renderHookProbe('/projects/project-1/chats/chat-1');

    await user.click(screen.getByRole('button', { name: '删除当前会话' }));

    await waitFor(() => {
      expect(screen.getByText('create-open')).toBeInTheDocument();
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats'
      );
    });
  });

  it('刷新会话应失效当前会话相关缓存', async () => {
    const { queryClient, user } = renderHookProbe(
      '/projects/project-1/chats/chat-1'
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: '刷新会话' }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['chats', 'list', 'project-1']
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['chats', 'detail', 'chat-1']
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessions', 'detail', 'session-1']
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessions', 'messages', 'session-1']
      });
    });
  });
});
