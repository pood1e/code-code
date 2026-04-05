import { useState } from 'react';

import { Bell, Plus } from 'lucide-react';

import type { NotificationChannelSummary } from '@agent-workbench/shared';

import { DataTable } from '@/components/app/DataTable';
import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NotificationChannelFormDialog } from '@/features/notifications/components/NotificationChannelFormDialog';
import {
  NotificationChannelDeleteDialog,
  createNotificationChannelColumns
} from '@/features/notifications/components/notification-channel-page.components';
import {
  useNotificationCapabilities,
  useNotificationChannels
} from '@/features/notifications/hooks/use-notification-channels';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';

export function ProjectChannelsPage() {
  const {
    id: projectId,
    isLoading: projectLoading,
    isNotFound
  } = useProjectPageData();
  const capabilitiesQuery = useNotificationCapabilities();
  const channelsQuery = useNotificationChannels(projectId ?? undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<
    NotificationChannelSummary | undefined
  >();
  const [deleteTarget, setDeleteTarget] = useState<
    NotificationChannelSummary | undefined
  >();

  if (projectLoading || channelsQuery.isLoading || capabilitiesQuery.isLoading) {
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

  if (channelsQuery.error || capabilitiesQuery.error) {
    return (
      <EmptyState
        title="通知数据加载失败"
        description="通知能力或通道列表暂时不可用，请稍后刷新重试。"
        action={
          <Button
            variant="outline"
            onClick={() => {
              void channelsQuery.refetch();
              void capabilitiesQuery.refetch();
            }}
          >
            刷新
          </Button>
        }
      />
    );
  }

  const channels = channelsQuery.data ?? [];
  const capabilities = capabilitiesQuery.data ?? [];
  const capabilityNameMap = new Map(
    capabilities.map((capability) => [capability.id, capability.name])
  );
  const canCreateChannel = capabilities.length > 0;
  const columns = createNotificationChannelColumns({
    capabilityNameMap,
    onEdit: setEditTarget,
    onDelete: setDeleteTarget
  });

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">通知通道</h1>
              <Badge variant="secondary">{channels.length}</Badge>
            </div>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={!canCreateChannel}
              title={
                canCreateChannel ? undefined : '当前没有已注册的通知能力'
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              新建通道
            </Button>
          </div>

          {!canCreateChannel ? (
            <EmptyState
              title="暂无可用通知能力"
              description="当前后端没有注册任何通知能力插件，暂时不能创建通道。"
              size="compact"
            />
          ) : null}

          <DataTable
            data={channels}
            columns={columns}
            emptyTitle="暂无通知通道"
            emptyDescription="创建通道后，系统会把匹配的内部通知消息投递给选中的通知能力。"
            emptyAction={
              canCreateChannel ? (
                <Button onClick={() => setCreateOpen(true)}>新建通道</Button>
              ) : undefined
            }
          />
        </div>
      </div>

      <NotificationChannelFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        scopeId={projectId}
        capabilities={capabilities}
      />

      {editTarget ? (
        <NotificationChannelFormDialog
          open
          onClose={() => setEditTarget(undefined)}
          scopeId={projectId}
          capabilities={capabilities}
          editing={editTarget}
        />
      ) : null}

      <NotificationChannelDeleteDialog
        open={deleteTarget !== undefined}
        channel={deleteTarget}
        scopeId={projectId}
        onClose={() => setDeleteTarget(undefined)}
      />
    </div>
  );
}
