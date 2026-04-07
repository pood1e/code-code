import { type ReactNode, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import {
  GovernanceReviewQueueItemKind,
  type GovernanceReviewQueueItem
} from '@agent-workbench/shared';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GovernanceSessionHistorySheet } from '@/features/governance/components/GovernanceSessionHistorySheet';
import { useErrorMessage } from '@/hooks/use-error-message';
import {
  useGovernanceRetryBaselineMutation,
  useGovernanceRetryDiscoveryMutation,
  useGovernanceRetryPlanningQueueMutation,
  useGovernanceRetryTriageMutation
} from '@/features/governance/hooks/use-governance-mutations';
import { useGovernanceReviewQueue } from '@/features/governance/hooks/use-governance-queries';
import { buildProjectGovernancePath } from '@/types/projects';

import { useProjectPageData } from './use-project-page-data';

const REVIEWABLE_KINDS = new Set<GovernanceReviewQueueItemKind>([
  GovernanceReviewQueueItemKind.Baseline,
  GovernanceReviewQueueItemKind.Discovery,
  GovernanceReviewQueueItemKind.Triage,
  GovernanceReviewQueueItemKind.Planning
]);

export function ProjectReviewsPage() {
  const navigate = useNavigate();
  const handleError = useErrorMessage();
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

  const items = reviewQueueQuery.data ?? [];

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">审核队列</h1>
              <Badge variant="secondary">{items.length}</Badge>
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

          {items.length === 0 ? (
            <SurfaceCard className="py-10">
              <EmptyState
                title="当前没有待审核项"
                description="baseline、discovery、triage、planning 和人工处理项会集中显示在这里。"
              />
            </SurfaceCard>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <ReviewQueueItemCard
                  key={`${item.kind}:${item.subjectId}`}
                  item={item}
                  isPending={isItemPending({
                    item,
                    retryBaselineMutation,
                    retryDiscoveryMutation,
                    retryTriageMutation,
                    retryPlanningMutation
                  })}
                  onRetry={async () => {
                    try {
                      await retryQueueItem({
                        item,
                        retryBaseline: () => retryBaselineMutation.mutateAsync(),
                        retryDiscovery: () =>
                          retryDiscoveryMutation.mutateAsync(),
                        retryTriage: () =>
                          retryTriageMutation.mutateAsync(item.subjectId),
                        retryPlanning: () =>
                          retryPlanningMutation.mutateAsync(item.subjectId)
                      });
                    } catch (error) {
                      handleError(error, { context: `重试${getQueueItemLabel(item.kind)}失败` });
                    }
                  }}
                  onOpenIssue={() => {
                    if (!item.issueId) {
                      return;
                    }
                    void navigate(buildProjectGovernancePath(projectId, item.issueId));
                  }}
                  sessionLogAction={
                    <GovernanceSessionHistorySheet
                      scopeId={projectId}
                      sessionId={item.sessionId}
                      title={`${item.title} · Agent 日志`}
                      description="直接复用会话历史组件查看当前治理项的执行记录。"
                    />
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewQueueItemCard({
  item,
  isPending,
  onRetry,
  onOpenIssue,
  sessionLogAction
}: {
  item: GovernanceReviewQueueItem;
  isPending: boolean;
  onRetry: () => void;
  onOpenIssue: () => void;
  sessionLogAction?: ReactNode;
}) {
  return (
    <SurfaceCard className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{getQueueItemLabel(item.kind)}</Badge>
            <Badge variant="secondary">{item.status}</Badge>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
            {item.failureMessage ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {item.failureMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sessionLogAction}
          {REVIEWABLE_KINDS.has(item.kind) ? (
            <Button type="button" size="sm" disabled={isPending} onClick={onRetry}>
              {isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-4 w-4" />
              )}
              重试
            </Button>
          ) : null}
          {item.issueId ? (
            <Button type="button" size="sm" variant="outline" onClick={onOpenIssue}>
              打开 Issue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide">Subject</dt>
          <dd className="mt-1 font-mono text-xs">{item.subjectId}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide">Session</dt>
          <dd className="mt-1 font-mono text-xs">{item.sessionId ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide">Updated</dt>
          <dd className="mt-1 text-xs">
            {new Date(item.updatedAt).toLocaleString('zh-CN')}
          </dd>
        </div>
      </dl>

      {item.failureCode ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <div>
            <p className="font-medium">{item.failureCode}</p>
            {item.failureMessage ? <p className="text-xs">{item.failureMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
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
