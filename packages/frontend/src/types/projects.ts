export const projectConfig = {
  path: '/projects',
  singularLabel: 'Project',
  pluralLabel: 'Projects',
  emptyState: '还没有任何 Project，先创建一个新的 Project。'
} as const;

export type ProjectTabKey = 'dashboard' | 'sessions' | 'channels' | 'notifications' | 'config';

export const projectRoutePatterns = {
  list: projectConfig.path,
  dashboard: `${projectConfig.path}/:id/dashboard`,
  sessions: `${projectConfig.path}/:id/sessions`,
  sessionDetail: `${projectConfig.path}/:id/sessions/:sessionId`,
  channels: `${projectConfig.path}/:id/channels`,
  notifications: `${projectConfig.path}/:id/notifications`,
  config: `${projectConfig.path}/:id/config`
} as const;

export function buildProjectDashboardPath(projectId: string) {
  return `${projectConfig.path}/${projectId}/dashboard`;
}

export function buildProjectConfigPath(projectId: string) {
  return `${projectConfig.path}/${projectId}/config`;
}

export function buildProjectChannelsPath(projectId: string) {
  return `${projectConfig.path}/${projectId}/channels`;
}

export function buildProjectNotificationsPath(projectId: string) {
  return `${projectConfig.path}/${projectId}/notifications`;
}

export function buildProjectTabPath(projectId: string, tab: ProjectTabKey) {
  switch (tab) {
    case 'dashboard':
      return buildProjectDashboardPath(projectId);
    case 'config':
      return buildProjectConfigPath(projectId);
    case 'channels':
      return buildProjectChannelsPath(projectId);
    case 'notifications':
      return buildProjectNotificationsPath(projectId);
    default:
      return buildProjectSessionsPath(projectId);
  }
}

export function buildProjectSessionsPath(
  projectId: string,
  sessionId?: string | null
) {
  return sessionId
    ? `${projectConfig.path}/${projectId}/sessions/${sessionId}`
    : `${projectConfig.path}/${projectId}/sessions`;
}
