import {
  Bell,
  BellRing,
  Blocks,
  Bot,
  CircuitBoard,
  FolderKanban,
  LayoutDashboard,
  MessageSquareText,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon
} from 'lucide-react';

import { agentRunnerConfig } from '@/types/agent-runners';
import { profileConfig } from '@/types/profiles';
import {
  buildProjectDashboardPath,
  buildProjectTabPath,
  projectConfig,
  type ProjectTabKey
} from '@/types/projects';
import { resourceConfigMap } from '@/types/resources';

export type PrimaryNavKey = 'projects' | 'resources';

export type ResourceNavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export type PrimaryNavItem = {
  key: PrimaryNavKey;
  path: string;
  label: string;
  icon: LucideIcon;
};

export type ProjectTabItem = {
  key: ProjectTabKey;
  label: string;
  icon: LucideIcon;
};

export const resourceNavItems: ResourceNavItem[] = [
  { key: resourceConfigMap.skills.path, label: 'Skills', icon: SlidersHorizontal },
  { key: resourceConfigMap.mcps.path, label: 'MCPs', icon: CircuitBoard },
  { key: resourceConfigMap.rules.path, label: 'Rules', icon: ShieldCheck },
  { key: profileConfig.path, label: 'Profiles', icon: Blocks },
  { key: agentRunnerConfig.path, label: 'Runners', icon: Bot }
];

export const primaryNavItems: PrimaryNavItem[] = [
  {
    key: 'projects',
    path: projectConfig.path,
    label: 'Projects',
    icon: FolderKanban
  },
  {
    key: 'resources',
    path: resourceConfigMap.skills.path,
    label: '资源库',
    icon: Blocks
  }
];

export const projectTabItems: ProjectTabItem[] = [
  { key: 'dashboard', label: '概览', icon: LayoutDashboard },
  { key: 'sessions', label: '会话', icon: MessageSquareText },
  { key: 'channels', label: '通知渠道', icon: Bell },
  { key: 'notifications', label: '通知记录', icon: BellRing },
  { key: 'config', label: '配置', icon: SlidersHorizontal }
];

export type AppLayoutRouteState = {
  isProjectPage: boolean;
  selectedPrimaryKey: PrimaryNavKey;
  selectedResourceKey: string;
  routeProjectId: string | null;
  selectedProjectTab: ProjectTabKey;
};

export function deriveAppLayoutRouteState(pathname: string): AppLayoutRouteState {
  const selectedProjectTab =
    (pathname.match(
      /^\/projects\/[^/]+\/(dashboard|sessions|channels|notifications|config)/
    )?.[1] as ProjectTabKey | undefined) ?? 'dashboard';

  return {
    isProjectPage: /^\/projects\/[^/]+/.test(pathname),
    selectedPrimaryKey: pathname.startsWith(projectConfig.path)
      ? 'projects'
      : 'resources',
    selectedResourceKey:
      resourceNavItems.find((item) => pathname.startsWith(item.key))?.key ??
      resourceConfigMap.skills.path,
    routeProjectId: pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null,
    selectedProjectTab
  };
}

export function resolveSelectedProjectId(
  routeProjectId: string | null,
  currentProjectId: string | null,
  projects: Array<{ id: string }>
) {
  const candidateId = routeProjectId ?? currentProjectId;
  if (!candidateId) {
    return null;
  }

  return projects.some((project) => project.id === candidateId)
    ? candidateId
    : null;
}

export function resolvePrimaryProjectPath(currentProjectId: string | null) {
  return currentProjectId
    ? buildProjectDashboardPath(currentProjectId)
    : projectConfig.path;
}
