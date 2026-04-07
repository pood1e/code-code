import { useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  GovernanceExecutionAttemptStatus,
  GovernanceFindingStatus,
  GovernanceIssueStatus,
  GovernancePriority,
  GovernanceReviewQueueItemKind,
  type ChangeUnit,
  type Finding,
  type GovernanceExecutionAttemptSummary,
  type GovernanceIssueSummary,
  type GovernanceScopeOverview
} from '@agent-workbench/shared';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GovernanceOrchestrationBoard } from '@/features/governance/components/GovernanceOrchestrationBoard';
import { useGovernanceRunDiscoveryMutation } from '@/features/governance/hooks/use-governance-mutations';
import {
  useGovernanceChangeUnitList,
  useGovernanceDeliveryArtifactList,
  useGovernanceFindingList,
  useGovernanceIssueList,
  useGovernanceReviewQueue,
  useGovernanceScopeOverview
} from '@/features/governance/hooks/use-governance-queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import {
  buildProjectGovernancePath,
  buildProjectResourcesPath,
  buildProjectReviewsPath
} from '@/types/projects';

import { useProjectPageData } from './use-project-page-data';

const ACTIVE_ATTEMPT_STATUSES = new Set<GovernanceExecutionAttemptStatus>([
  GovernanceExecutionAttemptStatus.Running,
  GovernanceExecutionAttemptStatus.WaitingRepair
]);

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

export function ProjectDashboardPage() {
  const navigate = useNavigate();
  const handleError = useErrorMessage();
  const {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects
  } = useProjectPageData();
  const overviewQuery = useGovernanceScopeOverview(id);
  const reviewQueueQuery = useGovernanceReviewQueue(id);
  const findingsQuery = useGovernanceFindingList(id, GovernanceFindingStatus.Pending);
  const issuesQuery = useGovernanceIssueList(id);
  const changeUnitsQuery = useGovernanceChangeUnitList(id);
  const deliveryArtifactsQuery = useGovernanceDeliveryArtifactList(id);
  const discoveryMutation = useGovernanceRunDiscoveryMutation(id ?? '');

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
  const activeAgentCount = useMemo(
    () =>
      countActiveGovernanceAgents({
        overview: overviewQuery.data,
        findings: findingsQuery.data ?? [],
        issues,
        changeUnits: changeUnitsQuery.data ?? []
      }),
    [changeUnitsQuery.data, findingsQuery.data, issues, overviewQuery.data]
  );
  const openIssueCount = useMemo(
    () => issues.filter((issue) => issue.status === GovernanceIssueStatus.Open).length,
    [issues]
  );

  useEffect(() => {
    if (overviewQuery.error) {
      handleError(overviewQuery.error, { context: '加载治理概览失败' });
    }
  }, [handleError, overviewQuery.error]);

  useEffect(() => {
    if (reviewQueueQuery.error) {
      handleError(reviewQueueQuery.error, { context: '加载审核队列失败' });
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

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (isNotFound) {
    return (
      <EmptyState
        title="Project 不存在"
        description="当前 Project 不存在或已被删除。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  if (!id || !project || projects.length === 0) {
    return (
      <EmptyState
        title="暂无可用 Project"
        description="请先回到 Project 列表创建或选择一个 Project。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">治理概览</h1>
            <Badge variant="outline">{project.name}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void navigate(buildProjectGovernancePath(id))}
            >
              治理工作流
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void navigate(buildProjectReviewsPath(id))}
            >
              审核队列
            </Button>
            <Button
              type="button"
              variant="outline"
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
          </div>
        </header>

        <OverviewStatStrip
          items={[
            {
              label: '待审核',
              value: String(reviewQueue.length),
              tone: reviewQueue.length > 0 ? 'attention' : 'default'
            },
            {
              label: 'Open Issue',
              value: String(openIssueCount),
              tone: 'default'
            },
            {
              label: '待归并发现',
              value: String(findingsQuery.data?.length ?? 0),
              tone:
                (findingsQuery.data?.length ?? 0) > 0 ? 'queued' : 'default'
            },
            {
              label: '运行中',
              value: String(activeAgentCount),
              tone: activeAgentCount > 0 ? 'running' : 'default'
            }
          ]}
        />

        <GovernanceOrchestrationBoard
          scopeId={id}
          projectName={project.name}
          overview={overviewQuery.data}
          reviewQueue={reviewQueue}
          findings={findingsQuery.data ?? []}
          issues={issues}
          changeUnits={changeUnitsQuery.data ?? []}
          deliveryArtifacts={deliveryArtifactsQuery.data ?? []}
          mode="summary"
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <SurfaceCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
              <h2 className="text-base font-semibold text-foreground">
                优先处理的 Issue
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void navigate(buildProjectResourcesPath(id))}
              >
                查看全部
              </Button>
            </div>

            {issues.length > 0 ? (
              <div className="divide-y divide-border/60">
                {issues.slice(0, 5).map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() =>
                      void navigate(buildProjectResourcesPath(id, issue.id))
                    }
                    className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {issue.latestAssessment?.priority ? (
                          <Badge variant="secondary">
                            {issue.latestAssessment.priority}
                          </Badge>
                        ) : null}
                        <Badge variant="outline">{issue.status}</Badge>
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-foreground">
                        {issue.title}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                        {issue.impactSummary || issue.statement}
                      </p>
                    </div>
                    <div className="shrink-0 pt-1 text-[11px] text-muted-foreground">
                      {formatTimestamp(issue.updatedAt)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <InlineEmptyState
                title="当前没有治理 Issue"
                actionLabel="打开资源"
                onAction={() => void navigate(buildProjectResourcesPath(id))}
              />
            )}
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
              <h2 className="text-base font-semibold text-foreground">
                待处理审核项
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void navigate(buildProjectReviewsPath(id))}
              >
                查看全部
              </Button>
            </div>

            {reviewQueue.length > 0 ? (
              <div className="divide-y divide-border/60">
                {reviewQueue.slice(0, 4).map((item) => (
                  <button
                    key={`${item.kind}:${item.subjectId}`}
                    type="button"
                    onClick={() => {
                      if (item.issueId) {
                        void navigate(buildProjectResourcesPath(id, item.issueId));
                        return;
                      }
                      void navigate(buildProjectReviewsPath(id));
                    }}
                    className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {getQueueItemLabel(item.kind)}
                        </Badge>
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
            ) : (
              <InlineEmptyState
                title="当前没有待审核项"
                actionLabel="打开审核队列"
                onAction={() => void navigate(buildProjectReviewsPath(id))}
              />
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

function OverviewStatStrip({
  items
}: {
  items: Array<{
    label: string;
    value: string;
    tone: 'default' | 'attention' | 'queued' | 'running';
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="grid divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="px-4 py-4">
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className={getStatValueClassName(item.tone)}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InlineEmptyState({
  title,
  actionLabel,
  onAction
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <Button type="button" variant="ghost" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

function getStatValueClassName(tone: 'default' | 'attention' | 'queued' | 'running') {
  switch (tone) {
    case 'attention':
      return 'mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300';
    case 'queued':
      return 'mt-2 text-2xl font-semibold text-violet-700 dark:text-violet-300';
    case 'running':
      return 'mt-2 text-2xl font-semibold text-sky-700 dark:text-sky-300';
    case 'default':
      return 'mt-2 text-2xl font-semibold text-foreground';
  }
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

function countActiveGovernanceAgents(input: {
  overview?: GovernanceScopeOverview;
  findings: Finding[];
  issues: GovernanceIssueSummary[];
  changeUnits: ChangeUnit[];
}) {
  const activeAttempts: GovernanceExecutionAttemptSummary[] = [];

  if (isActiveAttempt(input.overview?.latestBaselineAttempt)) {
    activeAttempts.push(input.overview.latestBaselineAttempt);
  }
  if (isActiveAttempt(input.overview?.latestDiscoveryAttempt)) {
    activeAttempts.push(input.overview.latestDiscoveryAttempt);
  }

  for (const finding of input.findings) {
    if (isActiveAttempt(finding.latestTriageAttempt)) {
      activeAttempts.push(finding.latestTriageAttempt);
    }
  }

  for (const issue of input.issues) {
    if (isActiveAttempt(issue.latestPlanningAttempt)) {
      activeAttempts.push(issue.latestPlanningAttempt);
    }
  }

  for (const changeUnit of input.changeUnits) {
    if (isActiveAttempt(changeUnit.latestExecutionAttempt)) {
      activeAttempts.push(changeUnit.latestExecutionAttempt);
    }
  }

  return activeAttempts.length;
}

function isActiveAttempt(
  attempt: GovernanceExecutionAttemptSummary | null | undefined
): attempt is GovernanceExecutionAttemptSummary {
  return Boolean(attempt && ACTIVE_ATTEMPT_STATUSES.has(attempt.status));
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
