import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GovernanceFindingStatus,
  GovernancePriority,
  GovernanceIssueStatus,
  GovernanceReviewQueueItemKind,
  type Finding,
  type GovernanceIssueSummary,
  type GovernanceReviewQueueItem
} from '@agent-workbench/shared';

import { EmptyState } from '@/components/app/EmptyState';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { GovernanceChangeUnitSummaryList } from '@/features/governance/components/GovernanceChangeUnitSummaryList';
import { GovernanceDeliveryArtifactSummaryList } from '@/features/governance/components/GovernanceDeliveryArtifactSummaryList';
import { GovernanceOrchestrationBoard } from '@/features/governance/components/GovernanceOrchestrationBoard';
import { GovernancePolicyPanel } from '@/features/governance/components/GovernancePolicyPanel';
import {
  useGovernanceRefreshRepositoryProfileMutation,
  useGovernanceRunDiscoveryMutation,
  useGovernanceUpdatePolicyMutation
} from '@/features/governance/hooks/use-governance-mutations';
import {
  useGovernanceChangeUnitList,
  useGovernanceDeliveryArtifactList,
  useGovernanceFindingList,
  useGovernanceIssueList,
  useGovernancePolicy,
  useGovernanceReviewQueue,
  useGovernanceRunnerList,
  useGovernanceScopeOverview
} from '@/features/governance/hooks/use-governance-queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import {
  buildProjectResourcesPath,
  buildProjectReviewsPath
} from '@/types/projects';

import { useProjectPageData } from './use-project-page-data';

const ISSUE_STATUS_ORDER: Record<GovernanceIssueStatus, number> = {
  [GovernanceIssueStatus.Open]: 0,
  [GovernanceIssueStatus.Blocked]: 1,
  [GovernanceIssueStatus.InProgress]: 2,
  [GovernanceIssueStatus.InReview]: 3,
  [GovernanceIssueStatus.Planned]: 4,
  [GovernanceIssueStatus.IntegrationFailed]: 5,
  [GovernanceIssueStatus.PartiallyResolved]: 6,
  [GovernanceIssueStatus.Resolved]: 7,
  [GovernanceIssueStatus.Closed]: 8,
  [GovernanceIssueStatus.Deferred]: 9,
  [GovernanceIssueStatus.AcceptedRisk]: 10,
  [GovernanceIssueStatus.WontFix]: 11,
  [GovernanceIssueStatus.Duplicate]: 12
};

const PRIORITY_ORDER: Record<GovernancePriority, number> = {
  [GovernancePriority.P0]: 0,
  [GovernancePriority.P1]: 1,
  [GovernancePriority.P2]: 2,
  [GovernancePriority.P3]: 3
};

export function ProjectGovernancePage() {
  const navigate = useNavigate();
  const { id: projectId, issueId } = useParams<{
    id: string;
    issueId?: string;
  }>();
  const handleError = useErrorMessage();
  const {
    project,
    projects,
    isLoading: isProjectLoading,
    isNotFound,
    goToProjects
  } = useProjectPageData();
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const overviewQuery = useGovernanceScopeOverview(projectId);
  const reviewQueueQuery = useGovernanceReviewQueue(projectId);
  const findingsQuery = useGovernanceFindingList(
    projectId,
    GovernanceFindingStatus.Pending
  );
  const issuesQuery = useGovernanceIssueList(projectId);
  const policyQuery = useGovernancePolicy(projectId);
  const runnerListQuery = useGovernanceRunnerList();
  const changeUnitsQuery = useGovernanceChangeUnitList(projectId);
  const deliveryArtifactsQuery = useGovernanceDeliveryArtifactList(projectId);
  const refreshProfileMutation = useGovernanceRefreshRepositoryProfileMutation(
    projectId ?? ''
  );
  const discoveryMutation = useGovernanceRunDiscoveryMutation(projectId ?? '');
  const updatePolicyMutation = useGovernanceUpdatePolicyMutation(projectId ?? '');

  const issues = useMemo(
    () => [...(issuesQuery.data ?? [])].sort(compareGovernanceIssues),
    [issuesQuery.data]
  );
  const reviewQueue = useMemo(
    () =>
      [...(reviewQueueQuery.data ?? [])].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      ),
    [reviewQueueQuery.data]
  );
  const pendingFindings = useMemo(
    () =>
      [...(findingsQuery.data ?? [])].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      ),
    [findingsQuery.data]
  );

  useEffect(() => {
    if (projectId && issueId) {
      void navigate(buildProjectResourcesPath(projectId, issueId), {
        replace: true
      });
    }
  }, [issueId, navigate, projectId]);

  useEffect(() => {
    if (overviewQuery.error) {
      handleError(overviewQuery.error, { context: '加载治理概览失败' });
    }
  }, [handleError, overviewQuery.error]);

  useEffect(() => {
    if (policyQuery.error) {
      handleError(policyQuery.error, { context: '加载治理策略失败' });
    }
  }, [handleError, policyQuery.error]);

  useEffect(() => {
    if (reviewQueueQuery.error) {
      handleError(reviewQueueQuery.error, { context: '加载治理审核队列失败' });
    }
  }, [handleError, reviewQueueQuery.error]);

  useEffect(() => {
    if (findingsQuery.error) {
      handleError(findingsQuery.error, { context: '加载待归并 findings 失败' });
    }
  }, [findingsQuery.error, handleError]);

  useEffect(() => {
    if (issuesQuery.error) {
      handleError(issuesQuery.error, { context: '加载治理 backlog 失败' });
    }
  }, [handleError, issuesQuery.error]);

  useEffect(() => {
    if (changeUnitsQuery.error) {
      handleError(changeUnitsQuery.error, { context: '加载 change units 失败' });
    }
  }, [changeUnitsQuery.error, handleError]);

  useEffect(() => {
    if (deliveryArtifactsQuery.error) {
      handleError(deliveryArtifactsQuery.error, {
        context: '加载 delivery artifacts 失败'
      });
    }
  }, [deliveryArtifactsQuery.error, handleError]);

  useEffect(() => {
    if (runnerListQuery.error) {
      handleError(runnerListQuery.error, { context: '加载 Agent Runners 失败' });
    }
  }, [handleError, runnerListQuery.error]);

  if (isProjectLoading) {
    return <div className="p-8" />;
  }

  if (isNotFound) {
    return (
      <div className="flex min-h-full flex-col px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-5xl">
          <SurfaceCard className="py-10">
            <EmptyState
              title="Project 不存在"
              description="当前 Project 不存在或已被删除。"
              action={
                <button
                  type="button"
                  className="text-sm font-medium text-primary"
                  onClick={goToProjects}
                >
                  返回 Projects
                </button>
              }
            />
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (!projectId || !project || projects.length === 0) {
    return (
      <div className="flex min-h-full flex-col px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-5xl">
          <SurfaceCard className="py-10">
            <EmptyState
              title="暂无可用 Project"
              description="请先回到 Project 列表创建或选择一个 Project。"
              action={
                <button
                  type="button"
                  className="text-sm font-medium text-primary"
                  onClick={goToProjects}
                >
                  返回 Projects
                </button>
              }
            />
          </SurfaceCard>
        </div>
      </div>
    );
  }

  return (
    <Sheet open={isPolicyOpen} onOpenChange={setIsPolicyOpen}>
      <div className="flex h-full min-h-0 flex-col bg-muted/10">
        <header className="border-b border-border/60 bg-background">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <h1 className="text-[24px] font-semibold leading-tight text-foreground">
                  治理工作流
                </h1>
                <Badge variant="outline" className="truncate">
                  {project.name}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void navigate(buildProjectResourcesPath(projectId))}
                >
                  资源
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void navigate(buildProjectReviewsPath(projectId))}
                >
                  审核队列
                  {reviewQueue.length > 0 ? (
                    <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                      {reviewQueue.length}
                    </span>
                  ) : null}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={refreshProfileMutation.isPending}
                  onClick={() => {
                    void refreshProfileMutation.mutateAsync().catch((error) => {
                      handleError(error, { context: '刷新 repository profile 失败' });
                    });
                  }}
                >
                  刷新仓库画像
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={discoveryMutation.isPending}
                  onClick={() => {
                    void discoveryMutation.mutateAsync().catch((error) => {
                      handleError(error, { context: '执行 discovery 失败' });
                    });
                  }}
                >
                  {discoveryMutation.isPending ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : null}
                  运行 Discovery
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsPolicyOpen(true)}
                >
                  <SlidersHorizontal className="mr-1.5 size-4" />
                  策略设置
                </Button>
              </div>
            </div>

            <GovernanceOrchestrationBoard
              scopeId={projectId}
              projectName={project.name}
              overview={overviewQuery.data}
              reviewQueue={reviewQueue}
              findings={pendingFindings}
              issues={issues}
              changeUnits={changeUnitsQuery.data ?? []}
              deliveryArtifacts={deliveryArtifactsQuery.data ?? []}
            />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 py-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <SignalPanel
              title="审核队列"
              actionLabel="查看全部"
              onAction={() => void navigate(buildProjectReviewsPath(projectId))}
            >
              <ReviewQueueSummaryList
                items={reviewQueue.slice(0, 5)}
                onSelectIssue={(nextIssueId) =>
                  void navigate(buildProjectResourcesPath(projectId, nextIssueId))
                }
                onOpenQueue={() => void navigate(buildProjectReviewsPath(projectId))}
              />
            </SignalPanel>

            <SignalPanel
              title="待归并发现"
              actionLabel="打开资源"
              onAction={() => void navigate(buildProjectResourcesPath(projectId))}
            >
              <PendingFindingList
                findings={pendingFindings.slice(0, 5)}
                onOpenResources={() =>
                  void navigate(buildProjectResourcesPath(projectId))
                }
              />
            </SignalPanel>

            <SignalPanel
              title="最近 Change Unit"
              actionLabel="资源"
              onAction={() => void navigate(buildProjectResourcesPath(projectId))}
            >
              <GovernanceChangeUnitSummaryList
                changeUnits={changeUnitsQuery.data?.slice(0, 5) ?? []}
                onSelectIssue={(nextIssueId) =>
                  void navigate(buildProjectResourcesPath(projectId, nextIssueId))
                }
              />
            </SignalPanel>

            <SignalPanel
              title="最近 Delivery Artifact"
              actionLabel="资源"
              onAction={() => void navigate(buildProjectResourcesPath(projectId))}
            >
              <GovernanceDeliveryArtifactSummaryList
                artifacts={deliveryArtifactsQuery.data?.slice(0, 5) ?? []}
                onSelectIssue={(nextIssueId) =>
                  void navigate(buildProjectResourcesPath(projectId, nextIssueId))
                }
              />
            </SignalPanel>
          </div>
        </main>
      </div>

      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>治理策略</SheetTitle>
          <SheetDescription>
            Runner 选择以及 priority、auto-action、delivery 策略统一维护在这里。
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <GovernancePolicyPanel
            policy={policyQuery.data}
            runners={runnerListQuery.data ?? []}
            isLoading={policyQuery.isLoading}
            isPending={updatePolicyMutation.isPending}
            onSubmit={async (payload) => {
              await updatePolicyMutation.mutateAsync(payload);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SignalPanel({
  title,
  actionLabel,
  onAction,
  children
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <SurfaceCard className="overflow-hidden p-0 shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
      <div className="p-3">{children}</div>
    </SurfaceCard>
  );
}

function ReviewQueueSummaryList({
  items,
  onSelectIssue,
  onOpenQueue
}: {
  items: GovernanceReviewQueueItem[];
  onSelectIssue: (issueId: string) => void;
  onOpenQueue: () => void;
}) {
  if (items.length === 0) {
    return <InlineHint text="当前没有待审核项。" />;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={`${item.kind}:${item.subjectId}`}
          type="button"
          className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-3 text-left transition hover:bg-muted/20"
          onClick={() => {
            if (item.issueId) {
              onSelectIssue(item.issueId);
              return;
            }
            onOpenQueue();
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{getQueueItemLabel(item.kind)}</Badge>
              {item.issueId ? <Badge variant="outline">Issue</Badge> : null}
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-foreground">
              {item.title}
            </p>
            <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
              {item.failureMessage ?? item.status}
            </p>
          </div>
          <div className="shrink-0 pt-1 text-[11px] text-muted-foreground">
            {formatTimestamp(item.updatedAt)}
          </div>
        </button>
      ))}
    </div>
  );
}

function PendingFindingList({
  findings,
  onOpenResources
}: {
  findings: Finding[];
  onOpenResources: () => void;
}) {
  if (findings.length === 0) {
    return <InlineHint text="当前没有待归并发现。" />;
  }

  return (
    <div className="space-y-2">
      {findings.map((finding) => (
        <button
          key={finding.id}
          type="button"
          className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-3 text-left transition hover:bg-muted/20"
          onClick={onOpenResources}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Finding</Badge>
              <Badge variant="outline">
                {finding.latestTriageAttempt?.status ?? finding.status}
              </Badge>
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-foreground">
              {finding.title}
            </p>
            <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
              {finding.summary}
            </p>
          </div>
          <div className="shrink-0 pt-1 text-[11px] text-muted-foreground">
            {formatTimestamp(finding.updatedAt)}
          </div>
        </button>
      ))}
    </div>
  );
}

function InlineHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-4">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function compareGovernanceIssues(
  left: GovernanceIssueSummary,
  right: GovernanceIssueSummary
) {
  const leftStatusRank = ISSUE_STATUS_ORDER[left.status] ?? Number.MAX_SAFE_INTEGER;
  const rightStatusRank =
    ISSUE_STATUS_ORDER[right.status] ?? Number.MAX_SAFE_INTEGER;
  if (leftStatusRank !== rightStatusRank) {
    return leftStatusRank - rightStatusRank;
  }

  const leftPriority =
    left.latestAssessment?.priority && left.latestAssessment.priority in PRIORITY_ORDER
      ? PRIORITY_ORDER[left.latestAssessment.priority]
      : Number.MAX_SAFE_INTEGER;
  const rightPriority =
    right.latestAssessment?.priority && right.latestAssessment.priority in PRIORITY_ORDER
      ? PRIORITY_ORDER[right.latestAssessment.priority]
      : Number.MAX_SAFE_INTEGER;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
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
