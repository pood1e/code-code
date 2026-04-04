import { Suspense, lazy } from 'react';
import type { SessionDetail } from '@agent-workbench/shared';
import { Info, Plus, RefreshCw } from 'lucide-react';

import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { SessionSelector } from '@/features/sessions/components/SessionSelector';
import { SessionStatusBadge } from '@/features/sessions/components/SessionStatusBadge';
import { useProjectSessionsPageState } from '@/pages/projects/use-project-sessions-page-state';
import { formatRelativeTime } from '@/utils/format-time';

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

export function ProjectSessionsPageContent(
  props: ReturnType<typeof useProjectSessionsPageState>
) {
  if (props.showCreatePanel) {
    return <CreateSessionView {...props} />;
  }

  if (props.selectedSession) {
    return <SelectedSessionView {...props} session={props.selectedSession} />;
  }

  return <NoSessionSelectedView onCreate={props.openCreatePanel} />;
}

function CreateSessionView({
  closePanel,
  disposingSessionId,
  disposeFromSelector,
  profiles,
  projectId,
  resources,
  runnerNameById,
  runners,
  runnerTypes,
  selectSession,
  sessions
}: ReturnType<typeof useProjectSessionsPageState>) {
  if (!projectId) {
    return null;
  }

  return (
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

      <Suspense
        fallback={<PanelLoadingFallback label="正在加载创建会话面板..." />}
      >
        <CreateSessionPanel
          projectId={projectId}
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
  );
}

function SelectedSessionView({
  detailsPanelOpen,
  cancelSession,
  disposingSessionId,
  disposeFromSelector,
  editMessage,
  flatMessages,
  loadMoreMessages,
  openCreatePanel,
  refreshSession,
  reloadSession,
  resources,
  runnerNameById,
  runners,
  selectedRunnerQuery,
  selectedRunnerType,
  selectedRuntimeState,
  selectedSessionId,
  selectedSessionMessagesReady,
  selectSession,
  sendMessage,
  session,
  sessionMessagesQuery,
  sessions,
  setDetailsPanelOpen
}: ReturnType<typeof useProjectSessionsPageState> & {
  session: SessionDetail;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative border-b border-border/40 px-4 py-1.5 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <SessionSelector
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              runnerNameById={runnerNameById}
              onSelect={selectSession}
              onDispose={disposeFromSelector}
              disposingSessionId={disposingSessionId}
            />
            <SessionStatusBadge status={session.status} />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {formatRelativeTime(session.updatedAt)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={openCreatePanel}
              aria-label="新建会话"
              title="新建会话"
              className="h-7 rounded-full px-2.5 text-xs shadow-none"
            >
              <Plus data-icon="inline-start" className="size-3.5" />
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
              <Info className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="刷新会话"
              title="刷新会话"
              onClick={refreshSession}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </div>

        {detailsPanelOpen ? (
          <Suspense
            fallback={<PanelLoadingFallback label="正在加载会话设置..." />}
          >
            <SessionDetailsPanel
              open={detailsPanelOpen}
              onClose={() => setDetailsPanelOpen(false)}
              session={session}
              runnerDetail={selectedRunnerQuery.data}
              runnerType={selectedRunnerType}
              runners={runners}
              resources={resources}
            />
          </Suspense>
        ) : null}
      </div>

      <Suspense fallback={<PageLoadingSkeleton variant="fullscreen" />}>
        <SessionAssistantThread
          key={session.id}
          assistantName={selectedRunnerQuery.data?.name ?? selectedRunnerType?.name}
          onCreateNewSession={openCreatePanel}
          session={session}
          messages={flatMessages}
          messagesReady={selectedSessionMessagesReady}
          onLoadMore={
            sessionMessagesQuery.hasNextPage ? loadMoreMessages : undefined
          }
          runnerType={selectedRunnerType}
          runtimeState={selectedRuntimeState}
          onSend={sendMessage}
          onCancel={cancelSession}
          onReload={reloadSession}
          onEdit={editMessage}
        />
      </Suspense>
    </div>
  );
}

function NoSessionSelectedView({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <EmptyState
        title="选择会话"
        description="或新建一个"
        action={
          <Button onClick={onCreate}>
            <Plus />
            新建会话
          </Button>
        }
      />
    </div>
  );
}

function PanelLoadingFallback({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground sm:px-5">
      <RefreshCw className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
