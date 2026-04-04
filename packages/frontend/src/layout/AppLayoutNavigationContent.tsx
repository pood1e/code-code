import type { LucideIcon } from 'lucide-react';

import { CompactNativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { buildProjectTabPath, type ProjectTabKey } from '@/types/projects';

import {
  primaryNavItems,
  projectTabItems,
  resourceNavItems,
  type PrimaryNavKey
} from './app-layout.model';

export type AppNavigationProps = {
  selectedPrimaryKey: PrimaryNavKey;
  selectedResourceKey: string;
  projects: Array<{ id: string; name: string }>;
  selectedProjectId: string | null;
  selectedProjectTab: ProjectTabKey;
  onNavigate: (path: string) => void;
};

type SidebarNavButtonProps = {
  collapsed: boolean;
  label: string;
  icon: LucideIcon;
  active: boolean;
  depth: 'primary' | 'secondary';
  onClick: () => void;
};

export function PrimaryNavigation({
  collapsed,
  selectedPrimaryKey,
  onNavigate
}: Pick<AppNavigationProps, 'selectedPrimaryKey' | 'onNavigate'> & {
  collapsed: boolean;
}) {
  return primaryNavItems.map((item) => (
    <SidebarNavButton
      key={item.key}
      collapsed={collapsed}
      label={item.label}
      icon={item.icon}
      active={item.key === selectedPrimaryKey}
      depth="primary"
      onClick={() => onNavigate(item.path)}
    />
  ));
}

export function SecondaryNavigation({
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
  if (
    selectedPrimaryKey === 'projects' &&
    selectedProjectId &&
    projects.length > 0
  ) {
    return (
      <>
        {collapsed ? null : (
          <ProjectSelect
            projects={projects}
            selectedProjectId={selectedProjectId}
            selectedProjectTab={selectedProjectTab}
            onNavigate={onNavigate}
            className="mb-2 px-3"
          />
        )}
        <nav className="space-y-0.5">
          <ProjectTabNavigation
            collapsed={collapsed}
            selectedProjectId={selectedProjectId}
            selectedProjectTab={selectedProjectTab}
            onNavigate={onNavigate}
          />
        </nav>
      </>
    );
  }

  if (selectedPrimaryKey !== 'resources') {
    return null;
  }

  return (
    <>
      {collapsed ? null : (
        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          资源
        </p>
      )}
      <nav className="space-y-0.5">
        <ResourceNavigation
          collapsed={collapsed}
          selectedResourceKey={selectedResourceKey}
          onNavigate={onNavigate}
        />
      </nav>
    </>
  );
}

function ProjectSelect({
  className,
  projects,
  selectedProjectId,
  selectedProjectTab,
  onNavigate
}: Pick<
  AppNavigationProps,
  'projects' | 'selectedProjectId' | 'selectedProjectTab' | 'onNavigate'
> & {
  className?: string;
}) {
  return (
    <div className={className}>
      <CompactNativeSelect
        aria-label="选择当前 Project"
        className="h-8 w-full rounded-xl bg-background/70 text-sm"
        value={selectedProjectId ?? ''}
        onChange={(event) =>
          onNavigate(
            buildProjectTabPath(event.target.value, selectedProjectTab)
          )
        }
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </CompactNativeSelect>
    </div>
  );
}

function ProjectTabNavigation({
  collapsed,
  selectedProjectId,
  selectedProjectTab,
  onNavigate
}: Pick<
  AppNavigationProps,
  'selectedProjectId' | 'selectedProjectTab' | 'onNavigate'
> & {
  collapsed: boolean;
}) {
  return projectTabItems.map((item) => (
    <SidebarNavButton
      key={item.key}
      collapsed={collapsed}
      label={item.label}
      icon={item.icon}
      active={item.key === selectedProjectTab}
      depth="secondary"
      onClick={() => {
        if (!selectedProjectId) {
          return;
        }
        onNavigate(buildProjectTabPath(selectedProjectId, item.key));
      }}
    />
  ));
}

function ResourceNavigation({
  collapsed,
  selectedResourceKey,
  onNavigate
}: Pick<AppNavigationProps, 'selectedResourceKey' | 'onNavigate'> & {
  collapsed: boolean;
}) {
  return resourceNavItems.map((item) => (
    <SidebarNavButton
      key={item.key}
      collapsed={collapsed}
      label={item.label}
      icon={item.icon}
      active={item.key === selectedResourceKey}
      depth="secondary"
      onClick={() => onNavigate(item.key)}
    />
  ));
}

function SidebarNavButton({
  collapsed,
  label,
  icon: Icon,
  active,
  depth,
  onClick
}: SidebarNavButtonProps) {
  const shapeClassName = depth === 'primary' ? 'rounded-xl' : 'rounded-lg';
  const layoutClassName = collapsed
    ? cn(
        'justify-center',
        depth === 'primary' ? 'py-2.5' : 'py-2'
      )
    : cn(
        'text-left',
        depth === 'primary'
          ? 'gap-2.5 px-3 py-2 text-sm'
          : 'gap-2 px-3 py-1.5 text-[13px]'
      );
  const stateClassName = active
    ? 'bg-accent font-medium text-foreground'
    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground';
  const iconClassName = depth === 'primary' ? 'size-4' : 'size-3.5';

  return (
    <button
      type="button"
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center transition-colors duration-150',
        shapeClassName,
        layoutClassName,
        stateClassName
      )}
    >
      <Icon className={cn('shrink-0', iconClassName)} />
      {collapsed ? null : label}
    </button>
  );
}
