import { useState } from 'react';

import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';

import type {
  ChannelFilter,
  NotificationChannelSummary
} from '@agent-workbench/shared';

import { toApiRequestError } from '@/api/client';
import { ConfirmDialog } from '@/components/app/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useDeleteChannel } from '../hooks/use-notification-channels';

type NotificationChannelActionHandlers = {
  capabilityNameMap: Map<string, string>;
  onDelete: (channel: NotificationChannelSummary) => void;
  onEdit: (channel: NotificationChannelSummary) => void;
};

type NotificationChannelDeleteDialogProps = {
  channel?: NotificationChannelSummary;
  open: boolean;
  scopeId: string;
  onClose: () => void;
};

export function NotificationChannelFilterBadges({
  filter
}: {
  filter: ChannelFilter;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {filter.messageTypes.map((messageType) => (
        <Badge
          key={messageType}
          variant="secondary"
          className="font-mono text-xs"
        >
          {messageType}
        </Badge>
      ))}
      {filter.conditions && filter.conditions.length > 0 ? (
        <Badge variant="outline" className="text-xs">
          +{filter.conditions.length} 条件
        </Badge>
      ) : null}
    </div>
  );
}

export function createNotificationChannelColumns({
  capabilityNameMap,
  onDelete,
  onEdit
}: NotificationChannelActionHandlers): Array<
  ColumnDef<NotificationChannelSummary>
> {
  return [
    {
      id: 'name',
      header: '名称',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">
            {capabilityNameMap.get(row.original.capabilityId) ??
              row.original.capabilityId}
          </p>
        </div>
      )
    },
    {
      id: 'filter',
      header: '过滤器',
      cell: ({ row }) => (
        <NotificationChannelFilterBadges filter={row.original.filter} />
      )
    },
    {
      id: 'enabled',
      header: '状态',
      size: 80,
      cell: ({ row }) => (
        <Badge variant={row.original.enabled ? 'default' : 'secondary'}>
          {row.original.enabled ? '启用' : '禁用'}
        </Badge>
      )
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(row.original)}
            aria-label={`编辑通道 ${row.original.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(row.original)}
            className="text-destructive hover:text-destructive"
            aria-label={`删除通道 ${row.original.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )
    }
  ];
}

export function NotificationChannelDeleteDialog({
  channel,
  open,
  scopeId,
  onClose
}: NotificationChannelDeleteDialogProps) {
  const deleteMutation = useDeleteChannel(channel?.id ?? '', scopeId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClose() {
    setErrorMessage(null);
    onClose();
  }

  function handleConfirm() {
    if (!channel) {
      return;
    }

    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        handleClose();
      },
      onError: (error) => {
        setErrorMessage(toApiRequestError(error).message);
      }
    });
  }

  return (
    <ConfirmDialog
      open={open}
      title="删除通道"
      description={`确定要删除通道「${channel?.name ?? ''}」吗？若当前没有正在投递的通知任务，将允许删除，已有通知记录会继续保留。`}
      confirmLabel="删除"
      destructive
      pending={deleteMutation.isPending}
      errorMessage={errorMessage}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
      onConfirm={handleConfirm}
    />
  );
}
