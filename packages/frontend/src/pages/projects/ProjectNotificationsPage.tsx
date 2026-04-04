import { useState } from 'react';

import { type ColumnDef } from '@tanstack/react-table';
import {
  BellRing,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle
} from 'lucide-react';

import type { NotificationTaskSummary } from '@agent-workbench/shared';
import { NotificationTaskStatus } from '@agent-workbench/shared';

import { DataTable } from '@/components/app/DataTable';
import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompactNativeSelect } from '@/components/ui/native-select';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useNotificationTasks, useRetryTask } from '@/features/notifications/hooks/use-notification-tasks';
import { useNotificationChannels } from '@/features/notifications/hooks/use-notification-channels';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<NotificationTaskStatus, string> = {
  [NotificationTaskStatus.Pending]: '等待中',
  [NotificationTaskStatus.Processing]: '处理中',
  [NotificationTaskStatus.Success]: '成功',
  [NotificationTaskStatus.Failed]: '失败'
};

function StatusBadge({ status }: { status: NotificationTaskStatus }) {
  switch (status) {
    case NotificationTaskStatus.Pending:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          等待中
        </Badge>
      );
    case NotificationTaskStatus.Processing:
      return (
        <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          处理中
        </Badge>
      );
    case NotificationTaskStatus.Success:
      return (
        <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          成功
        </Badge>
      );
    case NotificationTaskStatus.Failed:
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          失败
        </Badge>
      );
  }
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function ProjectNotificationsPage() {
  const { id: projectId, isLoading: projectLoading, isNotFound } = useProjectPageData();
  const [statusFilter, setStatusFilter] = useState<NotificationTaskStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const { data: channels = [] } = useNotificationChannels(projectId ?? undefined);

  const {
    data: tasks = [],
    isLoading,
    refetch,
    isFetching
  } = useNotificationTasks(
    projectId ?? undefined,
    channelFilter !== 'all' ? channelFilter : undefined
  );

  const retryMutation = useRetryTask(projectId ?? undefined);
  const handleQueryError = useErrorMessage();

  const filteredTasks =
    statusFilter === 'all'
      ? tasks
      : tasks.filter((t) => t.status === statusFilter);

  if (projectLoading || isLoading) return <PageLoadingSkeleton />;

  if (isNotFound || !projectId) {
    return <EmptyState title="Project 不存在" description="当前 Project 不存在或已被删除。" />;
  }

  const columns: ColumnDef<NotificationTaskSummary>[] = [
    {
      id: 'eventType',
      header: '事件类型',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.eventType}</span>
      )
    },
    {
      id: 'channelName',
      header: '渠道',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.channelName ?? row.original.channelId}</span>
      )
    },
    {
      id: 'status',
      header: '状态',
      size: 100,
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    },
    {
      id: 'lastError',
      header: '错误信息',
      cell: ({ row }) =>
        row.original.lastError ? (
          <span
            className="max-w-xs truncate text-xs text-destructive"
            title={row.original.lastError}
          >
            {row.original.lastError}
          </span>
        ) : null
    },
    {
      id: 'createdAt',
      header: '时间',
      size: 160,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleString('zh-CN')}
        </span>
      )
    },
    {
      id: 'actions',
      header: '',
      size: 60,
      cell: ({ row }) =>
        row.original.status === NotificationTaskStatus.Failed ? (
          <Button
            variant="ghost"
            size="sm"
            id={`retry-task-${row.original.id}`}
            onClick={() => {
              retryMutation.mutate(row.original.id, {
                onError: (err) => handleQueryError(err)
              });
            }}
            disabled={retryMutation.isPending}
            title="重试"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : null
    }
  ];

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">通知记录</h1>
              <Badge variant="secondary">{filteredTasks.length}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              id="refresh-tasks-btn"
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <CompactNativeSelect
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as NotificationTaskStatus | 'all')}
              aria-label="状态过滤"
            >
              <option value="all">所有状态</option>
              {(Object.values(NotificationTaskStatus) as NotificationTaskStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </CompactNativeSelect>

            <CompactNativeSelect
              id="channel-filter"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              aria-label="渠道过滤"
            >
              <option value="all">所有渠道</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </CompactNativeSelect>
          </div>

          <DataTable
            data={filteredTasks}
            columns={columns}
            emptyTitle="暂无通知记录"
            emptyDescription="当系统收到匹配渠道过滤器的事件后，发送记录将显示在此处。"
          />
        </div>
      </div>
    </div>
  );
}
