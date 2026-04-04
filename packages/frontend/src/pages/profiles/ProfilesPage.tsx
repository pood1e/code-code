import { Plus } from 'lucide-react';
import { useMemo } from 'react';

import { DataTable } from '@/components/app/DataTable';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';

import {
  createProfileColumns,
  CreateProfileDialog,
  DeleteProfileDialog,
  renderProfileMobileCard
} from './profiles-page.components';
import { useProfilesPageState } from './use-profiles-page-state';

export function ProfilesPage() {
  const {
    createDialogOpen,
    createError,
    createPending,
    deleteError,
    deleteMutation,
    form,
    items,
    loading,
    pendingDelete,
    showToolbar,
    openCreateDialog,
    closeCreateDialog,
    openDeleteDialog,
    closeDeleteDialog,
    navigateToProfileEdit,
    submitCreate,
    submitDelete
  } = useProfilesPageState();

  const actionHandlers = useMemo(
    () => ({
      onDelete: openDeleteDialog,
      onEdit: navigateToProfileEdit
    }),
    [navigateToProfileEdit, openDeleteDialog]
  );

  const columns = useMemo(
    () => createProfileColumns(actionHandlers),
    [actionHandlers]
  );

  return (
    <SurfaceCard>
      {showToolbar ? (
        <div className="flex items-center justify-end border-b border-border/40 pb-4">
          <Button
            size="sm"
            aria-label="新建 Profile"
            title="新建 Profile"
            onClick={openCreateDialog}
          >
            <Plus data-icon="inline-start" />
            <span className="hidden sm:inline">新建 Profile</span>
          </Button>
        </div>
      ) : null}

      <div className={showToolbar ? 'pt-4' : ''}>
        <DataTable
          columns={columns}
          data={items}
          isLoading={loading}
          emptyTitle="暂无 Profiles"
          emptyDescription="还没有任何 Profile，先创建一个新的 Profile。"
          emptyAction={
            <Button onClick={openCreateDialog}>
              <Plus data-icon="inline-start" />
              新建 Profile
            </Button>
          }
          mobileCardRenderer={(profile) =>
            renderProfileMobileCard(profile, actionHandlers)
          }
        />
      </div>

      <CreateProfileDialog
        open={createDialogOpen}
        createError={createError}
        form={form}
        pending={createPending}
        onClose={closeCreateDialog}
        onSubmit={submitCreate}
      />

      <DeleteProfileDialog
        open={Boolean(pendingDelete)}
        profile={pendingDelete}
        errorMessage={deleteError}
        pending={deleteMutation.isPending}
        onClose={closeDeleteDialog}
        onConfirm={submitDelete}
      />
    </SurfaceCard>
  );
}
