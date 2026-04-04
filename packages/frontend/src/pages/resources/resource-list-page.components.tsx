import type { ResourceRecord } from '@agent-workbench/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/app/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { resourceConfigMap } from '@/types/resources';
import {
  formatDateTime,
  formatNullableDescription
} from '@/utils/format-display';

type ResourcePageConfig = (typeof resourceConfigMap)[keyof typeof resourceConfigMap];

type ResourceActionHandlers = {
  onDelete: (resource: ResourceRecord) => void;
  onEdit: (resourceId: string) => void;
};

type ResourceDeleteDialogProps = {
  config: ResourcePageConfig;
  errorMessage: string | null;
  open: boolean;
  pending: boolean;
  resource: ResourceRecord | null;
  onClose: () => void;
  onConfirm: () => void;
};

type ReferencedProfilesDialogProps = {
  open: boolean;
  message: string;
  profiles: Array<{ id: string; name: string }>;
  onClose: () => void;
};

export function createResourceColumns(
  handlers: ResourceActionHandlers
): Array<ColumnDef<ResourceRecord>> {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => handlers.onEdit(row.original.id)}
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
            onClick={() => handlers.onEdit(row.original.id)}
          >
            <Pencil data-icon="inline-start" />
            编辑
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={`删除 ${row.original.name}`}
            title={`删除 ${row.original.name}`}
            onClick={() => handlers.onDelete(row.original)}
          >
            <Trash2 />
          </Button>
        </div>
      )
    }
  ];
}

export function renderResourceMobileCard(
  resource: ResourceRecord,
  handlers: ResourceActionHandlers
) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => handlers.onEdit(resource.id)}
        className="text-left font-medium text-foreground transition-colors hover:text-primary"
      >
        {resource.name}
      </button>
      <p className="text-sm leading-6 text-muted-foreground">
        {formatNullableDescription(resource.description)}
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {formatDateTime(resource.updatedAt)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={`编辑 ${resource.name}`}
            title={`编辑 ${resource.name}`}
            onClick={() => handlers.onEdit(resource.id)}
          >
            编辑
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={`删除 ${resource.name}`}
            title={`删除 ${resource.name}`}
            onClick={() => handlers.onDelete(resource)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ResourceDeleteDialog({
  config,
  errorMessage,
  open,
  pending,
  resource,
  onClose,
  onConfirm
}: ResourceDeleteDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={resource ? `删除 ${resource.name}？` : `删除 ${config.singularLabel}？`}
      description="删除后不可恢复，相关配置将立即失效。"
      errorMessage={errorMessage}
      confirmLabel="删除"
      destructive
      pending={pending}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      onConfirm={onConfirm}
    />
  );
}

export function ReferencedProfilesDialog({
  open,
  message,
  profiles,
  onClose
}: ReferencedProfilesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>资源仍被 Profile 引用</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {profiles.length > 0 ? (
            profiles.map((profile) => (
              <div
                key={profile.id}
                className="rounded-2xl border border-border/40 bg-muted/40 px-4 py-3"
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
  );
}
