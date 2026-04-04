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
import {
  SessionStatus,
  type AgentRunnerDetail,
  type AgentRunnerSummary,
  type PagedSessionMessages,
  type Project,
  type RunnerTypeResponse,
  type SendSessionMessageInput,
  type SessionDetail,
  type SessionSummary
} from '@agent-workbench/shared';

import { useSessionRuntimeStore } from '@/store/session-runtime-store';
import { createTestQueryClient } from '@/test/render';
import { useErrorMessage } from '@/hooks/use-error-message';

import { ProjectSessionsPage } from './ProjectSessionsPage';
import { useProjectPageData } from './use-project-page-data';
import { useSessionEventStream } from './use-session-event-stream';
import { useSessionPageMutations } from '@/features/sessions/hooks/use-session-page-mutations';
import { useSessionPageQueries } from '@/features/sessions/hooks/use-session-page-queries';

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

vi.mock('@/features/sessions/components/SessionSelector', () => ({
  SessionSelector: ({
    selectedSessionId,
    placeholder,
    onSelect,
    onDispose
  }: {
    selectedSessionId: string | null;
    placeholder?: string;
    onSelect: (sessionId: string) => void;
    onDispose: (sessionId: string) => void;
  }) => (
    <div>
      <p>{placeholder ?? selectedSessionId ?? '未选择会话'}</p>
      <button type="button" onClick={() => onSelect('session-2')}>
        切换备用会话
      </button>
      <button
        type="button"
        onClick={() => onDispose(selectedSessionId ?? 'session-1')}
      >
        删除当前会话
      </button>
      <button type="button" onClick={() => onDispose('session-2')}>
        删除备用会话
      </button>
    </div>
  )
}));

vi.mock('@/features/sessions/panels/CreateSessionPanel', () => ({
  CreateSessionPanel: ({
    onCreated,
    onCancel
  }: {
    onCreated: (session: SessionDetail) => void;
    onCancel: () => void;
  }) => (
    <div>
      <p>创建会话面板</p>
      <button type="button" onClick={() => onCreated(createSessionDetail('session-new'))}>
        创建成功
      </button>
      <button type="button" onClick={onCancel}>
        取消创建
      </button>
    </div>
  )
}));

vi.mock('@/features/sessions/panels/SessionDetailsPanel', () => ({
  SessionDetailsPanel: ({
    open,
    onClose
  }: {
    open: boolean;
    onClose?: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="会话设置">
        <p>配置详情已展开</p>
        <button type="button" onClick={onClose}>
          模拟点外部关闭
        </button>
      </div>
    ) : null
}));

vi.mock('@/features/chat/runtime/assistant-ui/SessionAssistantThread', () => ({
  SessionAssistantThread: ({
    messagesReady,
    onLoadMore,
    onReload,
    onEdit
  }: {
    messagesReady: boolean;
    onLoadMore?: () => void;
    onReload: () => Promise<void>;
    onEdit: (
      messageId: string,
      payload: { input: Record<string, unknown> }
    ) => Promise<void>;
  }) => (
    <div>
      <p>{messagesReady ? '消息已就绪' : '消息未就绪'}</p>
      <button type="button" onClick={onLoadMore}>
        加载更多
      </button>
      <button type="button" onClick={() => void onReload()}>
        触发重跑
      </button>
      <button
        type="button"
        onClick={() => void onEdit('message-1', { input: { prompt: 'edit' } })}
      >
        触发编辑
      </button>
    </div>
  )
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

function createSessionDetail(id: string): SessionDetail {
  return {
    ...createSessionSummary(id),
    platformSessionConfig: {
      cwd: '/tmp/project-1',
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
    fetchNextPage: async () => {
      await fetchNextPageMock();
      return result;
    },
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

function renderProjectSessionsPage(route: string) {
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/projects/:id/chats/:sessionId?"
            element={
              <>
                <ProjectSessionsPage />
                <RouteEcho />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return {
    queryClient,
    user
  };
}

const sendMutationMock = vi.fn();
const cancelMutationMock = vi.fn();
const reloadMutationMock = vi.fn();
const editMutationMock = vi.fn();
const disposeMutationMock = vi.fn();
const invalidateSessionThreadStateMock = vi.fn();
const fetchNextPageMock = vi.fn();
const handleErrorMock = vi.fn();

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
  selectedSessionId,
  createPanelOpen
}: {
  selectedSessionId: string | null;
  createPanelOpen: boolean;
}): ReturnType<typeof useSessionPageQueries> {
  const selectedSession =
    createPanelOpen || !selectedSessionId
      ? undefined
      : createSessionDetail(selectedSessionId);

  return {
    sessionsQuery: createQuerySuccessResult([
      createSessionSummary('session-1'),
      createSessionSummary('session-2')
    ]),
    sessionDetailQuery: selectedSession
      ? createQuerySuccessResult(selectedSession)
      : createQueryPendingResult(),
    sessionMessagesQuery: createInfiniteQuerySuccessResult({
        pages: [
          {
            data: [],
            nextCursor: null
          }
        ],
        pageParams: [undefined]
    }),
    selectedRunnerQuery: selectedSession
      ? createQuerySuccessResult(createRunnerDetail())
      : createQueryPendingResult(),
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
    runnerNameById: {
      'runner-1': 'Mock Runner'
    },
    selectedSessionMessagesReady: true,
    queryError: null
  };
}

function mockSessionPageMutations() {
  vi.mocked(useSessionPageMutations).mockReturnValue({
    sendMutation: createMutationIdleResult<
      PagedSessionMessages,
      SendSessionMessageInput
    >(sendMutationMock),
    cancelMutation: createMutationIdleResult<SessionDetail, void>(
      cancelMutationMock
    ),
    reloadMutation: createMutationIdleResult<SessionDetail, void>(
      reloadMutationMock
    ),
    editMutation: createMutationIdleResult<
      SessionDetail,
      {
        messageId: string;
        payload: SendSessionMessageInput;
      }
    >(editMutationMock),
    disposeMutation: createMutationIdleResult<string, string>(
      disposeMutationMock
    ),
    invalidateSessionThreadState: invalidateSessionThreadStateMock
  });
}

describe('ProjectSessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(handleErrorMock);
    mockProjectPageData();
    mockSessionPageMutations();
    vi.mocked(useSessionEventStream).mockReturnValue(undefined);
    vi.mocked(useSessionPageQueries).mockImplementation(
      (_projectId, selectedSessionId, createPanelOpen) => {
        return mockSessionPageQueries({
          selectedSessionId,
          createPanelOpen
        });
      }
    );
    sendMutationMock.mockResolvedValue({
      data: [],
      nextCursor: null
    });
    cancelMutationMock.mockResolvedValue(createSessionDetail('session-1'));
    reloadMutationMock.mockResolvedValue(createSessionDetail('session-1'));
    editMutationMock.mockResolvedValue(createSessionDetail('session-1'));
    disposeMutationMock.mockResolvedValue('session-1');
    invalidateSessionThreadStateMock.mockResolvedValue(undefined);
    fetchNextPageMock.mockResolvedValue(undefined);
    useSessionRuntimeStore.setState({ stateBySessionId: {} });
  });

  it('无显式 sessionId 但已有会话时，应自动选中第一条会话', async () => {
    renderProjectSessionsPage('/projects/project-1/chats');

    await waitFor(() => {
      expect(screen.getByText('消息已就绪')).toBeInTheDocument();
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats/session-1'
      );
    });
  });

  it('URL 指向无效 sessionId 时，应纠正到第一条有效会话', async () => {
    renderProjectSessionsPage('/projects/project-1/chats/session-missing');

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats/session-1'
      );
    });
  });

  it('选中会话时应展示会话线程；点击新建会话应回到新建面板；点击加载更多/重跑/编辑应调用对应 mutation', async () => {
    const { user } = renderProjectSessionsPage(
      '/projects/project-1/chats/session-1'
    );

    expect(screen.getByText('session-1')).toBeInTheDocument();
    expect(screen.getByText('消息已就绪')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '加载更多'
      })
    );
    expect(fetchNextPageMock).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole('button', {
        name: '触发重跑'
      })
    );
    await waitFor(() => {
      expect(reloadMutationMock).toHaveBeenCalledTimes(1);
    });
    expect(invalidateSessionThreadStateMock).toHaveBeenCalledWith(
      'session-1',
      'project-1'
    );

    await user.click(
      screen.getByRole('button', {
        name: '触发编辑'
      })
    );
    await waitFor(() => {
      expect(editMutationMock).toHaveBeenCalledWith({
        messageId: 'message-1',
        payload: {
          input: {
            prompt: 'edit'
          }
        }
      });
    });

    await user.click(
      screen.getByRole('button', {
        name: '新建会话'
      })
    );

    await waitFor(() => {
      expect(screen.getByText('创建会话面板')).toBeInTheDocument();
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats'
      );
    });
  });

  it('从列表删除当前会话后，应调用 dispose 并回到新建会话面板', async () => {
    const { user } = renderProjectSessionsPage(
      '/projects/project-1/chats/session-1'
    );

    await user.click(
      screen.getByRole('button', {
        name: '删除当前会话'
      })
    );

    await waitFor(() => {
      expect(disposeMutationMock).toHaveBeenCalledWith('session-1');
      expect(screen.getByText('创建会话面板')).toBeInTheDocument();
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats'
      );
    });
  });

  it('创建首个会话成功后，应进入新建会话的线程页', async () => {
    vi.mocked(useSessionPageQueries).mockImplementation(
      (_projectId, selectedSessionId, createPanelOpen) => {
        if (selectedSessionId === 'session-new') {
          return {
            ...mockSessionPageQueries({
              selectedSessionId,
              createPanelOpen
            }),
            sessionsQuery: createQuerySuccessResult([
              createSessionSummary('session-new')
            ])
          };
        }

        return {
          ...mockSessionPageQueries({
            selectedSessionId,
            createPanelOpen
          }),
          sessionsQuery: createQuerySuccessResult([])
        };
      }
    );

    const { user } = renderProjectSessionsPage('/projects/project-1/chats');

    expect(screen.getByText('创建会话面板')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '创建成功' }));

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats/session-new'
      );
    });
  });

  it('删除非当前会话时，不应离开当前会话线程', async () => {
    const { user } = renderProjectSessionsPage(
      '/projects/project-1/chats/session-1'
    );

    await user.click(
      screen.getByRole('button', {
        name: '删除备用会话'
      })
    );

    await waitFor(() => {
      expect(disposeMutationMock).toHaveBeenCalledWith('session-2');
      expect(screen.getByText('消息已就绪')).toBeInTheDocument();
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats/session-1'
      );
    });
  });

  it('点击查看配置应展开，面板关闭后应收起；点击刷新会话应失效当前会话相关缓存', async () => {
    const { queryClient, user } = renderProjectSessionsPage(
      '/projects/project-1/chats/session-1'
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    expect(
      screen.queryByRole('dialog', {
        name: '会话设置'
      })
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: '查看配置'
      })
    );
    expect(
      await screen.findByRole('dialog', {
        name: '会话设置'
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: '查看配置'
      })
    ).toHaveAttribute('aria-expanded', 'true');

    await user.click(
      screen.getByRole('button', {
        name: '模拟点外部关闭'
      })
    );

    expect(
      screen.queryByRole('dialog', {
        name: '会话设置'
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: '查看配置'
      })
    ).toHaveAttribute('aria-expanded', 'false');

    await user.click(
      screen.getByRole('button', {
        name: '刷新会话'
      })
    );

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessions', 'list', 'project-1']
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessions', 'detail', 'session-1']
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessions', 'messages', 'session-1']
      });
    });
  });

  it('无会话但 URL 带 sessionId 时，应回退到新建会话页', async () => {
    vi.mocked(useSessionPageQueries).mockImplementation(
      (_projectId, selectedSessionId, createPanelOpen) => ({
        ...mockSessionPageQueries({
          selectedSessionId,
          createPanelOpen
        }),
        sessionsQuery: createQuerySuccessResult([])
      })
    );

    renderProjectSessionsPage('/projects/project-1/chats/session-stale');

    await waitFor(() => {
      expect(screen.getByText('创建会话面板')).toBeInTheDocument();
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/chats'
      );
    });
  });

  it('查询错误时，应通过 useErrorMessage 统一上报', async () => {
    const queryError = new Error('query failed');
    vi.mocked(useSessionPageQueries).mockImplementation(
      (_projectId, selectedSessionId, createPanelOpen) => ({
        ...mockSessionPageQueries({
          selectedSessionId,
          createPanelOpen
        }),
        queryError
      })
    );

    renderProjectSessionsPage('/projects/project-1/chats/session-1');

    await waitFor(() => {
      expect(handleErrorMock).toHaveBeenCalledWith(queryError);
    });
  });
});
