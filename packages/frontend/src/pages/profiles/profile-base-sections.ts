import type { Dispatch, SetStateAction } from 'react';

import {
  filterAvailableResources,
  removeSelectedItem,
  reorderSelectedItems,
  syncOrders,
  toAvailableItems,
  type BaseSectionConfig,
  type SearchState,
  type SelectedBaseItem
} from './profile-editor.form';

type BaseResourceCatalogItem = {
  id: string;
  name: string;
  description: string | null;
};

type BaseSectionInput = {
  key: BaseSectionConfig['key'];
  title: BaseSectionConfig['title'];
  emptyAvailableText: string;
  emptySelectedText: string;
  searchValue: string;
  deferredSearchValue: string;
  catalogItems: BaseResourceCatalogItem[];
  selectedIds: Set<string>;
  selectedItems: SelectedBaseItem[];
  setSearchState: Dispatch<SetStateAction<SearchState>>;
  setSelectedItems: Dispatch<SetStateAction<SelectedBaseItem[]>>;
};

export function addBaseResource(
  resourceId: string,
  resources: BaseResourceCatalogItem[],
  selectedIds: Set<string>,
  setItems: Dispatch<SetStateAction<SelectedBaseItem[]>>
) {
  const resource = resources.find((item) => item.id === resourceId);
  if (!resource || selectedIds.has(resourceId)) {
    return;
  }

  setItems((current) =>
    syncOrders([
      ...current,
      {
        resourceId,
        name: resource.name,
        description: resource.description,
        order: current.length
      }
    ])
  );
}

export function buildBaseSectionConfig({
  key,
  title,
  emptyAvailableText,
  emptySelectedText,
  searchValue,
  deferredSearchValue,
  catalogItems,
  selectedIds,
  selectedItems,
  setSearchState,
  setSelectedItems
}: BaseSectionInput): BaseSectionConfig {
  return {
    key,
    title,
    emptyAvailableText,
    emptySelectedText,
    searchValue,
    onSearchChange: (value) =>
      setSearchState((current) => ({ ...current, [key]: value })),
    availableItems: toAvailableItems(
      filterAvailableResources(catalogItems, selectedIds, deferredSearchValue)
    ),
    selectedItems,
    onAdd: (resourceId) =>
      addBaseResource(resourceId, catalogItems, selectedIds, setSelectedItems),
    onRemove: (resourceId) =>
      setSelectedItems((current) => removeSelectedItem(current, resourceId)),
    onReorder: (activeId, overId) =>
      setSelectedItems((current) =>
        reorderSelectedItems(current, activeId, overId)
      )
  };
}
