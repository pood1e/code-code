import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import type { AgentRunnerSummary } from '@agent-workbench/shared';
import { useNavigate } from 'react-router-dom';

import {
  deleteAgentRunner,
  listAgentRunners,
  listAgentRunnerTypes
} from '@/api/agent-runners';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryKeys } from '@/query/query-keys';
import { useUiStore } from '@/store/ui-store';
import {
  buildAgentRunnerCreatePath,
  buildAgentRunnerEditPath
} from '@/types/agent-runners';

export function useAgentRunnerListPageState() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const searchValue = useUiStore((state) => state.agentRunnerSearch);
  const setSearchValue = useUiStore((state) => state.setAgentRunnerSearch);
  const debouncedSearchValue = useDebouncedValue(searchValue.trim(), 300);
  const [pendingDelete, setPendingDelete] = useState<AgentRunnerSummary | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const runnerTypesQuery = useQuery({
    queryKey: queryKeys.agentRunnerTypes.all,
    queryFn: listAgentRunnerTypes
  });
  const agentRunnersQuery = useQuery({
    queryKey: queryKeys.agentRunners.list(debouncedSearchValue),
    queryFn: () => listAgentRunners(debouncedSearchValue || undefined),
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    if (runnerTypesQuery.error) {
      handleError(runnerTypesQuery.error);
    }
  }, [handleError, runnerTypesQuery.error]);

  useEffect(() => {
    if (agentRunnersQuery.error) {
      handleError(agentRunnersQuery.error);
    }
  }, [agentRunnersQuery.error, handleError]);

  const deleteMutation = useMutation({
    mutationFn: deleteAgentRunner,
    onSuccess: async () => {
      closeDeleteDialog();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.agentRunners.all
      });
    }
  });

  const items = agentRunnersQuery.data ?? [];

  return {
    items,
    pendingDelete,
    deleteError,
    deletePending: deleteMutation.isPending,
    loading:
      runnerTypesQuery.isPending ||
      agentRunnersQuery.isPending ||
      deleteMutation.isPending,
    runnerTypes: runnerTypesQuery.data ?? [],
    searchValue,
    showToolbar: items.length > 0 || searchValue.length > 0,
    agentRunnersQuery,
    setSearchValue,
    openDeleteDialog: setPendingDelete,
    closeDeleteDialog,
    navigateToAgentRunnerCreate: () => void navigate(buildAgentRunnerCreatePath()),
    navigateToAgentRunnerEdit: (id: string) =>
      void navigate(buildAgentRunnerEditPath(id)),
    submitDelete: () => {
      if (!pendingDelete) {
        return;
      }

      void deleteMutation
        .mutateAsync(pendingDelete.id)
        .then(() => setDeleteError(null))
        .catch((error) =>
          setDeleteError(
            error instanceof Error ? error.message : '删除 AgentRunner 失败'
          )
        );
    }
  };

  function closeDeleteDialog() {
    setPendingDelete(null);
    setDeleteError(null);
  }
}
