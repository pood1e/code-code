import { useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
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
  runnerNameById: Record<string, string>;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

export function SessionSelector({
  sessions,
  selectedSessionId,
  runnerNameById,
  onSelect,
  onCreate
}: SessionSelectorProps) {
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
