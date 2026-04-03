import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import type { Profile } from '@agent-workbench/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useErrorMessage } from '@/hooks/use-error-message';
import { createProfile, deleteProfile, listProfiles } from '@/api/profiles';
import { ConfirmDialog } from '@/components/app/ConfirmDialog';
import { DataTable } from '@/components/app/DataTable';
import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/query/query-keys';
import {
  buildProfilePayload,
  type ProfileEditorFormValues
} from '@/pages/profiles/profile-editor.form';
import {
  formatDateTime,
  formatNullableDescription
} from '@/utils/format-display';

const createProfileFormSchema = z.object({
  name: z.string().trim().min(1, 'Profile name is required').max(100),
  description: z.string().trim().max(500).optional()
});

export function ProfilesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);

  const form = useForm<ProfileEditorFormValues>({
    resolver: zodResolver(createProfileFormSchema),
    defaultValues: {
      name: '',
      description: ''
    }
  });

  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: listProfiles
  });

  useEffect(() => {
    if (profilesQuery.error) {
      handleError(profilesQuery.error);
    }
  }, [handleError, profilesQuery.error]);

  const createMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.list()
      });
      setCreateDialogOpen(false);
      form.reset();
      void navigate(`/profiles/${created.id}/edit`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: async () => {
      setPendingDelete(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.list()
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
      handleError(error);
    }
  }, [deleteMutation, handleError, pendingDelete]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync(buildProfilePayload(values));
    } catch (error) {
      handleError(error);
    }
  });
  const items = profilesQuery.data ?? [];
  const showToolbar = items.length > 0;

  const columns = useMemo<Array<ColumnDef<Profile>>>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => void navigate(`/profiles/${row.original.id}/edit`)}
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
              onClick={() => void navigate(`/profiles/${row.original.id}/edit`)}
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
    [navigate]
  );

  return (
    <SurfaceCard>
      {showToolbar ? (
        <div className="flex items-center justify-end border-b border-border/40 pb-4">
          <Button
            size="sm"
            aria-label="新建 Profile"
            title="新建 Profile"
            onClick={() => setCreateDialogOpen(true)}
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
          isLoading={
            profilesQuery.isPending ||
            profilesQuery.isFetching ||
            createMutation.isPending ||
            deleteMutation.isPending
          }
          emptyTitle="暂无 Profiles"
          emptyDescription="还没有任何 Profile，先创建一个新的 Profile。"
          emptyAction={
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus data-icon="inline-start" />
              新建 Profile
            </Button>
          }
          mobileCardRenderer={(profile) => (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => void navigate(`/profiles/${profile.id}/edit`)}
                className="text-left font-medium text-foreground transition-colors hover:text-primary"
              >
                {profile.name}
              </button>
              <p className="text-sm leading-6 text-muted-foreground">
                {formatNullableDescription(profile.description)}
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(profile.updatedAt)}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`编辑 ${profile.name}`}
                    title={`编辑 ${profile.name}`}
                    onClick={() =>
                      void navigate(`/profiles/${profile.id}/edit`)
                    }
                  >
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    aria-label={`删除 ${profile.name}`}
                    title={`删除 ${profile.name}`}
                    onClick={() => setPendingDelete(profile)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          )}
        />
      </div>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            form.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 Profile</DialogTitle>
            <DialogDescription className="sr-only">
              新建 Profile
            </DialogDescription>
          </DialogHeader>

          <form
            id="create-profile-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <FormField
              label="Name"
              htmlFor="profile-name"
              error={form.formState.errors.name?.message}
            >
              <Input id="profile-name" {...form.register('name')} />
            </FormField>

            <FormField
              label="Description"
              htmlFor="profile-description"
              error={form.formState.errors.description?.message}
            >
              <Textarea
                id="profile-description"
                rows={4}
                {...form.register('description')}
              />
            </FormField>
          </form>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                form.reset();
              }}
            >
              取消
            </Button>
            <Button
              type="submit"
              form="create-profile-form"
              disabled={createMutation.isPending}
            >
              新建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete ? `删除 ${pendingDelete.name}？` : '删除 Profile？'
        }
        description="删除后不可恢复，绑定在该 Profile 上的资源组合也会一起移除。"
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
    </SurfaceCard>
  );
}
