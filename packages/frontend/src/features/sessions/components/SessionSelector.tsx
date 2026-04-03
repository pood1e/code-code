import { useMemo, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { SessionStatus as SessionStatusEnum } from '@agent-workbench/shared';

import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/format-time';
import { getSessionStatusLabel } from '@/pages/projects/project-sessions.form';

type SessionSelectorItem = {
  id: string;
  runnerId: string;
  runnerType: string;
  updatedAt: string;
  status: string;
};

type SessionSelectorProps = {
  sessions: SessionSelectorItem[];
  selectedSessionId: string | null;
  placeholder?: string;
  runnerNameById: Record<string, string>;
  onSelect: (id: string) => void;
  onDispose: (id: string) => void;
  disposingSessionId: string | null;
};

export function SessionSelector({
  sessions,
  selectedSessionId,
  placeholder = '选择会话',
  runnerNameById,
  onSelect,
  onDispose,
  disposingSessionId
}: SessionSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selectedTitle = useMemo(() => {
    if (!selectedSessionId) return placeholder;
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) return placeholder;
    return runnerNameById[session.runnerId] ?? session.runnerType;
  }, [placeholder, selectedSessionId, sessions, runnerNameById]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
      >
        <span className="max-w-[12rem] truncate">{selectedTitle}</span>
        <ChevronDown
          className={cn(
            'size-3.5 text-muted-foreground transition-transform duration-200',
            dropdownOpen && 'rotate-180'
          )}
        />
      </button>

      {dropdownOpen ? (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-0.5 w-72 overflow-hidden rounded-xl border border-border/60 bg-background/98 shadow-xl backdrop-blur">
            <div className="max-h-64 overflow-y-auto">
              {sessions.map((session) => {
                const title =
                  runnerNameById[session.runnerId] ?? session.runnerType;
                const isSelected = session.id === selectedSessionId;
                const sessionStatus = session.status as SessionStatusEnum;
                const isDisposing =
                  disposingSessionId === session.id ||
                  sessionStatus === SessionStatusEnum.Disposing ||
                  sessionStatus === SessionStatusEnum.Disposed;

                return (
                  <div
                    key={session.id}
                    className={cn(
                      'flex w-full items-center gap-1 transition-colors',
                      isSelected ? 'bg-accent/50' : 'hover:bg-muted/30'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(session.id);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        'flex min-w-0 flex-1 items-center justify-between gap-3 px-2.5 py-1.5 text-left text-sm transition-colors',
                        isSelected
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatRelativeTime(session.updatedAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {getSessionStatusLabel(sessionStatus)}
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-label={`删除会话 ${title}`}
                      title="删除会话"
                      disabled={isDisposing}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDispose(session.id);
                      }}
                      className="inline-flex size-7.5 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
