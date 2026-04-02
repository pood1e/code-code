import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import type { ResourceKind, ResourceRecord } from '@agent-workbench/shared';
import { Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  ApiRequestError,
  getReferencedProfiles
} from '@/api/client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { deleteResource, listResources } from '@/api/resources';
import { ConfirmDialog } from '@/components/app/ConfirmDialog';
import { DataTable } from '@/components/app/DataTable';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { queryKeys } from '@/query/query-keys';
import { useUiStore } from '@/store/ui-store';
import { resourceConfigMap } from '@/types/resources';
import {
  formatDateTime,
  formatNullableDescription
} from '@/utils/entity-table';

type ResourceListPageProps = {
  kind: ResourceKind;
};

type ReferencedProfilesDialogState = {
  open: boolean;
  message: string;
  profiles: Array<{ id: string; name: string }>;
};

export function ResourceListPage({ kind }: ResourceListPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const config = resourceConfigMap[kind];
  const searchValue = useUiStore((state) => state.resourceSearch[kind]);
  const setSearchValue = useUiStore((state) => state.setResourceSearch);
  const debouncedSearchValue = useDebouncedValue(searchValue.trim(), 300);
  const [pendingDelete, setPendingDelete] = useState<ResourceRecord | null>(null);
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
      setPendingDelete(null);
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
      await deleteMutation.mutateAsync(pendingDelete.id);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 409) {
        setPendingDelete(null);
        setReferencedState({
          open: true,
          message: error.message,
          profiles: getReferencedProfiles(error.data)
        });
        return;
      }

      handleError(error);
    }
  }, [deleteMutation, handleError, pendingDelete]);

  const items = resourceListQuery.data ?? [];
  const loading = resourceListQuery.isPending || deleteMutation.isPending;
  const showToolbar = items.length > 0 || searchValue.length > 0;

  const columns = useMemo<Array<ColumnDef<ResourceRecord>>>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => void navigate(`${config.path}/${row.original.id}/edit`)}
            className="text-left font-medium text-foreground transition-colors hover:text-primary"
          >
            {row.original.name}
          </button>
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
              onClick={() => void navigate(`${config.path}/${row.original.id}/edit`)}
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
    [config.path, navigate]
  );

  return (
    <SurfaceCard>
      {showToolbar ? (
        <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(kind, event.target.value)}
              placeholder="按名称搜索"
              className="h-10 rounded-xl pl-10"
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={`刷新 ${config.pluralLabel}`}
              title={`刷新 ${config.pluralLabel}`}
              onClick={() => void resourceListQuery.refetch()}
              disabled={resourceListQuery.isFetching}
            >
              <RefreshCw
                data-icon="inline-start"
                className={resourceListQuery.isFetching ? 'animate-spin' : undefined}
              />
              <span className="hidden sm:inline">刷新</span>
            </Button>
            <Button
              size="sm"
              aria-label={`新建 ${config.singularLabel}`}
              title={`新建 ${config.singularLabel}`}
              onClick={() => void navigate(`${config.path}/new`)}
            >
              <Plus data-icon="inline-start" />
              <span className="hidden sm:inline">新建 {config.singularLabel}</span>
            </Button>
          </div>
        </div>
      ) : null}

      <div className={showToolbar ? 'pt-4' : ''}>
        <DataTable
          columns={columns}
          data={items}
          isLoading={loading}
          emptyTitle={`暂无 ${config.pluralLabel}`}
          emptyDescription={config.emptyState}
          emptyAction={
            <Button
              onClick={() => void navigate(`${config.path}/new`)}
            >
              <Plus data-icon="inline-start" />
              新建 {config.singularLabel}
            </Button>
          }
          mobileCardRenderer={(item) => (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => void navigate(`${config.path}/${item.id}/edit`)}
                className="text-left font-medium text-foreground transition-colors hover:text-primary"
              >
                {item.name}
              </button>
              <p className="text-sm leading-6 text-muted-foreground">
                {formatNullableDescription(item.description)}
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(item.updatedAt)}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`编辑 ${item.name}`}
                    title={`编辑 ${item.name}`}
                    onClick={() => void navigate(`${config.path}/${item.id}/edit`)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    aria-label={`删除 ${item.name}`}
                    title={`删除 ${item.name}`}
                    onClick={() => setPendingDelete(item)}
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
            : `删除 ${config.singularLabel}？`
        }
        description="删除后不可恢复，相关配置将立即失效。"
        confirmLabel="删除"
        destructive
        pending={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        onConfirm={() => {
          void handleDelete();
        }}
      />

      <Dialog
        open={referencedState.open}
        onOpenChange={(open) =>
          setReferencedState((current) => ({ ...current, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>资源仍被 Profile 引用</DialogTitle>
            <DialogDescription>{referencedState.message}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {referencedState.profiles.length > 0 ? (
              referencedState.profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3"
                >
                  <p className="font-medium text-foreground">{profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.id}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                当前冲突未返回引用详情，请先检查 Profiles 页面中的依赖关系。
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SurfaceCard>
  );
}
