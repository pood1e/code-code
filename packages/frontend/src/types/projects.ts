export const projectConfig = {
  path: '/projects',
  singularLabel: 'Project',
  pluralLabel: 'Projects',
  emptyState: '还没有任何 Project，先创建一个新的 Project。'
} as const;

export type ProjectTabKey = 'dashboard' | 'sessions' | 'config';

export const projectRoutePatterns = {
  list: projectConfig.path,
  dashboard: `${projectConfig.path}/:id/dashboard`,
  sessions: `${projectConfig.path}/:id/sessions`,
  sessionDetail: `${projectConfig.path}/:id/sessions/:sessionId`,
  config: `${projectConfig.path}/:id/config`
} as const;

export function buildProjectDashboardPath(projectId: string) {
  return `${projectConfig.path}/${projectId}/dashboard`;
}

export function buildProjectConfigPath(projectId: string) {
  return `${projectConfig.path}/${projectId}/config`;
}

export function buildProjectTabPath(projectId: string, tab: ProjectTabKey) {
  return tab === 'dashboard'
    ? buildProjectDashboardPath(projectId)
    : tab === 'config'
      ? buildProjectConfigPath(projectId)
      : buildProjectSessionsPath(projectId);
}

export function buildProjectSessionsPath(
  projectId: string,
  sessionId?: string | null
) {
  return sessionId
    ? `${projectConfig.path}/${projectId}/sessions/${sessionId}`
    : `${projectConfig.path}/${projectId}/sessions`;
}
