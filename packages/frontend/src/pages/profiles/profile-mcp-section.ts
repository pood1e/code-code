import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';
import type { ProfileDetail } from '@agent-workbench/shared';

import {
  buildMcpEditorState,
  filterAvailableResources,
  parseOverrideEditorValue,
  removeSelectedItem,
  reorderSelectedItems,
  syncOrders,
  toAvailableItems,
  toSelectedMcpItems,
  type McpSectionConfig,
  type OverrideEditorState,
  type ResourceCatalog,
  type SearchState,
  type SelectedMcpItem
} from './profile-editor.form';

export function useMcpSectionState({
  catalog,
  initialMcps,
  searchState,
  setSearchState
}: {
  catalog: ResourceCatalog['mcps'];
  initialMcps: ProfileDetail['mcps'];
  searchState: SearchState;
  setSearchState: Dispatch<SetStateAction<SearchState>>;
}) {
  const [selectedMcps, setSelectedMcps] = useState<SelectedMcpItem[]>(() =>
    toSelectedMcpItems(initialMcps)
  );
  const [expandedMcps, setExpandedMcps] = useState<string[]>([]);
  const [mcpEditorState, setMcpEditorState] = useState<
    Record<string, OverrideEditorState>
  >(() => buildMcpEditorState(toSelectedMcpItems(initialMcps)));
  const deferredMcpSearch = useDeferredValue(searchState.mcps);
  const selectedMcpIds = useMemo(
    () => new Set(selectedMcps.map((item) => item.resourceId)),
    [selectedMcps]
  );

  const mcpSection = useMemo<McpSectionConfig>(
    () => ({
      key: 'mcps',
      title: 'MCPs',
      emptyAvailableText: '没有可添加的 MCP',
      emptySelectedText: '还没有选中的 MCP',
      searchValue: searchState.mcps,
      onSearchChange: (value) =>
        setSearchState((current) => ({ ...current, mcps: value })),
      availableItems: toAvailableItems(
        filterAvailableResources(catalog, selectedMcpIds, deferredMcpSearch),
        (item) => item.content.command
      ),
      selectedItems: selectedMcps,
      onAdd: (resourceId) =>
        addMcpResource(
          resourceId,
          catalog,
          selectedMcpIds,
          setSelectedMcps,
          setMcpEditorState
        ),
      onRemove: (resourceId) =>
        removeMcpResource(
          resourceId,
          setSelectedMcps,
          setExpandedMcps,
          setMcpEditorState
        ),
      onReorder: (activeId, overId) =>
        setSelectedMcps((current) =>
          reorderSelectedItems(current, activeId, overId)
        )
    }),
    [catalog, deferredMcpSearch, searchState.mcps, selectedMcpIds, selectedMcps, setSearchState]
  );

  const updateMcpOverride = useCallback((resourceId: string, value: string) => {
    const parsed = parseOverrideEditorValue(value);

    setMcpEditorState((current) => ({
      ...current,
      [resourceId]: {
        value,
        error: parsed.error
      }
    }));
    setSelectedMcps((current) =>
      current.map((item) =>
        item.resourceId === resourceId
          ? { ...item, configOverride: parsed.override }
          : item
      )
    );
  }, []);

  const toggleMcpOverride = useCallback((resourceId: string) => {
    setExpandedMcps((current) =>
      current.includes(resourceId)
        ? current.filter((entry) => entry !== resourceId)
        : [...current, resourceId]
    );
  }, []);

  return {
    selectedMcps,
    mcpSection,
    expandedMcps,
    mcpEditorState,
    toggleMcpOverride,
    updateMcpOverride
  };
}

function addMcpResource(
  resourceId: string,
  resources: ResourceCatalog['mcps'],
  selectedIds: Set<string>,
  setSelectedMcps: Dispatch<SetStateAction<SelectedMcpItem[]>>,
  setMcpEditorState: Dispatch<
    SetStateAction<Record<string, OverrideEditorState>>
  >
) {
  const resource = resources.find((item) => item.id === resourceId);
  if (!resource || selectedIds.has(resourceId)) {
    return;
  }

  setSelectedMcps((current) =>
    syncOrders([
      ...current,
      {
        resourceId,
        name: resource.name,
        description: resource.description,
        order: current.length,
        command: resource.content.command,
        configOverride: undefined
      }
    ])
  );
  setMcpEditorState((current) => ({
    ...current,
    [resourceId]: {
      value: '',
      error: null
    }
  }));
}

function removeMcpResource(
  resourceId: string,
  setSelectedMcps: Dispatch<SetStateAction<SelectedMcpItem[]>>,
  setExpandedMcps: Dispatch<SetStateAction<string[]>>,
  setMcpEditorState: Dispatch<
    SetStateAction<Record<string, OverrideEditorState>>
  >
) {
  setSelectedMcps((current) => removeSelectedItem(current, resourceId));
  setExpandedMcps((current) => current.filter((item) => item !== resourceId));
  setMcpEditorState((current) => {
    const next = { ...current };
    delete next[resourceId];
    return next;
  });
}
