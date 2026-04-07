import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowRight,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search
} from 'lucide-react';
import {
  GovernanceReviewQueueItemKind,
  type GovernanceReviewQueueItem
} from '@agent-workbench/shared';
import { useNavigate } from 'react-router-dom';

import { DataTable } from '@/components/app/DataTable';
import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { GovernanceSessionHistorySheet } from '@/features/governance/components/GovernanceSessionHistorySheet';
import { useErrorMessage } from '@/hooks/use-error-message';
import {
  useGovernanceRetryBaselineMutation,
  useGovernanceRetryDiscoveryMutation,
  useGovernanceRetryPlanningQueueMutation,
  useGovernanceRetryTriageMutation
} from '@/features/governance/hooks/use-governance-mutations';
import { useGovernanceReviewQueue } from '@/features/governance/hooks/use-governance-queries';
import { buildProjectResourcesPath } from '@/types/projects';

import { useProjectPageData } from './use-project-page-data';

const REVIEWABLE_KINDS = new Set<GovernanceReviewQueueItemKind>([
  GovernanceReviewQueueItemKind.Baseline,
  GovernanceReviewQueueItemKind.Discovery,
  GovernanceReviewQueueItemKind.Triage,
  GovernanceReviewQueueItemKind.Planning
]);

const KIND_OPTIONS: Array<{
  label: string;
  value: GovernanceReviewQueueItemKind | 'all';
}> = [
  { label: '全部类型', value: 'all' },
  { label: 'Baseline', value: GovernanceReviewQueueItemKind.Baseline },
  { label: 'Discovery', value: GovernanceReviewQueueItemKind.Discovery },
  { label: 'Triage', value: GovernanceReviewQueueItemKind.Triage },
  { label: 'Planning', value: GovernanceReviewQueueItemKind.Planning },
  { label: 'Change Unit', value: GovernanceReviewQueueItemKind.ChangeUnit },
  {
    label: 'Delivery Artifact',
    value: GovernanceReviewQueueItemKind.DeliveryArtifact
  }
];

export function ProjectReviewsPage() {
  const navigate = useNavigate();
  const handleError = useErrorMessage();
  const [searchValue, setSearchValue] = useState('');
  const [kindFilter, setKindFilter] = useState<GovernanceReviewQueueItemKind | 'all'>(
    'all'
  );
  const deferredSearchValue = useDeferredValue(searchValue.trim().toLowerCase());
  const {
    id: projectId,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects
  } = useProjectPageData();
  const reviewQueueQuery = useGovernanceReviewQueue(projectId);
  const retryBaselineMutation = useGovernanceRetryBaselineMutation(projectId ?? '');
  const retryDiscoveryMutation = useGovernanceRetryDiscoveryMutation(
    projectId ?? ''
  );
  const retryTriageMutation = useGovernanceRetryTriageMutation(projectId ?? '');
  const retryPlanningMutation = useGovernanceRetryPlanningQueueMutation(
    projectId ?? ''
  );

  useEffect(() => {
    if (reviewQueueQuery.error) {
      handleError(reviewQueueQuery.error, { context: '加载审核队列失败' });
    }
  }, [handleError, reviewQueueQuery.error]);

  const items = useMemo(
    () =>
      [...(reviewQueueQuery.data ?? [])]
        .filter((item) =>
          kindFilter === 'all' ? true : item.kind === kindFilter
        )
        .filter((item) => matchesReviewSearch(item, deferredSearchValue))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [deferredSearchValue, kindFilter, reviewQueueQuery.data]
  );

  const columns = useMemo<Array<ColumnDef<GovernanceReviewQueueItem>>>(
    () => [
      {
        header: '类型',
        accessorKey: 'kind',
        size: 120,
        cell: ({ row }) => (
          <Badge variant="secondary">{getQueueItemLabel(row.original.kind)}</Badge>
        )
      },
      {
        header: '标题',
        accessorKey: 'title',
        size: 320,
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.original.title}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{row.original.status}</span>
              <span className="text-border">•</span>
              <span className="font-mono">{row.original.subjectId}</span>
            </div>
          </div>
        )
      },
      {
        header: '阻塞原因',
        accessorKey: 'failureMessage',
        cell: ({ row }) => (
          <div className="space-y-1 text-sm">
            <p className="text-foreground">
              {row.original.failureMessage ?? '等待人工确认或继续推进。'}
            </p>
            {row.original.failureCode ? (
              <p className="text-xs font-medium text-amber-700">
                {row.original.failureCode}
              </p>
            ) : null}
          </div>
        )
      },
      {
        header: '更新时间',
        accessorKey: 'updatedAt',
        size: 170,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatTimestamp(row.original.updatedAt)}
          </span>
        )
      },
      {
        header: '关联 Issue',
        accessorKey: 'issueId',
        size: 140,
        cell: ({ row }) =>
          row.original.issueId ? (
            <button
              type="button"
              className="text-sm font-medium text-primary"
              onClick={() => {
                if (!projectId || !row.original.issueId) {
                  return;
                }
                void navigate(
                  buildProjectResourcesPath(projectId, row.original.issueId)
                );
              }}
            >
              {row.original.issueId}
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )
      },
      {
        header: '操作',
        id: 'actions',
        size: 260,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <OpenIssueButton
              canOpen={Boolean(row.original.issueId)}
              onOpen={() => {
                if (!projectId || !row.original.issueId) {
                  return;
                }
                void navigate(
                  buildProjectResourcesPath(projectId, row.original.issueId)
                );
              }}
            />
            <ReviewLogButton
              projectId={projectId}
              sessionId={row.original.sessionId}
              title={`${row.original.title} · Agent 日志`}
            />
            <RetryQueueButton
              canRetry={REVIEWABLE_KINDS.has(row.original.kind)}
              isPending={isItemPending({
                item: row.original,
                retryBaselineMutation,
                retryDiscoveryMutation,
                retryTriageMutation,
                retryPlanningMutation
              })}
              onRetry={() => {
                void retryQueueItem({
                  item: row.original,
                  retryBaseline: () => retryBaselineMutation.mutateAsync(),
                  retryDiscovery: () => retryDiscoveryMutation.mutateAsync(),
                  retryTriage: () =>
                    retryTriageMutation.mutateAsync(row.original.subjectId),
                  retryPlanning: () =>
                    retryPlanningMutation.mutateAsync(row.original.subjectId)
                }).catch((error) => {
                  handleError(error, {
                    context: `重试${getQueueItemLabel(row.original.kind)}失败`
                  });
                });
              }}
            />
          </div>
        )
      }
    ],
    [
      handleError,
      navigate,
      projectId,
      retryBaselineMutation,
      retryDiscoveryMutation,
      retryPlanningMutation,
      retryTriageMutation
    ]
  );

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (isNotFound) {
    return (
      <EmptyState
        title="Project 不存在"
        description="当前 Project 不存在或已被删除。"
        action={
          <Button onClick={goToProjects} variant="outline">
            返回 Projects
          </Button>
        }
      />
    );
  }

  if (!projectId || !project || projects.length === 0) {
    return (
      <EmptyState
        title="暂无可用 Project"
        description="请先回到 Project 列表创建或选择一个 Project。"
        action={
          <Button onClick={goToProjects} variant="outline">
            返回 Projects
          </Button>
        }
      />
    );
  }

  if (reviewQueueQuery.isLoading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <div className="flex min-h-full flex-col px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <SurfaceCard className="space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-xl font-semibold">审核队列</h1>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                按类型、失败原因和更新时间集中处理真正阻塞治理流程的项目。
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void reviewQueueQuery.refetch()}
              disabled={reviewQueueQuery.isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${
                  reviewQueueQuery.isFetching ? 'animate-spin' : ''
                }`}
              />
              刷新
            </Button>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="搜索标题、subject 或失败原因"
                className="h-9 rounded-xl pl-10"
              />
            </div>

            <div className="w-full lg:w-56">
              <NativeSelect
                aria-label="审核类型过滤"
                value={kindFilter}
                onChange={(event) =>
                  setKindFilter(
                    event.target.value as GovernanceReviewQueueItemKind | 'all'
                  )
                }
              >
                {KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </SurfaceCard>

        <DataTable
          columns={columns}
          data={items}
          isLoading={reviewQueueQuery.isFetching && !reviewQueueQuery.data}
          emptyTitle="当前没有待审核项"
          emptyDescription="调整过滤条件，或者等待 baseline、discovery、planning、delivery 产生新的人工处理项。"
          emptyAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void reviewQueueQuery.refetch()}
            >
              重新加载
            </Button>
          }
          mobileCardRenderer={(item) => (
            <ReviewQueueMobileCard
              item={item}
              projectId={projectId}
              isPending={isItemPending({
                item,
                retryBaselineMutation,
                retryDiscoveryMutation,
                retryTriageMutation,
                retryPlanningMutation
              })}
              onOpenIssue={() => {
                if (!item.issueId) {
                  return;
                }
                void navigate(buildProjectResourcesPath(projectId, item.issueId));
              }}
              onRetry={() => {
                void retryQueueItem({
                  item,
                  retryBaseline: () => retryBaselineMutation.mutateAsync(),
                  retryDiscovery: () => retryDiscoveryMutation.mutateAsync(),
                  retryTriage: () => retryTriageMutation.mutateAsync(item.subjectId),
                  retryPlanning: () =>
                    retryPlanningMutation.mutateAsync(item.subjectId)
                }).catch((error) => {
                  handleError(error, {
                    context: `重试${getQueueItemLabel(item.kind)}失败`
                  });
                });
              }}
            />
          )}
        />
      </div>
    </div>
  );
}

function ReviewQueueMobileCard({
  item,
  projectId,
  isPending,
  onOpenIssue,
  onRetry
}: {
  item: GovernanceReviewQueueItem;
  projectId: string;
  isPending: boolean;
  onOpenIssue: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{getQueueItemLabel(item.kind)}</Badge>
        <Badge variant="outline">{item.status}</Badge>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {item.failureMessage ?? '等待人工确认或继续推进。'}
        </p>
      </div>
      <div className="text-[11px] text-muted-foreground">
        <p>{formatTimestamp(item.updatedAt)}</p>
        <p className="font-mono">{item.subjectId}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <OpenIssueButton canOpen={Boolean(item.issueId)} onOpen={onOpenIssue} />
        <ReviewLogButton
          projectId={projectId}
          sessionId={item.sessionId}
          title={`${item.title} · Agent 日志`}
        />
        <RetryQueueButton
          canRetry={REVIEWABLE_KINDS.has(item.kind)}
          isPending={isPending}
          onRetry={onRetry}
        />
      </div>
    </div>
  );
}

function OpenIssueButton({
  canOpen,
  onOpen
}: {
  canOpen: boolean;
  onOpen: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!canOpen}
      onClick={onOpen}
    >
      打开 Issue
      <ArrowRight className="ml-1.5 size-4" />
    </Button>
  );
}

function ReviewLogButton({
  projectId,
  sessionId,
  title
}: {
  projectId: string | null | undefined;
  sessionId: string | null | undefined;
  title: string;
}) {
  if (!sessionId) {
    return (
      <Button type="button" size="sm" variant="outline" disabled>
        查看日志
      </Button>
    );
  }

  return (
    <GovernanceSessionHistorySheet
      scopeId={projectId ?? ''}
      sessionId={sessionId}
      title={title}
      description="直接复用会话历史组件查看当前治理项的执行记录。"
      triggerLabel="查看日志"
    />
  );
}

function RetryQueueButton({
  canRetry,
  isPending,
  onRetry
}: {
  canRetry: boolean;
  isPending: boolean;
  onRetry: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={canRetry ? 'default' : 'outline'}
      disabled={!canRetry || isPending}
      onClick={onRetry}
    >
      {isPending ? (
        <Loader2 className="mr-1.5 size-4 animate-spin" />
      ) : (
        <RotateCcw className="mr-1.5 size-4" />
      )}
      重试
    </Button>
  );
}

function matchesReviewSearch(item: GovernanceReviewQueueItem, query: string) {
  if (query.length === 0) {
    return true;
  }

  return [item.title, item.subjectId, item.failureCode, item.failureMessage, item.status]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function isItemPending(input: {
  item: GovernanceReviewQueueItem;
  retryBaselineMutation: { isPending: boolean };
  retryDiscoveryMutation: { isPending: boolean };
  retryTriageMutation: { isPending: boolean; variables?: string | null };
  retryPlanningMutation: { isPending: boolean; variables?: string | null };
}) {
  switch (input.item.kind) {
    case GovernanceReviewQueueItemKind.Baseline:
      return input.retryBaselineMutation.isPending;
    case GovernanceReviewQueueItemKind.Discovery:
      return input.retryDiscoveryMutation.isPending;
    case GovernanceReviewQueueItemKind.Triage:
      return (
        input.retryTriageMutation.isPending &&
        input.retryTriageMutation.variables === input.item.subjectId
      );
    case GovernanceReviewQueueItemKind.Planning:
      return (
        input.retryPlanningMutation.isPending &&
        input.retryPlanningMutation.variables === input.item.subjectId
      );
    default:
      return false;
  }
}

async function retryQueueItem(input: {
  item: GovernanceReviewQueueItem;
  retryBaseline: () => Promise<unknown>;
  retryDiscovery: () => Promise<unknown>;
  retryTriage: () => Promise<unknown>;
  retryPlanning: () => Promise<unknown>;
}) {
  switch (input.item.kind) {
    case GovernanceReviewQueueItemKind.Baseline:
      await input.retryBaseline();
      return;
    case GovernanceReviewQueueItemKind.Discovery:
      await input.retryDiscovery();
      return;
    case GovernanceReviewQueueItemKind.Triage:
      await input.retryTriage();
      return;
    case GovernanceReviewQueueItemKind.Planning:
      await input.retryPlanning();
      return;
    default:
      return;
  }
}

function getQueueItemLabel(kind: GovernanceReviewQueueItemKind) {
  switch (kind) {
    case GovernanceReviewQueueItemKind.Baseline:
      return 'Baseline';
    case GovernanceReviewQueueItemKind.Discovery:
      return 'Discovery';
    case GovernanceReviewQueueItemKind.Triage:
      return 'Triage';
    case GovernanceReviewQueueItemKind.Planning:
      return 'Planning';
    case GovernanceReviewQueueItemKind.ChangeUnit:
      return 'Change Unit';
    case GovernanceReviewQueueItemKind.DeliveryArtifact:
      return 'Delivery Artifact';
  }
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}
