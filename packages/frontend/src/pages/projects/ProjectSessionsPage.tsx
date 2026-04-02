import { useCallback, startTransition, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PanelRightOpen, RefreshCw, Trash2, Plus } from 'lucide-react';
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
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import { SessionAssistantThread } from '@/features/chat/runtime/assistant-ui/SessionAssistantThread';
import { ProjectSectionHeader } from '@/pages/projects/ProjectSectionHeader';
import { useSessionEventStream } from '@/pages/projects/use-session-event-stream';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { queryKeys } from '@/query/query-keys';

import { formatRelativeTime } from '@/utils/format-time';
import { SessionStatusBadge } from '@/features/sessions/components/SessionStatusBadge';
import { SessionList } from '@/features/sessions/panels/SessionList';
import { SessionDetailsSheet } from '@/features/sessions/panels/SessionDetailsSheet';
import { CreateSessionPanel } from '@/features/sessions/panels/CreateSessionPanel';

const sessionQueryKeys = queryKeys.sessions;

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-muted/70" />
      <div className="grid gap-4 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
        <div className="h-[36rem] animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-[36rem] animate-pulse rounded-2xl bg-muted/55" />
      </div>
    </div>
  );
}

export function ProjectSessionsPage() {
  const handleError = useErrorMessage();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
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
    // pages are ordered from newest batch to oldest batch.
    // wait, what does `listSessionMessages` return?
    // it returns chronological messages. So page 0 is [oldest in batch ... newest in batch].
    // if we load next page, the next page has OLDER messages.
    // to flatten them chronologially, we should do: older pages first, then newer pages.
    // since `pages[0]` is the newest batch, `pages[1]` is an older batch,
    // reversing the `pages` array before flattening yields correct chronological order.
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
  const runnerTypes = runnerTypesQuery.data ?? [];
  const runners = runnersQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];
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
  const selectedRunnerLabel = useMemo(() => {
    if (!selectedSession) {
      return '';
    }

    return (
      runners.find((runner) => runner.id === selectedSession.runnerId)?.name ??
      selectedSession.runnerType
    );
  }, [runners, selectedSession]);
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
      <EmptyState
        title="Project 不存在"
        description="当前 Project 不存在或已被删除。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  if (!id || !project || projects.length === 0) {
    return (
      <EmptyState
        title="暂无可用 Project"
        description="请先回到 Project 列表创建或选择一个 Project。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ProjectSectionHeader
        projects={projects}
        currentProjectId={id}
        activeTab="sessions"
        onProjectChange={(nextId) => goToProjectTab(nextId, 'sessions')}
        onTabChange={(tab) => goToProjectTab(id, tab)}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]">
        <SessionList
          sessions={sessionsQuery.data ?? []}
          runnerNameById={runnerNameById}
          selectedSessionId={selectedSessionId}
          isCreating={showCreatePanel}
          onSelect={(sessionId) => {
            setDetailsSheetOpen(false);
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
            setDetailsSheetOpen(false);
            setCreatePanelOpen(true);
          }}
        />

        <div className="min-w-0">
          {showCreatePanel ? (
            <CreateSessionPanel
              projectId={id}
              runnerTypes={runnerTypes}
              runners={runners}
              profiles={profiles}
              resources={resources}
              canCancel={(sessionsQuery.data?.length ?? 0) > 0}
              onCancel={() => {
                setDetailsSheetOpen(false);
                setCreatePanelOpen(false);
              }}
              onCreated={(session) => {
                setDetailsSheetOpen(false);
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
            <SurfaceCard className="flex min-h-[44rem] flex-col overflow-hidden p-0 xl:h-[calc(100vh-11.5rem)]">
              <div className="border-b border-border/40 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {selectedRunnerLabel}
                      </span>
                      <SessionStatusBadge status={selectedSession.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(selectedSession.updatedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="查看配置"
                      title="查看配置"
                      onClick={() => setDetailsSheetOpen(true)}
                    >
                      <PanelRightOpen />
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
                      <RefreshCw />
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
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>

              <SessionAssistantThread
                key={selectedSession.id}
                session={selectedSession}
                messages={flatMessages}
                onLoadMore={async () => {
                   if (sessionMessagesQuery.hasNextPage) {
                     await sessionMessagesQuery.fetchNextPage();
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

              <SessionDetailsSheet
                open={detailsSheetOpen && !showCreatePanel}
                onOpenChange={setDetailsSheetOpen}
                projectName={project.name}
                session={selectedSession}
                runnerDetail={selectedRunnerQuery.data}
                runnerType={selectedRunnerType}
                runners={runners}
                resources={resources}
              />
            </SurfaceCard>
          ) : (
            <SurfaceCard className="flex min-h-[32rem] items-center justify-center">
              <EmptyState
                title="选择 Session"
                description="或新建一个"
                action={
                  <Button
                    onClick={() => {
                      setDetailsSheetOpen(false);
                      setCreatePanelOpen(true);
                    }}
                  >
                    <Plus />
                    新建 Session
                  </Button>
                }
              />
            </SurfaceCard>
          )}
        </div>
      </div>

    </div>
  );
}
