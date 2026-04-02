import {
  Blocks,
  Bot,
  CircuitBoard,
  FolderKanban,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { listAgentRunners, listAgentRunnerTypes } from '@/api/agent-runners';
import { listProjects } from '@/api/projects';
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
import { useProjectStore } from '@/store/project-store';
import { useUiStore } from '@/store/ui-store';
import { projectConfig } from '@/types/projects';

const resourceItems = [
  { key: '/skills', label: 'Skills', icon: SlidersHorizontal },
  { key: '/mcps', label: 'MCPs', icon: CircuitBoard },
  { key: '/rules', label: 'Rules', icon: ShieldCheck },
  { key: '/profiles', label: 'Profiles', icon: Blocks },
  { key: '/agent-runners', label: 'Runners', icon: Bot }
] as const;

const primaryItems = [
  { key: 'projects', path: projectConfig.path, label: 'Projects', icon: FolderKanban },
  { key: 'resources', path: '/skills', label: '资源库', icon: Blocks }
] as const;

function DesktopSidebar({
  collapsed,
  selectedPrimaryKey,
  selectedResourceKey,
  onNavigate,
  onToggle
}: {
  collapsed: boolean;
  selectedPrimaryKey: (typeof primaryItems)[number]['key'];
  selectedResourceKey: string;
  onNavigate: (path: string) => void;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 border-r border-border/50 bg-sidebar transition-[width] duration-200 ease-in-out lg:block',
        collapsed ? 'w-[3.5rem]' : 'w-56'
      )}
    >
      <div className="sticky top-0 flex h-screen flex-col py-4">
        {/* Header */}
        <div
          className={cn(
            'mb-6 flex items-center',
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          {collapsed ? null : (
            <button
              type="button"
              onClick={() => onNavigate(projectConfig.path)}
              className="min-w-0 px-1 text-left"
            >
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                Agent Workbench
              </p>
            </button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            className="shrink-0 text-muted-foreground"
            title={collapsed ? '展开侧栏' : '收起侧栏'}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>

        {/* Primary Navigation */}
        <nav className={cn('flex-1 space-y-1', collapsed ? 'px-2' : 'px-3')}>
          {primaryItems.map((item) => {
            const isActive = item.key === selectedPrimaryKey;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.path)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex w-full items-center rounded-xl transition-colors duration-150',
                  collapsed
                    ? 'justify-center py-2.5'
                    : 'gap-2.5 px-3 py-2 text-left text-sm',
                  isActive
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {collapsed ? null : item.label}
              </button>
            );
          })}
        </nav>

        {/* Resource Sub-Navigation */}
        {selectedPrimaryKey === 'resources' ? (
          <div
            className={cn(
              'mt-auto border-t border-border/50 pt-4',
              collapsed ? 'px-2' : 'px-3'
            )}
          >
            {collapsed ? null : (
              <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                资源
              </p>
            )}
            <nav className="space-y-0.5">
              {resourceItems.map((item) => {
                const isActive = item.key === selectedResourceKey;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate(item.key)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex w-full items-center rounded-lg transition-colors duration-150',
                      collapsed
                        ? 'justify-center py-2'
                        : 'gap-2 px-3 py-1.5 text-left text-[13px]',
                      isActive
                        ? 'bg-accent font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <item.icon className="size-3.5 shrink-0" />
                    {collapsed ? null : item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function MobileNavigation({
  open,
  selectedPrimaryKey,
  selectedResourceKey,
  onOpenChange,
  onNavigate
}: {
  open: boolean;
  selectedPrimaryKey: (typeof primaryItems)[number]['key'];
  selectedResourceKey: string;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-72 border-border/50 bg-sidebar px-0"
      >
        <SheetHeader className="px-6 text-left">
          <SheetTitle>Agent Workbench</SheetTitle>
          <SheetDescription className="sr-only">导航</SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-4">
          <nav className="space-y-1">
            {primaryItems.map((item) => {
              const isActive = item.key === selectedPrimaryKey;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onNavigate(item.path);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50'
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {selectedPrimaryKey === 'resources' ? (
            <div className="mt-4 border-t border-border/50 pt-4">
              <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                资源
              </p>
              <nav className="space-y-0.5">
                {resourceItems.map((item) => {
                  const isActive = item.key === selectedResourceKey;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        onNavigate(item.key);
                        onOpenChange(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors',
                        isActive
                          ? 'bg-accent font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-accent/50'
                      )}
                    >
                      <item.icon className="size-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isProjectPage = useMemo(
    () => /^\/projects\/[^/]+/.test(location.pathname),
    [location.pathname]
  );
  const selectedPrimaryKey = useMemo(
    () =>
      location.pathname.startsWith(projectConfig.path)
        ? 'projects'
        : 'resources',
    [location.pathname]
  );
  const selectedResourceKey = useMemo(
    () =>
      resourceItems.find((item) => location.pathname.startsWith(item.key))
        ?.key ?? '/skills',
    [location.pathname]
  );

  const handleNavigate = (path: string) => {
    const nextPath =
      path === projectConfig.path && currentProjectId
        ? `${projectConfig.path}/${currentProjectId}/config`
        : path;

    setMobileOpen(false);
    startTransition(() => {
      void navigate(nextPath);
    });
  };

  useEffect(() => {
    void Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.projects.list(),
        queryFn: () => listProjects()
      }),
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
      <DesktopSidebar
        collapsed={sidebarCollapsed}
        selectedPrimaryKey={selectedPrimaryKey}
        selectedResourceKey={selectedResourceKey}
        onNavigate={handleNavigate}
        onToggle={toggleSidebar}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-foreground">
              Agent Workbench
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
          </div>
        </header>

        <main
          className={cn(
            'flex-1',
            isProjectPage
              ? 'px-0 py-0'
              : 'px-4 py-6 sm:px-8 sm:py-8 lg:px-8 lg:py-8'
          )}
        >
          {isProjectPage ? (
            <Outlet />
          ) : (
            <div className="mx-auto w-full max-w-5xl">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      <MobileNavigation
        open={mobileOpen}
        selectedPrimaryKey={selectedPrimaryKey}
        selectedResourceKey={selectedResourceKey}
        onOpenChange={setMobileOpen}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
