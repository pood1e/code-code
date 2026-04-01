import {
  mcpConfigOverrideSchema,
  profileInputSchema,
  type McpConfigOverride,
  type McpResource,
  type ProfileDetail,
  type RuleResource,
  type SaveProfileInput,
  type SkillResource
} from '@agent-workbench/shared';
import type { ReactNode } from 'react';

import type { ProfilePayload } from '../../api/profiles';
import { normalizeDescription } from '../../utils/normalizers';

export type ProfileEditorFormValues = {
  name: string;
  description?: string;
};

export type ResourceCatalog = {
  skills: SkillResource[];
  mcps: McpResource[];
  rules: RuleResource[];
};

export type SelectedBaseItem = {
  resourceId: string;
  name: string;
  description: string | null;
  order: number;
};

export type SelectedMcpItem = SelectedBaseItem & {
  command: string;
  configOverride?: McpConfigOverride;
};

export type OverrideEditorState = {
  value: string;
  error: string | null;
};

export type AvailableResourceItem = {
  id: string;
  name: string;
  description: string | null;
  meta?: string;
};

export type SelectedResourceListProps<T extends SelectedBaseItem> = {
  title: string;
  emptyText: string;
  items: T[];
  onRemove: (resourceId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  renderMeta?: (item: T) => string | null;
  renderDetails?: (item: T) => ReactNode;
};

export type AvailableResourceListProps = {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  items: AvailableResourceItem[];
  emptyText: string;
  onAdd: (id: string) => void;
};

export type SearchState = {
  skills: string;
  mcps: string;
  rules: string;
};

export type BaseSectionConfig = {
  key: 'skills' | 'rules';
  title: 'Skills' | 'Rules';
  emptyAvailableText: string;
  emptySelectedText: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  availableItems: AvailableResourceItem[];
  selectedItems: SelectedBaseItem[];
  onAdd: (resourceId: string) => void;
  onRemove: (resourceId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
};

export type McpSectionConfig = {
  key: 'mcps';
  title: 'MCPs';
  emptyAvailableText: string;
  emptySelectedText: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  availableItems: AvailableResourceItem[];
  selectedItems: SelectedMcpItem[];
  onAdd: (resourceId: string) => void;
  onRemove: (resourceId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
};

export function syncOrders<T extends { order: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, order: index }));
}

export function reorderSelectedItems<
  T extends { resourceId: string; order: number }
>(items: T[], activeId: string, overId: string) {
  const currentIndex = items.findIndex((item) => item.resourceId === activeId);
  const nextIndex = items.findIndex((item) => item.resourceId === overId);

  if (currentIndex === -1 || nextIndex === -1) {
    return items;
  }

  const moved = items.slice();
  const [activeItem] = moved.splice(currentIndex, 1);
  moved.splice(nextIndex, 0, activeItem);

  return syncOrders(moved);
}

export function hasOverrideValue(override?: McpConfigOverride) {
  return Boolean(override && Object.keys(override).length > 0);
}

export function normalizeOverride(override?: McpConfigOverride) {
  return hasOverrideValue(override) ? override : undefined;
}

export function formatOverrideEditorValue(override?: McpConfigOverride) {
  if (!hasOverrideValue(override)) {
    return '';
  }

  return JSON.stringify(override, null, 2);
}

export function parseOverrideEditorValue(value: string) {
  if (!value.trim()) {
    return {
      override: undefined,
      error: null
    };
  }

  try {
    const parsedJson = JSON.parse(value) as unknown;
    const parsedOverride = mcpConfigOverrideSchema.safeParse(parsedJson);

    if (!parsedOverride.success) {
      return {
        override: undefined,
        error:
          parsedOverride.error.issues[0]?.message ?? 'Invalid MCP override.'
      };
    }

    return {
      override: normalizeOverride(parsedOverride.data),
      error: null
    };
  } catch {
    return {
      override: undefined,
      error: 'Override must be valid JSON.'
    };
  }
}

export function filterAvailableResources<T extends { id: string; name: string }>(
  items: T[],
  selectedIds: Set<string>,
  searchValue: string
) {
  const normalizedSearch = searchValue.trim().toLowerCase();

  return items
    .filter((item) => !selectedIds.has(item.id))
    .filter((item) =>
      normalizedSearch ? item.name.toLowerCase().includes(normalizedSearch) : true
    );
}

export function buildProfilePayload(
  values: ProfileEditorFormValues
): ProfilePayload {
  const parsed = profileInputSchema.safeParse({
    name: values.name,
    description: normalizeDescription(values.description)
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid profile data.');
  }

  return parsed.data satisfies ProfilePayload;
}

export function buildSaveProfileInput(
  values: ProfileEditorFormValues,
  selectedSkills: SelectedBaseItem[],
  selectedMcps: SelectedMcpItem[],
  selectedRules: SelectedBaseItem[]
): SaveProfileInput {
  const profile = buildProfilePayload(values);

  return {
    ...profile,
    skills: syncOrders(selectedSkills).map((item) => ({
      resourceId: item.resourceId,
      order: item.order
    })),
    mcps: syncOrders(selectedMcps).map((item) => ({
      resourceId: item.resourceId,
      order: item.order,
      configOverride: normalizeOverride(item.configOverride)
    })),
    rules: syncOrders(selectedRules).map((item) => ({
      resourceId: item.resourceId,
      order: item.order
    }))
  } satisfies SaveProfileInput;
}

export function toAvailableItems<
  T extends { id: string; name: string; description: string | null }
>(items: T[], meta?: (item: T) => string | undefined) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    meta: meta?.(item)
  }));
}

export function removeSelectedItem<T extends { resourceId: string; order: number }>(
  items: T[],
  resourceId: string
) {
  return syncOrders(items.filter((item) => item.resourceId !== resourceId));
}

export function toSelectedBaseItems(
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    order: number;
  }>
) {
  return syncOrders(
    items.map((item) => ({
      resourceId: item.id,
      name: item.name,
      description: item.description,
      order: item.order
    }))
  );
}

export function toSelectedMcpItems(items: ProfileDetail['mcps']) {
  return syncOrders(
    items.map((item) => ({
      resourceId: item.id,
      name: item.name,
      description: item.description,
      order: item.order,
      command: item.content.command,
      configOverride: normalizeOverride(item.configOverride)
    }))
  );
}

export function buildMcpEditorState(items: SelectedMcpItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.resourceId,
      {
        value: formatOverrideEditorValue(item.configOverride),
        error: null
      }
    ])
  );
}
