import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { ThemeToggle } from '@/components/app/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { projectConfig } from '@/types/projects';

import {
  PrimaryNavigation,
  SecondaryNavigation,
  type AppNavigationProps
} from './AppLayoutNavigationContent';

export function DesktopSidebar({
  collapsed,
  onToggle,
  ...props
}: AppNavigationProps & {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        'hidden h-screen shrink-0 border-r border-border/50 bg-sidebar transition-[width] duration-200 ease-in-out lg:block',
        collapsed ? 'w-[3.5rem]' : 'w-56'
      )}
    >
      <div className="flex h-full flex-col py-4">
        <div
          className={cn(
            'mb-6 flex items-center',
            collapsed ? 'justify-center gap-1 px-2' : 'justify-between px-4'
          )}
        >
          {collapsed ? null : (
            <button
              type="button"
              onClick={() => props.onNavigate(projectConfig.path)}
              className="min-w-0 px-1 text-left"
            >
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                Agent Workbench
              </p>
            </button>
          )}

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
              onClick={onToggle}
              className="shrink-0 text-muted-foreground"
              title={collapsed ? '展开侧栏' : '收起侧栏'}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <nav className={cn('flex-1 space-y-1', collapsed ? 'px-2' : 'px-3')}>
          <PrimaryNavigation collapsed={collapsed} {...props} />
        </nav>

        <DesktopSecondaryNavigation collapsed={collapsed} {...props} />
      </div>
    </aside>
  );
}

export function MobileNavigation({
  open,
  onOpenChange,
  ...props
}: AppNavigationProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
            <PrimaryNavigation
              collapsed={false}
              {...props}
              onNavigate={(path) => {
                props.onNavigate(path);
                onOpenChange(false);
              }}
            />
          </nav>

          <MobileSecondaryNavigation
            {...props}
            onNavigate={(path) => {
              props.onNavigate(path);
              onOpenChange(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="打开导航菜单"
      title="打开导航菜单"
      onClick={onClick}
    >
      <Menu />
    </Button>
  );
}

function DesktopSecondaryNavigation({
  collapsed,
  selectedPrimaryKey,
  selectedResourceKey,
  projects,
  selectedProjectId,
  selectedProjectTab,
  onNavigate
}: AppNavigationProps & {
  collapsed: boolean;
}) {
  return (
    <div
      className={cn(
        'mt-auto border-t border-border/50 pt-4',
        collapsed ? 'px-2' : 'px-3'
      )}
    >
      <SecondaryNavigation
        collapsed={collapsed}
        selectedPrimaryKey={selectedPrimaryKey}
        selectedResourceKey={selectedResourceKey}
        projects={projects}
        selectedProjectId={selectedProjectId}
        selectedProjectTab={selectedProjectTab}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function MobileSecondaryNavigation({
  selectedPrimaryKey,
  selectedResourceKey,
  projects,
  selectedProjectId,
  selectedProjectTab,
  onNavigate
}: AppNavigationProps) {
  return (
    <div className="mt-4 border-t border-border/50 pt-4">
      <SecondaryNavigation
        collapsed={false}
        selectedPrimaryKey={selectedPrimaryKey}
        selectedResourceKey={selectedResourceKey}
        projects={projects}
        selectedProjectId={selectedProjectId}
        selectedProjectTab={selectedProjectTab}
        onNavigate={onNavigate}
      />
    </div>
  );
}
