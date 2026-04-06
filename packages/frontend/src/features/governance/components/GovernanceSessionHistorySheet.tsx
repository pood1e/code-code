import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type PagedSessionMessages,
  type SessionMessageDetail
} from '@agent-workbench/shared';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, MessageSquareText } from 'lucide-react';

import { getSession, listSessionMessages } from '@/api/sessions';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SessionAssistantThreadHistory } from '@/features/chat/runtime/assistant-ui/SessionAssistantThreadHistory';
import { ThreadConfigContext } from '@/features/chat/runtime/assistant-ui/context';
import {
  buildSessionAssistantMessageRecords,
  type SessionAssistantMessageRecord
} from '@/features/chat/runtime/assistant-ui/thread-adapter';
import { useSessionEventStream } from '@/pages/projects/use-session-event-stream';
import { NOOP_QUERY_KEY, queryKeys } from '@/query/query-keys';
import { useSessionRuntimeStore } from '@/store/session-runtime-store';

type GovernanceSessionHistorySheetProps = {
  scopeId: string;
  sessionId: string | null | undefined;
  title: string;
  description?: string;
  assistantName?: string;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
};

const sessionQueryKeys = queryKeys.sessions;

export function GovernanceSessionHistorySheet({
  scopeId,
  sessionId,
  title,
  description,
  assistantName = '治理 Agent',
  triggerLabel = '查看日志',
  triggerVariant = 'outline'
}: GovernanceSessionHistorySheetProps) {
  const [open, setOpen] = useState(false);

  if (!sessionId) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant={triggerVariant}
        size="sm"
        onClick={() => setOpen(true)}
      >
        <MessageSquareText className="mr-1.5 size-4" />
        {triggerLabel}
      </Button>

      {open ? (
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-4xl">
          <SheetHeader className="border-b">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {description ?? '直接复用会话历史组件查看治理 Agent 的实时输出。'}
            </SheetDescription>
          </SheetHeader>
          <GovernanceSessionHistoryBody
            assistantName={assistantName}
            scopeId={scopeId}
            sessionId={sessionId}
            title={title}
          />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function GovernanceSessionHistoryBody({
  assistantName,
  scopeId,
  sessionId,
  title
}: {
  assistantName: string;
  scopeId: string;
  sessionId: string;
  title: string;
}) {
  const queryClient = useQueryClient();
  const sessionDetailQuery = useQuery({
    queryKey: sessionQueryKeys.detail(sessionId),
    queryFn: () => getSession(sessionId)
  });
  const sessionMessagesQuery = useInfiniteQuery({
    queryKey: sessionQueryKeys.messages(sessionId),
    queryFn: ({ pageParam }) => listSessionMessages(sessionId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: PagedSessionMessages) =>
      lastPage.nextCursor || undefined
  });
  const runtimeState =
    useSessionRuntimeStore((state) => state.stateBySessionId[sessionId]) ?? {};
  const previousRecordsRef = useRef<SessionAssistantMessageRecord[]>([]);

  const flatMessages = useMemo(() => {
    if (!sessionMessagesQuery.data) {
      return [] as SessionMessageDetail[];
    }

    return [...sessionMessagesQuery.data.pages]
      .reverse()
      .flatMap((page) => page.data);
  }, [sessionMessagesQuery.data]);

  const records = useMemo(
    () =>
      buildSessionAssistantMessageRecords(
        flatMessages,
        runtimeState,
        previousRecordsRef.current
      ),
    [flatMessages, runtimeState]
  );

  useEffect(() => {
    previousRecordsRef.current = records;
  }, [records]);

  useSessionEventStream({
    scopeId,
    session: sessionDetailQuery.data,
    messages: flatMessages,
    messagesReady: sessionMessagesQuery.status === 'success',
    queryClient
  });

  if (sessionDetailQuery.isLoading || sessionMessagesQuery.isLoading) {
    return <GovernanceSessionHistoryLoadingState label={`正在加载 ${title}...`} />;
  }

  if (!sessionDetailQuery.data) {
    return (
      <GovernanceSessionHistoryEmptyState
        title="未找到会话"
        description="当前治理记录没有对应的 session，或 session 已被清理。"
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/10">
      <div className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>session: {sessionId}</span>
          <span>status: {sessionDetailQuery.data.status}</span>
          <span>runner: {sessionDetailQuery.data.runnerType}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-0 py-0">
        {records.length > 0 ? (
          <ThreadConfigContext.Provider value={{ assistantName }}>
            <SessionAssistantThreadHistory
              canReload={false}
              records={records}
              firstItemIndex={100_000}
              onLoadMore={
                sessionMessagesQuery.hasNextPage
                  ? () => {
                      void sessionMessagesQuery.fetchNextPage();
                    }
                  : undefined
              }
              onReload={async () => undefined}
            />
          </ThreadConfigContext.Provider>
        ) : (
          <GovernanceSessionHistoryEmptyState
            title="当前没有日志输出"
            description="治理 Agent 还没有产出消息，或执行刚刚开始。"
          />
        )}
      </div>
    </div>
  );
}

function GovernanceSessionHistoryLoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function GovernanceSessionHistoryEmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <SurfaceCard className="w-full max-w-xl py-10">
        <div className="space-y-2 text-center">
          <p className="text-base font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </SurfaceCard>
    </div>
  );
}
