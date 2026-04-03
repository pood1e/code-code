import {
  Suspense,
  lazy,
  startTransition,
  useEffect,
  useState
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Info, RefreshCw, Plus } from 'lucide-react';

import { useErrorMessage } from '@/hooks/use-error-message';
import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { useSessionEventStream } from '@/pages/projects/use-session-event-stream';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { queryKeys } from '@/query/query-keys';

import { formatRelativeTime } from '@/utils/format-time';
import { SessionStatusBadge } from '@/features/sessions/components/SessionStatusBadge';
import { SessionSelector } from '@/features/sessions/components/SessionSelector';
import { useSessionPageQueries } from '@/features/sessions/hooks/use-session-page-queries';
import { useSessionPageMutations } from '@/features/sessions/hooks/use-session-page-mutations';
import { useSessionRuntimeStore } from '@/store/session-runtime-store';

const sessionQueryKeys = queryKeys.sessions;
const CreateSessionPanel = lazy(async () => {
  const module = await import('@/features/sessions/panels/CreateSessionPanel');
  return { default: module.CreateSessionPanel };
});
const SessionDetailsPanel = lazy(async () => {
  const module = await import('@/features/sessions/panels/SessionDetailsPanel');
  return { default: module.SessionDetailsPanel };
});
const SessionAssistantThread = lazy(async () => {
  const module = await import(
    '@/features/chat/runtime/assistant-ui/SessionAssistantThread'
  );
  return { default: module.SessionAssistantThread };
});

function PanelLoadingFallback({
  label
}: {
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground sm:px-5">
      <RefreshCw className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function ProjectSessionsPage() {
  const handleError = useErrorMessage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { sessionId: selectedSessionId } = useParams<{ sessionId?: string }>();
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects
  } = useProjectPageData();

  const {
    sessionsQuery,
    sessionMessagesQuery,
    selectedSession,
    flatMessages,
    runnerTypes,
    runners,
    profiles,
    resources,
    selectedRunnerType,
    selectedRunnerQuery,
    runnerNameById,
    selectedSessionMessagesReady,
    queryError
  } = useSessionPageQueries(id, selectedSessionId ?? null, createPanelOpen);

  const clearSessionState = useSessionRuntimeStore((s) => s.clearSessionState);

  const {
    sendMutation,
    cancelMutation,
    reloadMutation,
    editMutation,
    disposeMutation,
    invalidateSessionThreadState
  } = useSessionPageMutations({
    selectedSessionId: selectedSessionId ?? null,
    projectId: id,
    clearSessionRuntimeState: clearSessionState
  });

  const selectedRuntimeState =
    useSessionRuntimeStore((s) =>
      selectedSessionId ? s.stateBySessionId[selectedSessionId] : undefined
    ) ?? {};
  const sessions = sessionsQuery.data ?? [];

  const showCreatePanel =
    createPanelOpen || sessions.length === 0;

  // Centralized query error handling
  useEffect(() => {
    if (queryError) {
      handleError(queryError);
    }
  }, [handleError, queryError]);

  // Auto-select first session or navigate away from invalid session
  useEffect(() => {
    if (!id) return;
    if (sessionsQuery.isPending) return;
    if (createPanelOpen) return;

    if (sessions.length === 0) {
      // No sessions — if URL has a sessionId segment, navigate to base path
      if (selectedSessionId) {
        startTransition(() => {
          void navigate(`/projects/${id}/sessions`, { replace: true });
        });
      }
      return;
    }

    // Selected session still valid — keep URL as-is
    if (selectedSessionId && sessions.some((s) => s.id === selectedSessionId)) {
      return;
    }

    // No valid session selected — auto-select the first one
    startTransition(() => {
      void navigate(`/projects/${id}/sessions/${sessions[0].id}`, {
        replace: true
      });
    });
  }, [
    createPanelOpen,
    id,
    navigate,
    selectedSessionId,
    sessionsQuery.data,
    sessionsQuery.isPending
  ]);

  // SSE event stream
  useSessionEventStream({
    scopeId: id,
    session: selectedSession,
    messages: flatMessages,
    messagesReady: selectedSessionMessagesReady,
    queryClient
  });

  // --- UI state handlers ---

  const selectSession = (sessionId: string) => {
    setDetailsPanelOpen(false);
    setCreatePanelOpen(false);
    startTransition(() => {
      void navigate(`/projects/${id}/sessions/${sessionId}`);
    });
  };

  const openCreatePanel = () => {
    setDetailsPanelOpen(false);
    setCreatePanelOpen(true);
    if (id) {
      startTransition(() => {
        void navigate(`/projects/${id}/sessions`);
      });
    }
  };

  const closePanel = () => {
    setDetailsPanelOpen(false);
    setCreatePanelOpen(false);
  };

  const disposeFromSelector = (sessionId: string) => {
    void (async () => {
      await disposeMutation.mutateAsync(sessionId);
      if (sessionId === selectedSessionId || showCreatePanel) {
        openCreatePanel();
      }
    })().catch(handleError);
  };

  const disposingSessionId = disposeMutation.isPending
    ? (disposeMutation.variables ?? null)
    : null;

  // --- Render guards ---

  if (isLoading || sessionsQuery.isPending) {
    return <PageLoadingSkeleton variant="fullscreen" />;
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
      <div className="flex min-h-0 flex-1 flex-col">
        {showCreatePanel ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {sessions.length > 0 ? (
              <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2 sm:px-5">
                <SessionSelector
                  sessions={sessions}
                  selectedSessionId={null}
                  placeholder="新建会话"
                  runnerNameById={runnerNameById}
                  onSelect={selectSession}
                  onDispose={disposeFromSelector}
                  disposingSessionId={disposingSessionId}
                />
              </div>
            ) : null}
            <Suspense fallback={<PanelLoadingFallback label="正在加载创建会话面板..." />}>
              <CreateSessionPanel
                projectId={id}
                runnerTypes={runnerTypes}
                runners={runners}
                profiles={profiles}
                resources={resources}
                canCancel={sessions.length > 0}
                onCancel={closePanel}
                onCreated={(session) => {
                  closePanel();
                  selectSession(session.id);
                }}
              />
            </Suspense>
          </div>
        ) : selectedSession ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Chat header with session dropdown */}
            <div className="relative border-b border-border/40 px-4 py-2 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SessionSelector
                    sessions={sessions}
                    selectedSessionId={selectedSessionId ?? null}
                    runnerNameById={runnerNameById}
                    onSelect={selectSession}
                    onDispose={disposeFromSelector}
                    disposingSessionId={disposingSessionId}
                  />
                  <SessionStatusBadge status={selectedSession.status} />
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {formatRelativeTime(selectedSession.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    onClick={openCreatePanel}
                    aria-label="新建会话"
                    title="新建会话"
                    className="h-8 rounded-lg px-3"
                  >
                    <Plus data-icon="inline-start" className="size-4" />
                    <span className="hidden sm:inline">新建会话</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="查看配置"
                    aria-expanded={detailsPanelOpen}
                    aria-haspopup="dialog"
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
                </div>
              </div>

              {detailsPanelOpen ? (
                <Suspense fallback={<PanelLoadingFallback label="正在加载会话设置..." />}>
                  <SessionDetailsPanel
                    open={detailsPanelOpen}
                    onClose={() => setDetailsPanelOpen(false)}
                    session={selectedSession}
                    runnerDetail={selectedRunnerQuery.data}
                    runnerType={selectedRunnerType}
                    runners={runners}
                    resources={resources}
                  />
                </Suspense>
              ) : null}
            </div>

            {/* Chat thread - fills remaining space */}
            <Suspense fallback={<PageLoadingSkeleton variant="fullscreen" />}>
              <SessionAssistantThread
                key={selectedSession.id}
                session={selectedSession}
                messages={flatMessages}
                messagesReady={selectedSessionMessagesReady}
                onLoadMore={() => {
                  if (sessionMessagesQuery.hasNextPage) {
                    void sessionMessagesQuery.fetchNextPage();
                  }
                }}
                runnerType={selectedRunnerType}
                runtimeState={selectedRuntimeState}
                onSend={async (payload) => {
                  await sendMutation.mutateAsync(payload);
                }}
                onCancel={async () => {
                  await cancelMutation.mutateAsync();
                }}
                onReload={async () => {
                  if (!id) {
                    return;
                  }

                  await reloadMutation.mutateAsync();
                  await invalidateSessionThreadState(selectedSession.id, id);
                }}
                onEdit={async (messageId, payload) => {
                  if (!id) {
                    return;
                  }

                  await editMutation.mutateAsync({
                    messageId,
                    payload
                  });
                  await invalidateSessionThreadState(selectedSession.id, id);
                }}
              />
            </Suspense>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="选择会话"
              description="或新建一个"
              action={
                <Button onClick={openCreatePanel}>
                  <Plus />
                  新建会话
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
