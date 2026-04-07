import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GovernanceExecutionAttemptStatus,
  GovernanceFindingStatus,
  GovernanceIssueStatus,
  GovernancePriority,
  type ChangeUnit,
  type DeliveryArtifact,
  type Finding,
  type GovernanceIssueSummary
} from '@agent-workbench/shared';

import { EmptyState } from '@/components/app/EmptyState';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { GovernanceChangeUnitSummaryList } from '@/features/governance/components/GovernanceChangeUnitSummaryList';
import { GovernanceDeliveryArtifactSummaryList } from '@/features/governance/components/GovernanceDeliveryArtifactSummaryList';
import { GovernanceIssueDetail } from '@/features/governance/components/GovernanceIssueDetail';
import { GovernanceIssueList } from '@/features/governance/components/GovernanceIssueList';
import {
  useGovernanceRetryTriageMutation
} from '@/features/governance/hooks/use-governance-mutations';
import {
  useGovernanceChangeUnitList,
  useGovernanceDeliveryArtifactList,
  useGovernanceFindingList,
  useGovernanceIssueDetail,
  useGovernanceIssueList,
  useGovernancePolicy,
  useGovernanceReviewQueue
} from '@/features/governance/hooks/use-governance-queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import {
  buildProjectGovernancePath,
  buildProjectResourcesPath,
  buildProjectReviewsPath
} from '@/types/projects';

import { useProjectPageData } from './use-project-page-data';

const STATUS_OPTIONS: Array<{ label: string; value: GovernanceIssueStatus | 'all' }> = [
  { label: '全部状态', value: 'all' },
  { label: '开放', value: GovernanceIssueStatus.Open },
  { label: '进行中', value: GovernanceIssueStatus.InProgress },
  { label: '待评审', value: GovernanceIssueStatus.InReview },
  { label: '受阻', value: GovernanceIssueStatus.Blocked },
  { label: '已规划', value: GovernanceIssueStatus.Planned },
  { label: '集成失败', value: GovernanceIssueStatus.IntegrationFailed },
  { label: '部分完成', value: GovernanceIssueStatus.PartiallyResolved },
  { label: '已解决', value: GovernanceIssueStatus.Resolved },
  { label: '已关闭', value: GovernanceIssueStatus.Closed },
  { label: '已延期', value: GovernanceIssueStatus.Deferred },
  { label: '接受风险', value: GovernanceIssueStatus.AcceptedRisk },
  { label: '不修复', value: GovernanceIssueStatus.WontFix },
  { label: '重复项', value: GovernanceIssueStatus.Duplicate }
];

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

export function ProjectResourcesPage() {
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
  const [status, setStatus] = useState<GovernanceIssueStatus | 'all'>('all');
  const [searchValue, setSearchValue] = useState('');
  const deferredSearchValue = useDeferredValue(searchValue.trim().toLowerCase());
  const findingsQuery = useGovernanceFindingList(
    projectId,
    GovernanceFindingStatus.Pending
  );
  const reviewQueueQuery = useGovernanceReviewQueue(projectId);
  const policyQuery = useGovernancePolicy(projectId);
  const changeUnitsQuery = useGovernanceChangeUnitList(projectId);
  const deliveryArtifactsQuery = useGovernanceDeliveryArtifactList(projectId);
  const listQuery = useGovernanceIssueList(
    projectId,
    status === 'all' ? undefined : status
  );
  const detailQuery = useGovernanceIssueDetail(issueId ?? null);
  const retryTriageMutation = useGovernanceRetryTriageMutation(projectId ?? '');

  const issues = useMemo(
    () => [...(listQuery.data ?? [])].sort(compareGovernanceIssues),
    [listQuery.data]
  );
  const pendingFindings = useMemo(
    () => findingsQuery.data ?? [],
    [findingsQuery.data]
  );
  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => matchesIssueSearch(issue, deferredSearchValue)),
    [deferredSearchValue, issues]
  );
  const selectedIssueExists = useMemo(
    () => (issueId ? filteredIssues.some((issue) => issue.id === issueId) : false),
    [filteredIssues, issueId]
  );
  const selectedStatusLabel = useMemo(
    () =>
      STATUS_OPTIONS.find((option) => option.value === status)?.label ??
      '全部状态',
    [status]
  );

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
    if (listQuery.error) {
      handleError(listQuery.error, { context: '加载治理 backlog 失败' });
    }
  }, [handleError, listQuery.error]);

  useEffect(() => {
    if (detailQuery.error) {
      handleError(detailQuery.error, { context: '加载 issue 详情失败' });
    }
  }, [detailQuery.error, handleError]);

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
    if (!projectId) {
      return;
    }

    if (filteredIssues.length === 0) {
      if (issueId) {
        void navigate(buildProjectResourcesPath(projectId), { replace: true });
      }
      return;
    }

    if (issueId && selectedIssueExists) {
      return;
    }

    const firstFilteredIssue = filteredIssues[0];
    if (!firstFilteredIssue) {
      return;
    }

    void navigate(buildProjectResourcesPath(projectId, firstFilteredIssue.id), {
      replace: true
    });
  }, [filteredIssues, issueId, navigate, projectId, selectedIssueExists]);

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
    <div className="flex h-full min-h-0 flex-col bg-muted/10">
      <header className="border-b border-border/60 bg-background">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-[24px] font-semibold leading-tight text-foreground">
              资源
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
              onClick={() => void navigate(buildProjectGovernancePath(projectId))}
            >
              治理工作流
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void navigate(buildProjectReviewsPath(projectId))}
            >
              审核队列
              {(reviewQueueQuery.data?.length ?? 0) > 0 ? (
                <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                  {reviewQueueQuery.data?.length ?? 0}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[388px] shrink-0 flex-col border-r border-border/60 bg-background/95">
          <div className="space-y-4 border-b border-border/60 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Issue</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedStatusLabel} · {filteredIssues.length} 项
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="搜索 title、summary、target"
                  className="h-10 rounded-xl border-border/70 bg-background/70 pl-10"
                />
              </div>

              <NativeSelect
                id="resource-status-filter"
                aria-label="资源状态过滤"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as GovernanceIssueStatus | 'all')
                }
                className="w-[132px] shrink-0"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {pendingFindings.length > 0 ? (
              <section className="border-b border-border/60 px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    待归并发现
                  </h3>
                  <Badge variant="secondary">{pendingFindings.length}</Badge>
                </div>
                <div className="space-y-2">
                  {pendingFindings.slice(0, 4).map((finding) => (
                    <CompactFindingCard
                      key={finding.id}
                      finding={finding}
                      isRetrying={retryTriageMutation.variables === finding.id}
                      onRetry={() => {
                        void retryTriageMutation
                          .mutateAsync(finding.id)
                          .catch((error) => {
                            handleError(error, { context: '重试 triage 失败' });
                          });
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="px-0 py-2">
              {listQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredIssues.length > 0 ? (
                <GovernanceIssueList
                  issues={filteredIssues}
                  selectedId={issueId ?? null}
                  onSelect={(nextIssueId) =>
                    void navigate(buildProjectResourcesPath(projectId, nextIssueId))
                  }
                />
              ) : (
                <div className="px-4 py-6">
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5">
                    <p className="text-sm font-semibold text-foreground">
                      没有匹配的 Issue
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {issueId ? (
            <GovernanceIssueDetail
              scopeId={projectId}
              issueId={issueId}
              issue={detailQuery.data}
              isLoading={detailQuery.isLoading}
              policy={policyQuery.data}
              selectedStatus={status === 'all' ? undefined : status}
            />
          ) : (
            <ResourcesEmptyPanel
              reviewQueueCount={reviewQueueQuery.data?.length ?? 0}
              changeUnits={changeUnitsQuery.data?.slice(0, 6) ?? []}
              artifacts={deliveryArtifactsQuery.data?.slice(0, 6) ?? []}
              onSelectIssue={(nextIssueId) =>
                void navigate(buildProjectResourcesPath(projectId, nextIssueId))
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}

function CompactFindingCard({
  finding,
  isRetrying,
  onRetry
}: {
  finding: Finding;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  const canRetry =
    finding.latestTriageAttempt?.status ===
      GovernanceExecutionAttemptStatus.NeedsHumanReview ||
    finding.latestTriageAttempt?.status === GovernanceExecutionAttemptStatus.Failed;

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/10 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {finding.title}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {finding.summary}
          </p>
        </div>
        <Badge variant="outline">{finding.status}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>
          triage{' '}
          {finding.latestTriageAttempt?.status
            ? finding.latestTriageAttempt.status
            : 'pending'}
        </span>
        {finding.latestTriageAttempt?.sessionId ? (
          <span className="font-mono">{finding.latestTriageAttempt.sessionId}</span>
        ) : null}
      </div>
      {canRetry ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isRetrying}
            onClick={onRetry}
          >
            重试 triage
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ResourcesEmptyPanel({
  reviewQueueCount,
  changeUnits,
  artifacts,
  onSelectIssue
}: {
  reviewQueueCount: number;
  changeUnits: ChangeUnit[];
  artifacts: DeliveryArtifact[];
  onSelectIssue: (issueId: string) => void;
}) {
  return (
    <div className="flex h-full w-full flex-col px-5 py-4 sm:px-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SurfaceCard className="space-y-4 border-border/70 bg-card/80 shadow-none">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              当前没有可处理的 Issue
            </h3>
            {reviewQueueCount > 0 ? (
              <p className="text-sm text-muted-foreground">
                审核队列还有 {reviewQueueCount} 项待处理。
              </p>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-3 border-border/70 bg-card/80 shadow-none">
          <h3 className="text-sm font-semibold text-foreground">最近 Change Unit</h3>
          <GovernanceChangeUnitSummaryList
            changeUnits={changeUnits}
            onSelectIssue={onSelectIssue}
          />
        </SurfaceCard>

        <SurfaceCard className="space-y-3 border-border/70 bg-card/80 shadow-none xl:col-span-2">
          <h3 className="text-sm font-semibold text-foreground">
            最近 Delivery Artifact
          </h3>
          <GovernanceDeliveryArtifactSummaryList
            artifacts={artifacts}
            onSelectIssue={onSelectIssue}
          />
        </SurfaceCard>
      </div>
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

function matchesIssueSearch(issue: GovernanceIssueSummary, query: string) {
  if (query.length === 0) {
    return true;
  }

  const searchableText = [
    issue.title,
    issue.statement,
    issue.impactSummary,
    issue.kind,
    issue.status,
    issue.categories.join(' '),
    issue.tags.join(' '),
    issue.affectedTargets.map((target) => target.ref).join(' ')
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchableText.includes(query);
}
