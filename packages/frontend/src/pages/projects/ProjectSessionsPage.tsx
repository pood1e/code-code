import { startTransition, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Info, RefreshCw, Trash2, Plus } from 'lucide-react';
import { SessionStatus as SessionStatusEnum } from '@agent-workbench/shared';


import { useErrorMessage } from '@/hooks/use-error-message';
import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { SessionAssistantThread } from '@/features/chat/runtime/assistant-ui/SessionAssistantThread';
import { useSessionEventStream } from '@/pages/projects/use-session-event-stream';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { queryKeys } from '@/query/query-keys';

import { formatRelativeTime } from '@/utils/format-time';
import { SessionStatusBadge } from '@/features/sessions/components/SessionStatusBadge';
import { SessionSelector } from '@/features/sessions/components/SessionSelector';
import { SessionDetailsPanel } from '@/features/sessions/panels/SessionDetailsPanel';
import { CreateSessionPanel } from '@/features/sessions/panels/CreateSessionPanel';
import { ProjectSectionHeader } from '@/pages/projects/ProjectSectionHeader';
import { useSessionPageQueries } from '@/features/sessions/hooks/use-session-page-queries';
import { useSessionPageMutations } from '@/features/sessions/hooks/use-session-page-mutations';
import { useSessionRuntimeStore } from '@/store/session-runtime-store';

const sessionQueryKeys = queryKeys.sessions;

export function ProjectSessionsPage() {
  const handleError = useErrorMessage();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects,
    goToProjectTab
  } = useProjectPageData();

  const selectedSessionId = searchParams.get('sessionId');

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
  } = useSessionPageQueries(id, selectedSessionId, createPanelOpen);

  const clearSessionState = useSessionRuntimeStore((s) => s.clearSessionState);

  const {
    sendMutation,
    cancelMutation,
    reloadMutation,
    editMutation,
    disposeMutation,
    invalidateSessionThreadState
  } = useSessionPageMutations({
    selectedSessionId,
    projectId: id,
    clearSessionRuntimeState: clearSessionState
  });

  const selectedRuntimeState = useSessionRuntimeStore((s) =>
    selectedSessionId ? s.stateBySessionId[selectedSessionId] : undefined
  ) ?? {};

  const showCreatePanel =
    createPanelOpen || (sessionsQuery.data?.length ?? 0) === 0;

  // Centralized query error handling
  useEffect(() => {
    if (queryError) {
      handleError(queryError);
    }
  }, [handleError, queryError]);

  // Auto-select first session or clear invalid session
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
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('sessionId', sessionId);
        return next;
      });
    });
  };

  const openCreatePanel = () => {
    setDetailsPanelOpen(false);
    setCreatePanelOpen(true);
  };

  const closePanel = () => {
    setDetailsPanelOpen(false);
    setCreatePanelOpen(false);
  };

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
      {/* Compact page header */}
      <ProjectSectionHeader
        projects={projects}
        currentProjectId={id}
        activeTab="sessions"
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
            onCancel={closePanel}
            onCreated={(session) => {
              closePanel();
              selectSession(session.id);
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
                  onSelect={selectSession}
                  onCreate={openCreatePanel}
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
              onSend={async (payload) => { await sendMutation.mutateAsync(payload); }}
              onCancel={async () => { await cancelMutation.mutateAsync(); }}
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
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="选择 Session"
              description="或新建一个"
              action={
                <Button onClick={openCreatePanel}>
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
