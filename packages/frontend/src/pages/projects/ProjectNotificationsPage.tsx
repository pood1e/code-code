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

import type {
  NotificationChannelSummary,
  NotificationTaskSummary
} from '@agent-workbench/shared';
import { NotificationTaskStatus } from '@agent-workbench/shared';

import { DataTable } from '@/components/app/DataTable';
import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompactNativeSelect } from '@/components/ui/native-select';
import { useErrorMessage } from '@/hooks/use-error-message';
import {
  useNotificationTasks,
  useRetryTask
} from '@/features/notifications/hooks/use-notification-tasks';
import { useNotificationChannels } from '@/features/notifications/hooks/use-notification-channels';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';

const STATUS_LABELS: Record<NotificationTaskStatus, string> = {
  [NotificationTaskStatus.Pending]: '等待中',
  [NotificationTaskStatus.Processing]: '处理中',
  [NotificationTaskStatus.Success]: '成功',
  [NotificationTaskStatus.Failed]: '失败'
};

type ChannelFilterOption = {
  value: string;
  label: string;
};

function buildChannelFilterOptions(
  channels: NotificationChannelSummary[],
  tasks: NotificationTaskSummary[]
): ChannelFilterOption[] {
  const activeOptions = channels.map((channel) => ({
    value: `active:${channel.id}`,
    label: channel.name
  }));
  const deletedOptions = Array.from(
    new Set(
      tasks
        .filter((task) => task.channelDeleted)
        .map((task) => task.channelName)
        .filter((channelName) => channelName.length > 0)
    )
  ).map((channelName) => ({
    value: `deleted:${channelName}`,
    label: `${channelName}（已删除）`
  }));

  return [...activeOptions, ...deletedOptions];
}

function matchesChannelFilterValue(
  task: NotificationTaskSummary,
  filterValue: string
): boolean {
  if (filterValue === 'all') {
    return true;
  }

  if (filterValue.startsWith('active:')) {
    return task.channelId === filterValue.slice('active:'.length);
  }

  if (filterValue.startsWith('deleted:')) {
    return (
      task.channelDeleted &&
      task.channelName === filterValue.slice('deleted:'.length)
    );
  }

  return false;
}

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

export function ProjectNotificationsPage() {
  const {
    id: projectId,
    isLoading: projectLoading,
    isNotFound
  } = useProjectPageData();
  const [statusFilter, setStatusFilter] = useState<
    NotificationTaskStatus | 'all'
  >('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const channelsQuery = useNotificationChannels(projectId ?? undefined);
  const tasksQuery = useNotificationTasks(projectId ?? undefined);
  const retryMutation = useRetryTask(projectId ?? undefined);
  const handleQueryError = useErrorMessage();

  if (projectLoading || channelsQuery.isLoading || tasksQuery.isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (isNotFound || !projectId) {
    return (
      <EmptyState
        title="Project 不存在"
        description="当前 Project 不存在或已被删除。"
      />
    );
  }

  if (channelsQuery.error || tasksQuery.error) {
    return (
      <EmptyState
        title="通知记录加载失败"
        description="通知任务或通道列表暂时不可用，请稍后刷新重试。"
        action={
          <Button
            variant="outline"
            onClick={() => {
              void channelsQuery.refetch();
              void tasksQuery.refetch();
            }}
          >
            刷新
          </Button>
        }
      />
    );
  }

  const channels = channelsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const channelOptions = buildChannelFilterOptions(channels, tasks);
  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false;
    }

    return matchesChannelFilterValue(task, channelFilter);
  });

  const columns: ColumnDef<NotificationTaskSummary>[] = [
    {
      id: 'message',
      header: '消息',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.messageTitle}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {row.original.messageType}
          </p>
        </div>
      )
    },
    {
      id: 'channelName',
      header: '通道',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-sm">{row.original.channelName}</span>
          {row.original.channelDeleted ? (
            <Badge variant="secondary">已删除</Badge>
          ) : null}
        </div>
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
        row.original.status === NotificationTaskStatus.Failed &&
        !row.original.channelDeleted ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              retryMutation.mutate(row.original.id, {
                onError: (error) => handleQueryError(error)
              });
            }}
            disabled={retryMutation.isPending}
            title="重试"
            aria-label={`重试通知任务 ${row.original.messageTitle}`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : null
    }
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">通知记录</h1>
              <Badge variant="secondary">{filteredTasks.length}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void tasksQuery.refetch()}
              disabled={tasksQuery.isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${
                  tasksQuery.isFetching ? 'animate-spin' : ''
                }`}
              />
              刷新
            </Button>
          </div>

          <div className="flex gap-3">
            <CompactNativeSelect
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as NotificationTaskStatus | 'all'
                )
              }
              aria-label="状态过滤"
            >
              <option value="all">所有状态</option>
              {(Object.values(NotificationTaskStatus) as NotificationTaskStatus[]).map(
                (status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                )
              )}
            </CompactNativeSelect>

            <CompactNativeSelect
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              aria-label="通道过滤"
            >
              <option value="all">所有通道</option>
              {channelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CompactNativeSelect>
          </div>

          <DataTable
            data={filteredTasks}
            columns={columns}
            emptyTitle="暂无通知记录"
            emptyDescription="当系统收到匹配通道过滤器的内部通知消息后，投递记录会显示在这里。"
          />
        </div>
      </div>
    </div>
  );
}
