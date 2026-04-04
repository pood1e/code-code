export const projectConfig = {
  path: '/projects',
  singularLabel: 'Project',
  pluralLabel: 'Projects',
  emptyState: '还没有任何 Project，先创建一个新的 Project。'
} as const;

export type ProjectTabKey =
  | 'dashboard'
  | 'chats'
  | 'pipelines'
  | 'channels'
  | 'send'
  | 'notifications'
  | 'config';

export const projectRoutePatterns = {
  list: projectConfig.path,
  dashboard: `${projectConfig.path}/:id/dashboard`,
  // Chat routes (primary)
  chats: `${projectConfig.path}/:id/chats`,
  chatDetail: `${projectConfig.path}/:id/chats/:sessionId`,
  // Pipeline routes
  pipelines: `${projectConfig.path}/:id/pipelines`,
  pipelineDetail: `${projectConfig.path}/:id/pipelines/:pipelineId`,
  // Legacy session routes (redirect to chats)
  sessions: `${projectConfig.path}/:id/sessions`,
  sessionDetail: `${projectConfig.path}/:id/sessions/:sessionId`,
  // Notification routes
  channels: `${projectConfig.path}/:id/channels`,
  send: `${projectConfig.path}/:id/send`,
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

export function buildProjectSendPath(projectId: string) {
  return `${projectConfig.path}/${projectId}/send`;
}

export function buildProjectNotificationsPath(projectId: string) {
  return `${projectConfig.path}/${projectId}/notifications`;
}

export function buildProjectChatsPath(
  projectId: string,
  sessionId?: string | null
) {
  return sessionId
    ? `${projectConfig.path}/${projectId}/chats/${sessionId}`
    : `${projectConfig.path}/${projectId}/chats`;
}

export function buildProjectPipelinesPath(
  projectId: string,
  pipelineId?: string | null
) {
  return pipelineId
    ? `${projectConfig.path}/${projectId}/pipelines/${pipelineId}`
    : `${projectConfig.path}/${projectId}/pipelines`;
}

/** @deprecated Use buildProjectChatsPath instead */
export function buildProjectSessionsPath(
  projectId: string,
  sessionId?: string | null
) {
  return buildProjectChatsPath(projectId, sessionId);
}

export function buildProjectTabPath(projectId: string, tab: ProjectTabKey) {
  switch (tab) {
    case 'dashboard':
      return buildProjectDashboardPath(projectId);
    case 'config':
      return buildProjectConfigPath(projectId);
    case 'channels':
      return buildProjectChannelsPath(projectId);
    case 'send':
      return buildProjectSendPath(projectId);
    case 'notifications':
      return buildProjectNotificationsPath(projectId);
    case 'pipelines':
      return buildProjectPipelinesPath(projectId);
    default:
      return buildProjectChatsPath(projectId);
  }
}
