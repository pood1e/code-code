import {
  Blocks,
  Bot,
  CircuitBoard,
  FolderKanban,
  PanelLeftOpen,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import {
  listAgentRunners,
  listAgentRunnerTypes
} from '@/api/agent-runners';
import { listProfiles } from '@/api/profiles';
import { listResources } from '@/api/resources';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/query/query-keys';

const resourceItems = [
  {
    key: '/skills',
    label: 'Skills',
    icon: SlidersHorizontal
  },
  {
    key: '/mcps',
    label: 'MCPs',
    icon: CircuitBoard
  },
  {
    key: '/rules',
    label: 'Rules',
    icon: ShieldCheck
  },
  {
    key: '/profiles',
    label: 'Profiles',
    icon: Blocks
  },
  {
    key: '/agent-runners',
    label: 'AgentRunner',
    icon: Bot
  }
] as const;

const moduleLabel = '资源管理';

function SecondaryNavigation({
  selectedKey,
  onNavigate,
  mobile
}: {
  selectedKey: string;
  onNavigate: (key: string) => void;
  mobile?: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-x-auto',
        mobile
          ? 'rounded-[calc(var(--radius)*1.1)] border border-white/10 bg-white/6 p-1.5'
          : ''
      )}
    >
      <div
        className={cn(
          'flex gap-1.5',
          mobile ? 'flex-col' : 'min-w-max border-b border-border/70'
        )}
      >
        {resourceItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === selectedKey;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={cn(
                'flex items-center gap-2 text-left transition-colors',
                mobile ? 'rounded-[calc(var(--radius)*0.8)] px-3 py-2.5' : '',
                isActive
                  ? mobile
                    ? 'border border-white/15 bg-white/14 text-white shadow-[0_18px_44px_-24px_rgba(15,23,42,0.55)]'
                    : 'border-b-2 border-primary px-1 pb-3 text-foreground'
                  : mobile
                    ? 'border border-transparent bg-transparent text-white/82 hover:border-white/10 hover:bg-white/8'
                    : 'border-b-2 border-transparent px-1 pb-3 text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'flex size-4 items-center justify-center',
                  mobile ? 'size-8 rounded-xl border' : '',
                  isActive
                    ? mobile
                      ? 'border-white/12 bg-white/10 text-white'
                      : 'text-primary'
                    : mobile
                      ? 'border-white/10 bg-white/6 text-white/72'
                      : 'text-muted-foreground'
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DesktopSidebar({ onNavigate }: { onNavigate: (key: string) => void }) {
  return (
    <aside className="hidden min-h-screen w-[184px] flex-col border-r border-sidebar-border/70 bg-[linear-gradient(180deg,rgba(13,24,48,0.98),rgba(17,31,58,0.98))] px-2.5 py-3 text-sidebar-foreground lg:flex">
      <button
        type="button"
        onClick={() => onNavigate('/skills')}
        className="flex items-center gap-2.5 rounded-[calc(var(--radius)*0.85)] px-2.5 py-2 text-left transition-colors hover:bg-white/5"
      >
        <div className="flex size-9 items-center justify-center rounded-xl bg-white/7 text-xs font-semibold tracking-[0.24em] text-white">
          AW
        </div>
        <div className="min-w-0">
          <p className="truncate text-[0.82rem] font-semibold text-white">Agent Workbench</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onNavigate('/skills')}
        className="mt-5 flex items-center gap-2.5 rounded-[calc(var(--radius)*0.9)] px-2.5 py-2.5 text-left text-white/88 transition-colors hover:bg-white/5"
      >
        <span className="flex size-8 items-center justify-center rounded-lg border border-white/8 bg-white/6 text-white/90">
          <FolderKanban className="size-4" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium">{moduleLabel}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-primary/90" />
      </button>
    </aside>
  );
}

function MobileNavigation({
  open,
  selectedKey,
  onOpenChange,
  onNavigate
}: {
  open: boolean;
  selectedKey: string;
  onOpenChange: (open: boolean) => void;
  onNavigate: (key: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[90vw] max-w-[340px] border-border/70 bg-sidebar px-0 text-sidebar-foreground"
      >
        <SheetHeader className="px-6 text-left">
          <SheetTitle className="text-sidebar-foreground">
            Agent Workbench
          </SheetTitle>
          <SheetDescription className="sr-only">
            Primary navigation
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 px-4">
          <button
            type="button"
            onClick={() => {
              onNavigate('/skills');
              onOpenChange(false);
            }}
            className="flex w-full items-center gap-3 rounded-[calc(var(--radius)*1.05)] border border-white/10 bg-white/10 px-4 py-3 text-left"
          >
            <span className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white">
              <FolderKanban className="size-4" />
            </span>
            <span className="text-sm font-semibold text-white">
              {moduleLabel}
            </span>
          </button>
          <div className="mt-5">
            <SecondaryNavigation
              mobile
              selectedKey={selectedKey}
              onNavigate={(key) => {
                onNavigate(key);
                onOpenChange(false);
              }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectedKey = useMemo(
    () =>
      resourceItems.find((item) => location.pathname.startsWith(item.key))?.key ??
      '/skills',
    [location.pathname]
  );
  const isListPage = useMemo(
    () => resourceItems.some((item) => location.pathname === item.key),
    [location.pathname]
  );

  const handleNavigate = (key: string) => {
    setMobileOpen(false);
    startTransition(() => {
      void navigate(key);
    });
  };

  useEffect(() => {
    void Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.resources.list('skills'),
        queryFn: () => listResources('skills')
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.resources.list('mcps'),
        queryFn: () => listResources('mcps')
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.resources.list('rules'),
        queryFn: () => listResources('rules')
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.profiles.list(),
        queryFn: listProfiles
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.agentRunnerTypes.all,
        queryFn: listAgentRunnerTypes
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.agentRunners.list(),
        queryFn: () => listAgentRunners()
      })
    ]);
  }, [queryClient]);

  return (
    <div className="relative min-h-screen lg:flex">
      <DesktopSidebar onNavigate={handleNavigate} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Agent Workbench
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {moduleLabel}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setMobileOpen(true)}
            >
              <PanelLeftOpen />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div
            className={cn(
              'mx-auto w-full',
              isListPage ? 'max-w-[96rem]' : 'max-w-7xl'
            )}
          >
            <SecondaryNavigation
              selectedKey={selectedKey}
              onNavigate={handleNavigate}
            />
            <div className="min-h-[32rem] pt-5 sm:pt-6">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <MobileNavigation
        open={mobileOpen}
        selectedKey={selectedKey}
        onOpenChange={setMobileOpen}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
