import type { ResourceKind } from '@agent-workbench/shared';

function normalizeSearchValue(value?: string) {
  return value?.trim() ?? '';
}

export const queryKeys = {
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
