import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import type { ResourceKind } from '@agent-workbench/shared';

import { DataTable } from '@/components/app/DataTable';
import { ListPageToolbar } from '@/components/app/ListPageToolbar';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';

import {
  createResourceColumns,
  ReferencedProfilesDialog,
  renderResourceMobileCard,
  ResourceDeleteDialog
} from './resource-list-page.components';
import { useResourceListPageState } from './use-resource-list-page-state';

type ResourceListPageProps = {
  kind: ResourceKind;
};

export function ResourceListPage({ kind }: ResourceListPageProps) {
  const {
    config,
    deleteError,
    deletePending,
    items,
    loading,
    pendingDelete,
    referencedState,
    searchValue,
    showToolbar,
    resourceListQuery,
    setSearchValue,
    navigateToResourceCreate,
    navigateToResourceEdit,
    openDeleteDialog,
    closeDeleteDialog,
    submitDelete,
    closeReferencedDialog
  } = useResourceListPageState(kind);

  const actionHandlers = useMemo(
    () => ({
      onDelete: openDeleteDialog,
      onEdit: navigateToResourceEdit
    }),
    [navigateToResourceEdit, openDeleteDialog]
  );

  const columns = useMemo(
    () => createResourceColumns(actionHandlers),
    [actionHandlers]
  );

  return (
    <SurfaceCard>
      {showToolbar ? (
        <ListPageToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onRefresh={() => void resourceListQuery.refetch()}
          onCreate={navigateToResourceCreate}
          refreshPending={resourceListQuery.isFetching}
          refreshLabel={`刷新 ${config.pluralLabel}`}
          createLabel={`新建 ${config.singularLabel}`}
        />
      ) : null}

      <div className={showToolbar ? 'pt-3' : ''}>
        <DataTable
          columns={columns}
          data={items}
          isLoading={loading}
          emptyTitle={`暂无 ${config.pluralLabel}`}
          emptyDescription={config.emptyState}
          emptyAction={
            <Button onClick={navigateToResourceCreate}>
              <Plus data-icon="inline-start" />
              新建 {config.singularLabel}
            </Button>
          }
          mobileCardRenderer={(resource) =>
            renderResourceMobileCard(resource, actionHandlers)
          }
        />
      </div>

      <ResourceDeleteDialog
        open={Boolean(pendingDelete)}
        resource={pendingDelete}
        config={config}
        errorMessage={deleteError}
        pending={deletePending}
        onClose={closeDeleteDialog}
        onConfirm={submitDelete}
      />

      <ReferencedProfilesDialog
        open={referencedState.open}
        message={referencedState.message}
        profiles={referencedState.profiles}
        onClose={closeReferencedDialog}
      />
    </SurfaceCard>
  );
}
