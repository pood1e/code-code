import { useMemo } from 'react';
import { formatRelativeTime } from '@/utils/format-time';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { EmptyState } from '@/components/app/EmptyState';
import { MessageSquarePlus, Plus } from 'lucide-react';
import { getSessionStatusLabel } from '@/pages/projects/project-sessions.utils';
import type { SessionSummary } from '@agent-workbench/shared';

export function SessionList({
  sessions,
  runnerNameById,
  selectedSessionId,
  isCreating,
  onSelect,
  onCreate
}: {
  sessions: SessionSummary[];
  runnerNameById: Record<string, string>;
  selectedSessionId: string | null;
  isCreating: boolean;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
}) {
  return (
    <SurfaceCard className="self-start overflow-hidden p-0 xl:sticky xl:top-8">
      <div className="border-b border-border/40 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">会话</p>
            <p className="text-xs text-muted-foreground">{sessions.length} 条</p>
          </div>
          <Button size="sm" onClick={onCreate} variant={isCreating ? 'secondary' : 'default'}>
            <Plus />
            新建
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-5">
          {isCreating ? (
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium text-foreground">正在配置新 Session</p>
              <p className="text-sm text-muted-foreground">
                创建完成后，这里会出现你的会话列表。
              </p>
            </div>
          ) : (
            <EmptyState
              title="还没有 Session"
              description="先创建一个 Session，再开始发送消息。"
              action={
                <Button onClick={onCreate}>
                  <MessageSquarePlus />
                  新建 Session
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => {
            const isSelected = session.id === selectedSessionId;
            const title = runnerNameById[session.runnerId] ?? session.runnerType;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                className={`w-full border-b border-border/40 px-4 py-3.5 text-left transition-colors sm:px-5 ${
                  isSelected
                    ? 'bg-muted/35 shadow-[inset_2px_0_0_0_hsl(var(--primary))]'
                    : 'hover:bg-muted/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {title}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {formatRelativeTime(session.updatedAt)}
                    </p>
                  </div>
                  <Badge variant={isSelected ? 'secondary' : 'outline'} className="rounded-full">
                    {getSessionStatusLabel(session.status)}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </SurfaceCard>
  );
}
