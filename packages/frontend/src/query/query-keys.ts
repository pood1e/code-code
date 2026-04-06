import type { ResourceKind } from '@agent-workbench/shared';

function normalizeSearchValue(value?: string) {
  return value?.trim() ?? '';
}

export const NOOP_QUERY_KEY = ['__noop__'] as const;

export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    list: (searchValue?: string) =>
      ['projects', 'list', normalizeSearchValue(searchValue)] as const,
    detail: (id: string) => ['projects', 'detail', id] as const
  },
  sessions: {
    all: ['sessions'] as const,
    lists: () => ['sessions', 'list'] as const,
    list: (scopeId: string) => ['sessions', 'list', scopeId] as const,
    detail: (id: string) => ['sessions', 'detail', id] as const,
    messages: (id: string) => ['sessions', 'messages', id] as const
  },
  agentRunnerTypes: {
    all: ['agent-runner-types'] as const
  },
  agentRunners: {
    all: ['agent-runners'] as const,
    list: (searchValue?: string) =>
      ['agent-runners', 'list', normalizeSearchValue(searchValue)] as const,
    detail: (id: string) => ['agent-runners', 'detail', id] as const,
    context: (id: string) => ['agent-runners', 'context', id] as const
  },
  resources: {
    all: ['resources'] as const,
    lists: () => ['resources', 'list'] as const,
    list: (kind: ResourceKind, searchValue?: string) =>
      ['resources', 'list', kind, normalizeSearchValue(searchValue)] as const,
    details: () => ['resources', 'detail'] as const,
    detail: (kind: ResourceKind, id: string) =>
      ['resources', 'detail', kind, id] as const
  },
  profiles: {
    all: ['profiles'] as const,
    list: () => ['profiles', 'list'] as const,
    detail: (id: string) => ['profiles', 'detail', id] as const
  },
  notifications: {
    capabilities: () => ['notifications', 'capabilities'] as const,
    channels: {
      all: ['notifications', 'channels'] as const,
      list: (scopeId?: string) => ['notifications', 'channels', 'list', scopeId ?? ''] as const,
      detail: (id: string) => ['notifications', 'channels', 'detail', id] as const
    },
    tasks: {
      all: ['notifications', 'tasks'] as const,
      list: (scopeId?: string, channelId?: string) =>
        ['notifications', 'tasks', 'list', scopeId ?? '', channelId ?? ''] as const
    }
  },
  chats: {
    all: ['chats'] as const,
    lists: () => ['chats', 'list'] as const,
    list: (scopeId: string) => ['chats', 'list', scopeId] as const,
    detail: (id: string) => ['chats', 'detail', id] as const
  },
  pipelines: {
    all: ['pipelines'] as const,
    lists: () => ['pipelines', 'list'] as const,
    list: (scopeId: string) => ['pipelines', 'list', scopeId] as const,
    detail: (id: string) => ['pipelines', 'detail', id] as const,
    stages: (pipelineId: string) => ['pipelines', 'stages', pipelineId] as const,
    artifacts: (pipelineId: string) => ['pipelines', 'artifacts', pipelineId] as const
  },
  governance: {
    all: ['governance'] as const,
    scopes: {
      all: ['governance', 'scopes'] as const,
      overview: (scopeId: string) =>
        ['governance', 'scopes', 'overview', scopeId] as const,
      reviewQueue: (scopeId: string) =>
        ['governance', 'scopes', 'review-queue', scopeId] as const,
      policy: (scopeId: string) =>
        ['governance', 'scopes', 'policy', scopeId] as const,
      repositoryProfile: (scopeId: string) =>
        ['governance', 'scopes', 'repository-profile', scopeId] as const
    },
    findings: {
      all: ['governance', 'findings'] as const,
      list: (scopeId?: string, status?: string) =>
        ['governance', 'findings', 'list', scopeId ?? '', status ?? ''] as const
    },
    issues: {
      all: ['governance', 'issues'] as const,
      list: (scopeId?: string, status?: string) =>
        ['governance', 'issues', 'list', scopeId ?? '', status ?? ''] as const,
      detail: (id: string) => ['governance', 'issues', 'detail', id] as const
    },
    changeUnits: {
      all: ['governance', 'change-units'] as const,
      list: (scopeId?: string, issueId?: string, status?: string) =>
        [
          'governance',
          'change-units',
          'list',
          scopeId ?? '',
          issueId ?? '',
          status ?? ''
        ] as const
    },
    deliveryArtifacts: {
      all: ['governance', 'delivery-artifacts'] as const,
      list: (scopeId?: string, status?: string) =>
        ['governance', 'delivery-artifacts', 'list', scopeId ?? '', status ?? ''] as const
    }
  }
};
