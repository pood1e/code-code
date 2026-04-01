import type { ResourceKind } from '@agent-workbench/shared';

function normalizeSearchValue(value?: string) {
  return value?.trim() ?? '';
}

export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    list: (searchValue?: string) =>
      ['projects', 'list', normalizeSearchValue(searchValue)] as const,
    detail: (id: string) => ['projects', 'detail', id] as const
  },
  agentRunnerTypes: {
    all: ['agent-runner-types'] as const
  },
  agentRunners: {
    all: ['agent-runners'] as const,
    list: (searchValue?: string) =>
      ['agent-runners', 'list', normalizeSearchValue(searchValue)] as const,
    detail: (id: string) => ['agent-runners', 'detail', id] as const
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
  }
};
