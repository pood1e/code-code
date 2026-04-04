import { useCallback, useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import type { ResourceKind, ResourceRecord } from '@agent-workbench/shared';
import { useNavigate } from 'react-router-dom';

import { ApiRequestError } from '@/api/client';
import { getReferencedProfiles } from '@/api/conflict-utils';
import { deleteResource, listResources } from '@/api/resources';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryKeys } from '@/query/query-keys';
import { useUiStore } from '@/store/ui-store';
import { resourceConfigMap } from '@/types/resources';

type ReferencedProfilesDialogState = {
  open: boolean;
  message: string;
  profiles: Array<{ id: string; name: string }>;
};

export function useResourceListPageState(kind: ResourceKind) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const config = resourceConfigMap[kind];
  const searchValue = useUiStore((state) => state.resourceSearch[kind]);
  const setSearchValue = useUiStore((state) => state.setResourceSearch);
  const debouncedSearchValue = useDebouncedValue(searchValue.trim(), 300);
  const [pendingDelete, setPendingDelete] = useState<ResourceRecord | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [referencedState, setReferencedState] =
    useState<ReferencedProfilesDialogState>({
      open: false,
      message: '',
      profiles: []
    });

  const resourceListQuery = useQuery({
    queryKey: queryKeys.resources.list(kind, debouncedSearchValue),
    queryFn: () => listResources(kind, debouncedSearchValue || undefined),
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    if (resourceListQuery.error) {
      handleError(resourceListQuery.error);
    }
  }, [handleError, resourceListQuery.error]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResource(kind, id),
    onSuccess: async () => {
      closeDeleteDialog();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.resources.lists()
      });
    }
  });

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) {
      return;
    }

    try {
      setDeleteError(null);
      await deleteMutation.mutateAsync(pendingDelete.id);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 409) {
        closeDeleteDialog();
        setReferencedState({
          open: true,
          message: error.message,
          profiles: getReferencedProfiles(error.data)
        });
        return;
      }

      setDeleteError(
        error instanceof Error ? error.message : `删除 ${config.singularLabel} 失败`
      );
    }
  }, [config.singularLabel, deleteMutation, pendingDelete]);

  const items = resourceListQuery.data ?? [];

  return {
    config,
    deleteError,
    deletePending: deleteMutation.isPending,
    items,
    loading: resourceListQuery.isPending || deleteMutation.isPending,
    pendingDelete,
    referencedState,
    searchValue,
    showToolbar: items.length > 0 || searchValue.length > 0,
    resourceListQuery,
    setSearchValue: (value: string) => setSearchValue(kind, value),
    navigateToResourceEdit: (resourceId: string) =>
      void navigate(`${config.path}/${resourceId}/edit`),
    navigateToResourceCreate: () => void navigate(`${config.path}/new`),
    openDeleteDialog: setPendingDelete,
    closeDeleteDialog,
    submitDelete: () => void handleDelete(),
    closeReferencedDialog: () =>
      setReferencedState((current) => ({ ...current, open: false }))
  };

  function closeDeleteDialog() {
    setPendingDelete(null);
    setDeleteError(null);
  }
}
