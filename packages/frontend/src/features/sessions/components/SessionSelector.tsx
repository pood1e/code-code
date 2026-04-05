import { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { SessionStatus as SessionStatusEnum } from '@agent-workbench/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/format-time';
import { getSessionStatusLabel } from '@/pages/projects/project-sessions.form';

type SessionSelectorItem = {
  id: string;
  title: string | null;
  runnerId: string;
  runnerType: string;
  updatedAt: string;
  status: string;
};

type SessionSelectorProps = {
  sessions: SessionSelectorItem[];
  selectedChatId: string | null;
  placeholder?: string;
  runnerNameById: Record<string, string>;
  onSelect: (id: string) => void;
  onDispose: (id: string) => void;
  onRename: (id: string, title: string | null) => Promise<unknown> | void;
  disposingChatId: string | null;
  renamingChatId: string | null;
};

export function SessionSelector({
  sessions,
  selectedChatId,
  placeholder = '选择会话',
  runnerNameById,
  onSelect,
  onDispose,
  onRename,
  disposingChatId,
  renamingChatId
}: SessionSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const selectedTitle = useMemo(() => {
    if (!selectedChatId) {
      return placeholder;
    }

    const session = sessions.find((s) => s.id === selectedChatId);
    if (!session) return placeholder;
    return getSessionDisplayTitle(session, runnerNameById);
  }, [placeholder, selectedChatId, sessions, runnerNameById]);

  const renameTarget =
    renameTargetId !== null
      ? sessions.find((session) => session.id === renameTargetId) ?? null
      : null;

  const handleRenameSubmit = async () => {
    if (!renameTargetId) {
      return;
    }

    const nextTitle = renameValue.trim();
    await onRename(renameTargetId, nextTitle.length > 0 ? nextTitle : null);
    setRenameTargetId(null);
    setRenameValue('');
  };

  return (
    <>
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
            <div className="absolute left-0 top-full z-20 mt-0.5 w-80 overflow-hidden rounded-xl border border-border/60 bg-background/98 shadow-xl backdrop-blur">
              <div className="max-h-64 overflow-y-auto">
                {sessions.map((session) => {
                  const title = getSessionDisplayTitle(session, runnerNameById);
                  const isSelected = session.id === selectedChatId;
                  const sessionStatus = session.status as SessionStatusEnum;
                  const isDisposing =
                    disposingChatId === session.id ||
                    sessionStatus === SessionStatusEnum.Disposing ||
                    sessionStatus === SessionStatusEnum.Disposed;
                  const isRenaming = renamingChatId === session.id;

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
                        aria-label={`重命名会话 ${title}`}
                        title="重命名会话"
                        disabled={isRenaming}
                        onClick={(event) => {
                          event.stopPropagation();
                          setRenameTargetId(session.id);
                          setRenameValue(session.title ?? '');
                        }}
                        className="inline-flex size-7.5 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Pencil className="size-3.5" />
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

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTargetId(null);
            setRenameValue('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名会话</DialogTitle>
            <DialogDescription>
              默认会回退到 Runner 名称。留空即可清空自定义标题。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder={
                renameTarget
                  ? getSessionDisplayTitle(renameTarget, runnerNameById)
                  : '输入新的会话标题'
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRenameTargetId(null);
                setRenameValue('');
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleRenameSubmit()}
              disabled={!renameTarget || renamingChatId === renameTarget.id}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getSessionDisplayTitle(
  session: SessionSelectorItem,
  runnerNameById: Record<string, string>
) {
  return session.title?.trim() || runnerNameById[session.runnerId] || session.runnerType;
}
