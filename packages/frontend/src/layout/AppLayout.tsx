import { startTransition, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { listProjects } from '@/api/projects';
import { ThemeToggle } from '@/components/app/ThemeToggle';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/query/query-keys';
import { useProjectStore } from '@/store/project-store';
import { useUiStore } from '@/store/ui-store';

import {
  DesktopSidebar,
  MobileMenuButton,
  MobileNavigation
} from './AppLayoutNavigation';
import {
  deriveAppLayoutRouteState,
  resolvePrimaryProjectPath,
  resolveSelectedProjectId
} from './app-layout.model';
import { prefetchAppLayoutData } from './app-layout.prefetch';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const [mobileOpen, setMobileOpen] = useState(false);
  const routeState = useMemo(
    () => deriveAppLayoutRouteState(location.pathname),
    [location.pathname]
  );
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: () => listProjects(),
    staleTime: 30_000
  });
  const projects = useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data]
  );
  const selectedProjectId = useMemo(
    () =>
      resolveSelectedProjectId(
        routeState.routeProjectId,
        currentProjectId,
        projects
      ),
    [currentProjectId, projects, routeState.routeProjectId]
  );

  const handleNavigate = (path: string) => {
    const nextPath =
      path === '/projects' ? resolvePrimaryProjectPath(currentProjectId) : path;

    setMobileOpen(false);
    startTransition(() => {
      void navigate(nextPath);
    });
  };

  useEffect(() => {
    void prefetchAppLayoutData(queryClient);
  }, [queryClient]);

  return (
    <div className="relative h-screen overflow-hidden lg:flex">
      <DesktopSidebar
        collapsed={sidebarCollapsed}
        selectedPrimaryKey={routeState.selectedPrimaryKey}
        selectedResourceKey={routeState.selectedResourceKey}
        projects={projects}
        selectedProjectId={selectedProjectId}
        selectedProjectTab={routeState.selectedProjectTab}
        onNavigate={handleNavigate}
        onToggle={toggleSidebar}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-foreground">
              Agent Workbench
            </p>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <MobileMenuButton onClick={() => setMobileOpen(true)} />
            </div>
          </div>
        </header>

        <main
          className={cn(
            'min-h-0 flex-1 overflow-y-auto',
            routeState.isProjectPage
              ? 'px-0 py-0'
              : 'px-4 py-6 sm:px-8 sm:py-8 lg:px-8 lg:py-8'
          )}
        >
          {routeState.isProjectPage ? (
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
        selectedPrimaryKey={routeState.selectedPrimaryKey}
        selectedResourceKey={routeState.selectedResourceKey}
        projects={projects}
        selectedProjectId={selectedProjectId}
        selectedProjectTab={routeState.selectedProjectTab}
        onOpenChange={setMobileOpen}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
