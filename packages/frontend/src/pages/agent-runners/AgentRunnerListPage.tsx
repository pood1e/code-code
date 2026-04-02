import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentRunnerSummary } from '@agent-workbench/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useErrorMessage } from '@/hooks/use-error-message';
import {
  deleteAgentRunner,
  listAgentRunners,
  listAgentRunnerTypes
} from '@/api/agent-runners';
import { ConfirmDialog } from '@/components/app/ConfirmDialog';
import { DataTable } from '@/components/app/DataTable';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { queryKeys } from '@/query/query-keys';
import { useUiStore } from '@/store/ui-store';
import { agentRunnerConfig } from '@/types/agent-runners';
import {
  formatDateTime,
  formatNullableDescription
} from '@/utils/entity-table';
import { getRunnerTypeName } from './agent-runner.utils';

export function AgentRunnerListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const searchValue = useUiStore((state) => state.agentRunnerSearch);
  const setSearchValue = useUiStore((state) => state.setAgentRunnerSearch);
  const debouncedSearchValue = useDebouncedValue(searchValue.trim(), 300);
  const [pendingDelete, setPendingDelete] = useState<AgentRunnerSummary | null>(
    null
  );

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
      setPendingDelete(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.agentRunners.all
      });
    }
  });

  const items = agentRunnersQuery.data ?? [];
  const loading =
    runnerTypesQuery.isPending ||
    agentRunnersQuery.isPending ||
    deleteMutation.isPending;
  const showToolbar = items.length > 0 || searchValue.length > 0;

  const columns = useMemo<Array<ColumnDef<AgentRunnerSummary>>>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() =>
              void navigate(`${agentRunnerConfig.path}/${row.original.id}/edit`)
            }
            className="text-left font-medium text-foreground transition-colors hover:text-primary"
          >
            {row.original.name}
          </button>
        )
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {getRunnerTypeName(runnerTypesQuery.data ?? [], row.original.type)}
          </span>
        )
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            {formatNullableDescription(row.original.description)}
          </p>
        )
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.updatedAt)}
          </span>
        )
      },
      {
        id: 'actions',
        header: '',
        size: 108,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              variant="outline"
              size="sm"
              aria-label={`编辑 ${row.original.name}`}
              title={`编辑 ${row.original.name}`}
              onClick={() =>
                void navigate(`${agentRunnerConfig.path}/${row.original.id}/edit`)
              }
            >
              <Pencil data-icon="inline-start" />
              编辑
            </Button>
            <Button
              variant="destructive"
              size="icon-sm"
              aria-label={`删除 ${row.original.name}`}
              title={`删除 ${row.original.name}`}
              onClick={() => setPendingDelete(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        )
      }
    ],
    [navigate, runnerTypesQuery.data]
  );

  return (
    <SurfaceCard>
      {showToolbar ? (
        <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="按名称搜索"
              className="h-10 rounded-xl pl-10"
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={`刷新 ${agentRunnerConfig.pluralLabel}`}
              title={`刷新 ${agentRunnerConfig.pluralLabel}`}
              onClick={() => void agentRunnersQuery.refetch()}
              disabled={agentRunnersQuery.isFetching}
            >
              <RefreshCw
                data-icon="inline-start"
                className={agentRunnersQuery.isFetching ? 'animate-spin' : undefined}
              />
              <span className="hidden sm:inline">刷新</span>
            </Button>
            <Button
              size="sm"
              aria-label={`新建 ${agentRunnerConfig.singularLabel}`}
              title={`新建 ${agentRunnerConfig.singularLabel}`}
              onClick={() => void navigate(`${agentRunnerConfig.path}/new`)}
            >
              <Plus data-icon="inline-start" />
              <span className="hidden sm:inline">
                新建 {agentRunnerConfig.singularLabel}
              </span>
            </Button>
          </div>
        </div>
      ) : null}

      <div className={showToolbar ? 'pt-4' : ''}>
        <DataTable
          columns={columns}
          data={items}
          isLoading={loading}
          emptyTitle={`暂无 ${agentRunnerConfig.pluralLabel}`}
          emptyDescription={agentRunnerConfig.emptyState}
          emptyAction={
            <Button onClick={() => void navigate(`${agentRunnerConfig.path}/new`)}>
              <Plus data-icon="inline-start" />
              新建 {agentRunnerConfig.singularLabel}
            </Button>
          }
          mobileCardRenderer={(agentRunner) => (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() =>
                  void navigate(`${agentRunnerConfig.path}/${agentRunner.id}/edit`)
                }
                className="text-left font-medium text-foreground transition-colors hover:text-primary"
              >
                {agentRunner.name}
              </button>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Type:{' '}
                  {getRunnerTypeName(runnerTypesQuery.data ?? [], agentRunner.type)}
                </p>
                <p>{formatNullableDescription(agentRunner.description)}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(agentRunner.updatedAt)}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void navigate(`${agentRunnerConfig.path}/${agentRunner.id}/edit`)
                    }
                  >
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => setPendingDelete(agentRunner)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete
            ? `删除 ${pendingDelete.name}？`
            : `删除 ${agentRunnerConfig.singularLabel}？`
        }
        description="删除后不可恢复，相关配置将立即失效。"
        confirmLabel="删除"
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        onConfirm={() => {
          if (pendingDelete) {
            void deleteMutation.mutateAsync(pendingDelete.id).catch(handleError);
          }
        }}
      />
    </SurfaceCard>
  );
}
