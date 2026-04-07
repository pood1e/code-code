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
  | 'resources'
  | 'governance'
  | 'reviews'
  | 'channels'
  | 'send'
  | 'notifications'
  | 'config';

export const projectRoutePatterns = {
  list: projectConfig.path,
  dashboard: `${projectConfig.path}/:id/dashboard`,
  chats: `${projectConfig.path}/:id/chats`,
  chatDetail: `${projectConfig.path}/:id/chats/:chatId`,
  pipelines: `${projectConfig.path}/:id/pipelines`,
  pipelineDetail: `${projectConfig.path}/:id/pipelines/:pipelineId`,
  resources: `${projectConfig.path}/:id/resources`,
  resourceDetail: `${projectConfig.path}/:id/resources/:issueId`,
  governance: `${projectConfig.path}/:id/governance`,
  governanceDetail: `${projectConfig.path}/:id/governance/:issueId`,
  reviews: `${projectConfig.path}/:id/reviews`,
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
  chatId?: string | null
) {
  return chatId
    ? `${projectConfig.path}/${projectId}/chats/${chatId}`
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

export function buildProjectResourcesPath(
  projectId: string,
  issueId?: string | null
) {
  return issueId
    ? `${projectConfig.path}/${projectId}/resources/${issueId}`
    : `${projectConfig.path}/${projectId}/resources`;
}

export function buildProjectGovernancePath(
  projectId: string,
  issueId?: string | null
) {
  return issueId
    ? `${projectConfig.path}/${projectId}/governance/${issueId}`
    : `${projectConfig.path}/${projectId}/governance`;
}

export function buildProjectReviewsPath(projectId: string) {
  return `${projectConfig.path}/${projectId}/reviews`;
}

export function buildProjectTabPath(projectId: string, tab: ProjectTabKey) {
  switch (tab) {
    case 'dashboard':
      return buildProjectDashboardPath(projectId);
    case 'config':
      return buildProjectConfigPath(projectId);
    case 'governance':
      return buildProjectGovernancePath(projectId);
    case 'reviews':
      return buildProjectReviewsPath(projectId);
    case 'channels':
      return buildProjectChannelsPath(projectId);
    case 'send':
      return buildProjectSendPath(projectId);
    case 'notifications':
      return buildProjectNotificationsPath(projectId);
    case 'pipelines':
      return buildProjectPipelinesPath(projectId);
    case 'resources':
      return buildProjectResourcesPath(projectId);
    default:
      return buildProjectChatsPath(projectId);
  }
}
