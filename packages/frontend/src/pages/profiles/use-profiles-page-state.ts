import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Profile } from '@agent-workbench/shared';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { createProfile, deleteProfile, listProfiles } from '@/api/profiles';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryKeys } from '@/query/query-keys';

import {
  buildProfilePayload,
  type ProfileEditorFormValues
} from './profile-editor.form';

const createProfileFormSchema = z.object({
  name: z.string().trim().min(1, 'Profile name is required').max(100),
  description: z.string().trim().max(500).optional()
});

export function useProfilesPageState() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      closeCreateDialog();
      void navigate(`/profiles/${created.id}/edit`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: async () => {
      closeDeleteDialog();
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
      setDeleteError(null);
      await deleteMutation.mutateAsync(pendingDelete.id);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : '删除 Profile 失败'
      );
    }
  }, [deleteMutation, pendingDelete]);

  const handleCreate = form.handleSubmit(async (values) => {
    try {
      setCreateError(null);
      await createMutation.mutateAsync(buildProfilePayload(values));
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : '创建 Profile 失败'
      );
    }
  });

  const items = profilesQuery.data ?? [];
  const loading =
    profilesQuery.isPending ||
    profilesQuery.isFetching ||
    createMutation.isPending ||
    deleteMutation.isPending;

  return {
    createDialogOpen,
    createError,
    createPending: createMutation.isPending,
    deleteError,
    deleteMutation,
    form,
    items,
    loading,
    pendingDelete,
    showToolbar: items.length > 0,
    openCreateDialog: () => setCreateDialogOpen(true),
    closeCreateDialog,
    openDeleteDialog: setPendingDelete,
    closeDeleteDialog,
    navigateToProfileEdit: (profileId: string) =>
      void navigate(`/profiles/${profileId}/edit`),
    submitCreate: () => void handleCreate(),
    submitDelete: () => void handleDelete()
  };

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    form.reset();
    setCreateError(null);
  }

  function closeDeleteDialog() {
    setPendingDelete(null);
    setDeleteError(null);
  }
}
