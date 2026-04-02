import { useCallback, startTransition, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Info, RefreshCw, Trash2, Plus } from 'lucide-react';
import type { SessionMessageRuntimeMap } from '@/features/chat/runtime/assistant-ui/thread-adapter';
import type { SendSessionMessageInput, PagedSessionMessages } from '@agent-workbench/shared';
import { SessionStatus as SessionStatusEnum } from '@agent-workbench/shared';

import { getAgentRunner, listAgentRunners, listAgentRunnerTypes } from '@/api/agent-runners';
import { listProfiles } from '@/api/profiles';
import { listResources } from '@/api/resources';
import {
  cancelSession,
  disposeSession,
  editSessionMessage,
  getSession,
  listSessionMessages,
  listSessions,
  reloadSession,
  sendSessionMessage
} from '@/api/sessions';
import { ApiRequestError, toApiRequestError } from '@/api/client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { EmptyState } from '@/components/app/EmptyState';
import { Button } from '@/components/ui/button';
import { SessionAssistantThread } from '@/features/chat/runtime/assistant-ui/SessionAssistantThread';
import { useSessionEventStream } from '@/pages/projects/use-session-event-stream';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { queryKeys } from '@/query/query-keys';
import { cn } from '@/lib/utils';

import { formatRelativeTime } from '@/utils/format-time';
import { SessionStatusBadge } from '@/features/sessions/components/SessionStatusBadge';
import { SessionDetailsPanel } from '@/features/sessions/panels/SessionDetailsPanel';
import { CreateSessionPanel } from '@/features/sessions/panels/CreateSessionPanel';
import { getSessionStatusLabel } from '@/pages/projects/project-sessions.utils';

const sessionQueryKeys = queryKeys.sessions;

type ProjectTab = 'config' | 'sessions' | 'dashboard';

const tabItems: { key: ProjectTab; label: string }[] = [
  { key: 'config', label: '配置' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'dashboard', label: 'Dashboard' }
];

function LoadingState() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="space-y-4 w-64">
        <div className="h-6 animate-pulse rounded-xl bg-muted/70" />
        <div className="h-4 animate-pulse rounded-xl bg-muted/50" />
        <div className="h-4 animate-pulse rounded-xl bg-muted/40 w-3/4" />
      </div>
    </div>
  );
}

/** Compact inline header: Project switcher + tabs + session dropdown */
function SessionPageHeader({
  projects,
  currentProjectId,
  onProjectChange,
  onTabChange
}: {
  projects: { id: string; name: string }[];
  currentProjectId: string;
  onProjectChange: (id: string) => void;
  onTabChange: (tab: ProjectTab) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/40 bg-background/95 px-4 py-2 backdrop-blur-sm sm:px-5">
      <select
        aria-label="选择当前 Project"
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:min-w-40"
        value={currentProjectId}
        onChange={(event) => onProjectChange(event.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-0.5">
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'rounded-md px-2.5 py-1 text-sm transition-colors',
              tab.key === 'sessions'
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Session selector dropdown in the chat header */
function SessionSelector({
  sessions,
  selectedSessionId,
  runnerNameById,
  onSelect,
  onCreate
}: {
  sessions: { id: string; runnerId: string; runnerType: string; updatedAt: string; status: string }[];
  selectedSessionId: string | null;
  runnerNameById: Record<string, string>;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selectedTitle = useMemo(() => {
    if (!selectedSessionId) return '选择 Session';
    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return '选择 Session';
    return runnerNameById[session.runnerId] ?? session.runnerType;
  }, [selectedSessionId, sessions, runnerNameById]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
      >
        <span className="max-w-[12rem] truncate">{selectedTitle}</span>
        <ChevronDown className={cn(
          'size-3.5 text-muted-foreground transition-transform duration-200',
          dropdownOpen && 'rotate-180'
        )} />
      </button>

      {dropdownOpen ? (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-xl border border-border/60 bg-background/98 py-1 shadow-xl backdrop-blur">
            <div className="max-h-64 overflow-y-auto">
              {sessions.map((session) => {
                const title = runnerNameById[session.runnerId] ?? session.runnerType;
                const isSelected = session.id === selectedSessionId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      onSelect(session.id);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-accent/50 font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRelativeTime(session.updatedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {getSessionStatusLabel(session.status as SessionStatusEnum)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-border/40 px-2 py-1.5">
              <button
                type="button"
                onClick={() => {
                  onCreate();
                  setDropdownOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              >
                <Plus className="size-3.5" />
                新建 Session
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ProjectSessionsPage() {
  const handleError = useErrorMessage();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [runtimeStateBySessionId, setRuntimeStateBySessionId] = useState<
    Record<string, SessionMessageRuntimeMap>
  >({});
  const {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects,
    goToProjectTab
  } = useProjectPageData();

  const [
    runnerTypesQuery,
    runnersQuery,
    profilesQuery,
    skillsQuery,
    mcpsQuery,
    rulesQuery
  ] = useQueries({
    queries: [
      {
        queryKey: queryKeys.agentRunnerTypes.all,
        queryFn: listAgentRunnerTypes
      },
      {
        queryKey: queryKeys.agentRunners.list(),
        queryFn: () => listAgentRunners()
      },
      {
        queryKey: queryKeys.profiles.list(),
        queryFn: listProfiles
      },
      {
        queryKey: queryKeys.resources.list('skills'),
        queryFn: () => listResources('skills')
      },
      {
        queryKey: queryKeys.resources.list('mcps'),
        queryFn: () => listResources('mcps')
      },
      {
        queryKey: queryKeys.resources.list('rules'),
        queryFn: () => listResources('rules')
      }
    ]
  });
  const sessionsQuery = useQuery({
    queryKey: id ? sessionQueryKeys.list(id) : sessionQueryKeys.lists(),
    queryFn: () => listSessions(id!),
    enabled: Boolean(id)
  });

  const selectedSessionId = searchParams.get('sessionId');
  const sessionDetailQuery = useQuery({
    queryKey: selectedSessionId
      ? sessionQueryKeys.detail(selectedSessionId)
      : sessionQueryKeys.all,
    queryFn: () => getSession(selectedSessionId!),
    enabled: Boolean(selectedSessionId)
  });
  const sessionMessagesQuery = useInfiniteQuery({
    queryKey: selectedSessionId
      ? sessionQueryKeys.messages(selectedSessionId)
      : sessionQueryKeys.all,
    queryFn: ({ pageParam }) => listSessionMessages(selectedSessionId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(selectedSessionId)
  });
  const flatMessages = useMemo(() => {
    if (!sessionMessagesQuery.data) return [];
    return [...sessionMessagesQuery.data.pages].reverse().flatMap(page => page.data);
  }, [sessionMessagesQuery.data]);

  const selectedRunnerQuery = useQuery({
    queryKey: sessionDetailQuery.data?.runnerId
      ? queryKeys.agentRunners.detail(sessionDetailQuery.data.runnerId)
      : queryKeys.agentRunners.all,
    queryFn: () => getAgentRunner(sessionDetailQuery.data!.runnerId),
    enabled: Boolean(sessionDetailQuery.data?.runnerId)
  });

  const selectedSession = sessionDetailQuery.data;
  const runnerTypes = useMemo(() => runnerTypesQuery.data ?? [], [runnerTypesQuery.data]);
  const runners = useMemo(() => runnersQuery.data ?? [], [runnersQuery.data]);
  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const resources = useMemo(
    () => ({
      skills: skillsQuery.data ?? [],
      mcps: mcpsQuery.data ?? [],
      rules: rulesQuery.data ?? []
    }),
    [mcpsQuery.data, rulesQuery.data, skillsQuery.data]
  );
  const selectedRunnerType = useMemo(() => {
    if (!selectedSession) {
      return undefined;
    }

    return runnerTypes.find(
      (runnerType) => runnerType.id === selectedSession.runnerType
    );
  }, [runnerTypes, selectedSession]);
  const selectedRuntimeState = useMemo(
    () =>
      (selectedSessionId
        ? runtimeStateBySessionId[selectedSessionId]
        : undefined) ?? {},
    [runtimeStateBySessionId, selectedSessionId]
  );

  const runnerNameById = useMemo(
    () =>
      Object.fromEntries(runners.map((runner) => [runner.id, runner.name] as const)),
    [runners]
  );
  const selectedSessionMessagesReady = sessionMessagesQuery.status === 'success';
  const showCreatePanel =
    createPanelOpen || (sessionsQuery.data?.length ?? 0) === 0;

  const updateSessionRuntimeMessageState = useCallback(
    (
      sessionId: string,
      messageId: string,
      updater: (
        current: SessionMessageRuntimeMap[string]
      ) => SessionMessageRuntimeMap[string]
    ) => {
      setRuntimeStateBySessionId((current) => ({
        ...current,
        [sessionId]: {
          ...(current[sessionId] ?? {}),
          [messageId]: updater(current[sessionId]?.[messageId])
        }
      }));
    },
    []
  );

  useEffect(() => {
    const queryError =
      sessionsQuery.error ??
      sessionDetailQuery.error ??
      sessionMessagesQuery.error ??
      selectedRunnerQuery.error ??
      runnerTypesQuery.error ??
      runnersQuery.error ??
      profilesQuery.error ??
      skillsQuery.error ??
      mcpsQuery.error ??
      rulesQuery.error;

    if (!queryError) {
      return;
    }

    handleError(queryError);
  }, [
    handleError,
    mcpsQuery.error,
    profilesQuery.error,
    rulesQuery.error,
    selectedRunnerQuery.error,
    runnerTypesQuery.error,
    runnersQuery.error,
    sessionDetailQuery.error,
    sessionMessagesQuery.error,
    sessionsQuery.error,
    skillsQuery.error
  ]);

  useEffect(() => {
    const sessions = sessionsQuery.data ?? [];
    if (sessions.length === 0) {
      if (selectedSessionId) {
        startTransition(() => {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('sessionId');
            return next;
          });
        });
      }
      return;
    }

    if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) {
      return;
    }

    startTransition(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('sessionId', sessions[0].id);
        return next;
      });
    });
  }, [selectedSessionId, sessionsQuery.data, setSearchParams]);

  useSessionEventStream({
    scopeId: id,
    session: selectedSession,
    messages: flatMessages,
    messagesReady: selectedSessionMessagesReady,
    queryClient,
    setRuntimeStateBySessionId,
    updateSessionRuntimeMessageState
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: SendSessionMessageInput) => {
      return sendSessionMessage(selectedSessionId!, payload);
    },
    onSuccess: (messages: PagedSessionMessages) => {
      if (!selectedSessionId) {
        return;
      }

      queryClient.setQueryData<InfiniteData<PagedSessionMessages>>(
        sessionQueryKeys.messages(selectedSessionId),
        (current) => current ? {
          pageParams: [undefined],
          pages: [messages]
        } : current
      );
    }
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelSession(selectedSessionId!)
  });
  const reloadMutation = useMutation({
    mutationFn: () => reloadSession(selectedSessionId!)
  });
  const editMutation = useMutation({
    mutationFn: ({
      messageId,
      payload
    }: {
      messageId: string;
      payload: SendSessionMessageInput;
    }) => editSessionMessage(selectedSessionId!, messageId, payload)
  });
  const disposeMutation = useMutation({
    mutationFn: () => disposeSession(selectedSessionId!),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQueryKeys.detail(session.id), session);
      if (id) {
        queryClient.invalidateQueries({
          queryKey: sessionQueryKeys.list(id)
        }).catch(() => undefined);
      }
    }
  });

  const invalidateSessionThreadState = async (sessionId: string, scopeId: string) => {
    setRuntimeStateBySessionId((current) => ({
      ...current,
      [sessionId]: {}
    }));

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.messages(sessionId)
      }),
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.detail(sessionId)
      }),
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.list(scopeId)
      })
    ]);
  };

  if (isLoading || sessionsQuery.isPending) {
    return <LoadingState />;
  }

  if (isNotFound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <EmptyState
          title="Project 不存在"
          description="当前 Project 不存在或已被删除。"
          action={<Button onClick={goToProjects}>返回 Projects</Button>}
        />
      </div>
    );
  }

  if (!id || !project || projects.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <EmptyState
          title="暂无可用 Project"
          description="请先回到 Project 列表创建或选择一个 Project。"
          action={<Button onClick={goToProjects}>返回 Projects</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Compact page header */}
      <SessionPageHeader
        projects={projects}
        currentProjectId={id}
        onProjectChange={(nextId) => goToProjectTab(nextId, 'sessions')}
        onTabChange={(tab) => goToProjectTab(id, tab)}
      />

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col">
        {showCreatePanel ? (
          <CreateSessionPanel
            projectId={id}
            runnerTypes={runnerTypes}
            runners={runners}
            profiles={profiles}
            resources={resources}
            canCancel={(sessionsQuery.data?.length ?? 0) > 0}
            onCancel={() => {
              setDetailsPanelOpen(false);
              setCreatePanelOpen(false);
            }}
            onCreated={(session) => {
              setDetailsPanelOpen(false);
              setCreatePanelOpen(false);
              startTransition(() => {
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set('sessionId', session.id);
                  return next;
                });
              });
            }}
          />
        ) : selectedSession ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Chat header with session dropdown */}
            <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2 sm:px-5">
              <div className="flex items-center gap-3 min-w-0">
                <SessionSelector
                  sessions={sessionsQuery.data ?? []}
                  selectedSessionId={selectedSessionId}
                  runnerNameById={runnerNameById}
                  onSelect={(sessionId) => {
                    setDetailsPanelOpen(false);
                    setCreatePanelOpen(false);
                    startTransition(() => {
                      setSearchParams((current) => {
                        const next = new URLSearchParams(current);
                        next.set('sessionId', sessionId);
                        return next;
                      });
                    });
                  }}
                  onCreate={() => {
                    setDetailsPanelOpen(false);
                    setCreatePanelOpen(true);
                  }}
                />
                <SessionStatusBadge status={selectedSession.status} />
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {formatRelativeTime(selectedSession.updatedAt)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="查看配置"
                  title="查看配置"
                  onClick={() => setDetailsPanelOpen(!detailsPanelOpen)}
                  className={detailsPanelOpen ? 'bg-accent' : ''}
                >
                  <Info className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="刷新会话"
                  title="刷新会话"
                  onClick={() => {
                    void Promise.all([
                      queryClient.invalidateQueries({
                        queryKey: sessionQueryKeys.list(id)
                      }),
                      queryClient.invalidateQueries({
                        queryKey: sessionQueryKeys.detail(selectedSession.id)
                      }),
                      queryClient.invalidateQueries({
                        queryKey: sessionQueryKeys.messages(selectedSession.id)
                      })
                    ]).catch(handleError);
                  }}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="销毁会话"
                  title="销毁会话"
                  disabled={
                    selectedSession.status === SessionStatusEnum.Disposing ||
                    selectedSession.status === SessionStatusEnum.Disposed ||
                    disposeMutation.isPending
                  }
                  onClick={() => {
                    void disposeMutation.mutateAsync().catch(handleError);
                  }}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Inline collapsible details panel */}
            <SessionDetailsPanel
              open={detailsPanelOpen}
              session={selectedSession}
              runnerDetail={selectedRunnerQuery.data}
              runnerType={selectedRunnerType}
              runners={runners}
              resources={resources}
            />

            {/* Chat thread - fills remaining space */}
            <SessionAssistantThread
              key={selectedSession.id}
              session={selectedSession}
              messages={flatMessages}
              onLoadMore={() => {
                 if (sessionMessagesQuery.hasNextPage) {
                   void sessionMessagesQuery.fetchNextPage();
                 }
              }}
              runnerType={selectedRunnerType}
              runtimeState={selectedRuntimeState}
              onSend={async (payload) => {
                try {
                  await sendMutation.mutateAsync(payload);
                } catch (error) {
                  const apiError = toApiRequestError(error);
                  throw new ApiRequestError({
                    code: apiError.code,
                    message: apiError.message,
                    data: apiError.data
                  });
                }
              }}
              onCancel={async () => {
                try {
                  await cancelMutation.mutateAsync();
                } catch (error) {
                  const apiError = toApiRequestError(error);
                  throw new ApiRequestError({
                    code: apiError.code,
                    message: apiError.message,
                    data: apiError.data
                  });
                }
              }}
              onReload={async () => {
                if (!id) {
                  return;
                }

                try {
                  await reloadMutation.mutateAsync();
                  await invalidateSessionThreadState(selectedSession.id, id);
                } catch (error) {
                  const apiError = toApiRequestError(error);
                  throw new ApiRequestError({
                    code: apiError.code,
                    message: apiError.message,
                    data: apiError.data
                  });
                }
              }}
              onEdit={async (messageId, payload) => {
                if (!id) {
                  return;
                }

                try {
                  await editMutation.mutateAsync({
                    messageId,
                    payload
                  });
                  await invalidateSessionThreadState(selectedSession.id, id);
                } catch (error) {
                  const apiError = toApiRequestError(error);
                  throw new ApiRequestError({
                    code: apiError.code,
                    message: apiError.message,
                    data: apiError.data
                  });
                }
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="选择 Session"
              description="或新建一个"
              action={
                <Button
                  onClick={() => {
                    setDetailsPanelOpen(false);
                    setCreatePanelOpen(true);
                  }}
                >
                  <Plus />
                  新建 Session
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
