import { useState } from 'react';

import { type ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Bell, Pencil, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { channelFilterSchema } from '@agent-workbench/shared';
import type { ChannelFilter, NotificationChannelSummary } from '@agent-workbench/shared';

import { ConfirmDialog } from '@/components/app/ConfirmDialog';
import { DataTable } from '@/components/app/DataTable';
import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useErrorMessage } from '@/hooks/use-error-message';
import {
  useChannelTypes,
  useCreateChannel,
  useDeleteChannel,
  useNotificationChannels,
  useUpdateChannel
} from '@/features/notifications/hooks/use-notification-channels';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { toApiRequestError } from '@/api/client';

// ─── Form schema ──────────────────────────────────────────────────────────────

const channelFormSchema = z.object({
  name: z.string().min(1, '渠道名称不能为空').max(200),
  channelType: z.string().min(1, '请选择渠道类型'),
  filterJson: z.string().min(1).refine((v) => {
    try {
      channelFilterSchema.parse(JSON.parse(v) as unknown);
      return true;
    } catch {
      return false;
    }
  }, { message: '必须是合法 JSON，且包含 eventTypes 数组' }),
  configJson: z.string().refine((v) => {
    try { JSON.parse(v); return true; } catch { return false; }
  }, { message: '不是合法 JSON' }),
  enabled: z.boolean()
});

type ChannelFormValues = z.infer<typeof channelFormSchema>;

function toFormValues(ch: NotificationChannelSummary): ChannelFormValues {
  return {
    name: ch.name,
    channelType: ch.channelType,
    filterJson: JSON.stringify(ch.filter, null, 2),
    configJson: JSON.stringify(ch.config, null, 2),
    enabled: ch.enabled
  };
}

// ─── Filter badges ─────────────────────────────────────────────────────────────

function FilterBadges({ filter }: { filter: ChannelFilter }) {
  return (
    <div className="flex flex-wrap gap-1">
      {filter.eventTypes.map((et) => (
        <Badge key={et} variant="secondary" className="font-mono text-xs">
          {et}
        </Badge>
      ))}
      {filter.conditions && filter.conditions.length > 0 && (
        <Badge variant="outline" className="text-xs">
          +{filter.conditions.length} 条件
        </Badge>
      )}
    </div>
  );
}

// ─── Channel form dialog ───────────────────────────────────────────────────────

type ChannelFormDialogProps = {
  open: boolean;
  onClose: () => void;
  scopeId: string;
  editing?: NotificationChannelSummary;
};

function ChannelFormDialog({ open, onClose, scopeId, editing }: ChannelFormDialogProps) {
  const isEdit = editing !== undefined;
  const { data: channelTypes = [] } = useChannelTypes();
  const createMutation = useCreateChannel(scopeId);
  const updateMutation = useUpdateChannel(editing?.id ?? '', scopeId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: editing
      ? toFormValues(editing)
      : {
          name: '',
          channelType: channelTypes[0] ?? '',
          filterJson: JSON.stringify({ eventTypes: ['session.*'] }, null, 2),
          configJson: '{}',
          enabled: true
        }
  });

  function handleClose() {
    form.reset();
    setSubmitError(null);
    onClose();
  }

  async function onSubmit(values: ChannelFormValues) {
    try {
      setSubmitError(null);
      const filter = JSON.parse(values.filterJson) as ChannelFilter;
      const config = JSON.parse(values.configJson) as Record<string, unknown>;
      if (isEdit) {
        await updateMutation.mutateAsync({ name: values.name, channelType: values.channelType, filter, config, enabled: values.enabled });
      } else {
        await createMutation.mutateAsync({ scopeId, name: values.name, channelType: values.channelType, filter, config, enabled: values.enabled });
      }
      handleClose();
    } catch (err) {
      setSubmitError(toApiRequestError(err).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑渠道' : '创建渠道'}</DialogTitle>
        </DialogHeader>

        <form
          id="channel-form"
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">名称</label>
            <Input placeholder="例如：会话故障告警" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">渠道类型</label>
            <NativeSelect {...form.register('channelType')}>
              {channelTypes.length === 0 && (
                <option value="" disabled>暂无已注册的渠道类型</option>
              )}
              {channelTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </NativeSelect>
            {form.formState.errors.channelType && (
              <p className="text-xs text-destructive">{form.formState.errors.channelType.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">事件过滤器（JSON）</label>
            <Textarea
              placeholder='{"eventTypes":["session.*"]}'
              className="font-mono text-sm"
              rows={5}
              {...form.register('filterJson')}
            />
            {form.formState.errors.filterJson && (
              <p className="text-xs text-destructive">{form.formState.errors.filterJson.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">渠道配置（JSON）</label>
            <Textarea
              placeholder="{}"
              className="font-mono text-sm"
              rows={4}
              {...form.register('configJson')}
            />
            {form.formState.errors.configJson && (
              <p className="text-xs text-destructive">{form.formState.errors.configJson.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ch-enabled"
              {...form.register('enabled')}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <label htmlFor="ch-enabled" className="text-sm font-medium">启用</label>
          </div>

          {submitError && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {submitError}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>取消</Button>
          <Button
            form="channel-form"
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function ProjectChannelsPage() {
  const { id: projectId, isLoading: projectLoading, isNotFound } = useProjectPageData();
  const { data: channels = [], isLoading } = useNotificationChannels(projectId ?? undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NotificationChannelSummary | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<NotificationChannelSummary | undefined>();
  const deleteMutation = useDeleteChannel(deleteTarget?.id ?? '', projectId ?? '');
  const handleQueryError = useErrorMessage();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (projectLoading || isLoading) return <PageLoadingSkeleton />;

  if (isNotFound || !projectId) {
    return <EmptyState title="Project 不存在" description="当前 Project 不存在或已被删除。" />;
  }

  const columns: ColumnDef<NotificationChannelSummary>[] = [
    {
      id: 'name',
      header: '名称',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.channelType}</p>
        </div>
      )
    },
    {
      id: 'filter',
      header: '过滤器',
      cell: ({ row }) => <FilterBadges filter={row.original.filter} />
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
            id={`edit-channel-${row.original.id}`}
            onClick={() => setEditTarget(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            id={`delete-channel-${row.original.id}`}
            onClick={() => setDeleteTarget(row.original)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">通知渠道</h1>
              <Badge variant="secondary">{channels.length}</Badge>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)} id="create-channel-btn">
              <Plus className="mr-1.5 h-4 w-4" />
              新建渠道
            </Button>
          </div>

          <DataTable
            data={channels}
            columns={columns}
            emptyTitle="暂无通知渠道"
            emptyDescription="创建渠道后，系统会根据事件过滤器自动发送匹配事件。"
            emptyAction={<Button onClick={() => setCreateOpen(true)}>新建渠道</Button>}
          />
        </div>
      </div>

      <ChannelFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        scopeId={projectId}
      />

      {editTarget && (
        <ChannelFormDialog
          open
          onClose={() => setEditTarget(undefined)}
          scopeId={projectId}
          editing={editTarget}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== undefined}
        title="删除渠道"
        description={`确定要删除渠道「${deleteTarget?.name ?? ''}」吗？此操作不可恢复。`}
        confirmLabel="删除"
        destructive
        pending={deleteMutation.isPending}
        errorMessage={deleteError}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(undefined);
            setDeleteError(null);
          }
        }}
        onConfirm={() => {
          deleteMutation.mutate(undefined, {
            onSuccess: () => {
              setDeleteTarget(undefined);
              setDeleteError(null);
            },
            onError: (err) => {
              setDeleteError(toApiRequestError(err).message);
            }
          });
        }}
      />
    </div>
  );
}
