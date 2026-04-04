import type { Profile } from '@agent-workbench/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { ConfirmDialog } from '@/components/app/ConfirmDialog';
import { FormField } from '@/components/app/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ProfileEditorFormValues } from '@/pages/profiles/profile-editor.form';
import {
  formatDateTime,
  formatNullableDescription
} from '@/utils/format-display';

type ProfileActionHandlers = {
  onDelete: (profile: Profile) => void;
  onEdit: (profileId: string) => void;
};

type CreateProfileDialogProps = {
  createError: string | null;
  form: UseFormReturn<ProfileEditorFormValues>;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

type DeleteProfileDialogProps = {
  errorMessage: string | null;
  open: boolean;
  pending: boolean;
  profile: Profile | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function createProfileColumns({
  onDelete,
  onEdit
}: ProfileActionHandlers): Array<ColumnDef<Profile>> {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onEdit(row.original.id)}
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
            onClick={() => onEdit(row.original.id)}
          >
            <Pencil data-icon="inline-start" />
            编辑
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={`删除 ${row.original.name}`}
            title={`删除 ${row.original.name}`}
            onClick={() => onDelete(row.original)}
          >
            <Trash2 />
          </Button>
        </div>
      )
    }
  ];
}

export function renderProfileMobileCard(
  profile: Profile,
  handlers: ProfileActionHandlers
) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => handlers.onEdit(profile.id)}
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
            onClick={() => handlers.onEdit(profile.id)}
          >
            编辑
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={`删除 ${profile.name}`}
            title={`删除 ${profile.name}`}
            onClick={() => handlers.onDelete(profile)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CreateProfileDialog({
  createError,
  form,
  open,
  pending,
  onClose,
  onSubmit
}: CreateProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建 Profile</DialogTitle>
          <DialogDescription className="sr-only">新建 Profile</DialogDescription>
        </DialogHeader>

        <form
          id="create-profile-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
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
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="create-profile-form" disabled={pending}>
            新建
          </Button>
        </DialogFooter>

        {createError ? (
          <p className="text-sm text-destructive">{createError}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteProfileDialog({
  errorMessage,
  open,
  pending,
  profile,
  onClose,
  onConfirm
}: DeleteProfileDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={profile ? `删除 ${profile.name}？` : '删除 Profile？'}
      description="删除后不可恢复，绑定在该 Profile 上的资源组合也会一起移除。"
      errorMessage={errorMessage}
      confirmLabel="删除"
      destructive
      pending={pending}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      onConfirm={onConfirm}
    />
  );
}
