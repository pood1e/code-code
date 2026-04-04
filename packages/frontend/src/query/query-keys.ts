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
  }
};
