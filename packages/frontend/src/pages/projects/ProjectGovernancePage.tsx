import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { GovernanceFindingStatus, GovernanceIssueStatus } from '@agent-workbench/shared';

import { EmptyState } from '@/components/app/EmptyState';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { GovernanceChangeUnitSummaryList } from '@/features/governance/components/GovernanceChangeUnitSummaryList';
import { GovernanceDeliveryArtifactSummaryList } from '@/features/governance/components/GovernanceDeliveryArtifactSummaryList';
import { GovernanceFindingList } from '@/features/governance/components/GovernanceFindingList';
import { GovernanceIssueDetail } from '@/features/governance/components/GovernanceIssueDetail';
import { GovernanceIssueList } from '@/features/governance/components/GovernanceIssueList';
import { GovernanceOrchestrationBoard } from '@/features/governance/components/GovernanceOrchestrationBoard';
import { GovernancePolicyPanel } from '@/features/governance/components/GovernancePolicyPanel';
import {
  useGovernanceRefreshRepositoryProfileMutation,
  useGovernanceRetryTriageMutation,
  useGovernanceRunDiscoveryMutation,
  useGovernanceUpdatePolicyMutation
} from '@/features/governance/hooks/use-governance-mutations';
import {
  useGovernanceChangeUnitList,
  useGovernanceDeliveryArtifactList,
  useGovernanceFindingList,
  useGovernanceIssueDetail,
  useGovernanceIssueList,
  useGovernancePolicy,
  useGovernanceReviewQueue,
  useGovernanceRunnerList,
  useGovernanceScopeOverview
} from '@/features/governance/hooks/use-governance-queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { buildProjectGovernancePath } from '@/types/projects';

import { useProjectPageData } from './use-project-page-data';

const STATUS_OPTIONS: Array<{ label: string; value: GovernanceIssueStatus | 'all' }> = [
  { label: '全部状态', value: 'all' },
  { label: 'open', value: GovernanceIssueStatus.Open },
  { label: 'planned', value: GovernanceIssueStatus.Planned },
  { label: 'deferred', value: GovernanceIssueStatus.Deferred },
  { label: 'accepted_risk', value: GovernanceIssueStatus.AcceptedRisk },
  { label: 'wont_fix', value: GovernanceIssueStatus.WontFix },
  { label: 'duplicate', value: GovernanceIssueStatus.Duplicate }
];

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
  const [status, setStatus] = useState<GovernanceIssueStatus | 'all'>('all');
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const findingsQuery = useGovernanceFindingList(
    projectId,
    GovernanceFindingStatus.Pending
  );
  const overviewQuery = useGovernanceScopeOverview(projectId);
  const reviewQueueQuery = useGovernanceReviewQueue(projectId);
  const policyQuery = useGovernancePolicy(projectId);
  const runnerListQuery = useGovernanceRunnerList();
  const changeUnitsQuery = useGovernanceChangeUnitList(projectId);
  const deliveryArtifactsQuery = useGovernanceDeliveryArtifactList(projectId);
  const listQuery = useGovernanceIssueList(
    projectId,
    status === 'all' ? undefined : status
  );
  const detailQuery = useGovernanceIssueDetail(issueId ?? null);
  const retryTriageMutation = useGovernanceRetryTriageMutation(projectId ?? '');
  const refreshProfileMutation = useGovernanceRefreshRepositoryProfileMutation(
    projectId ?? ''
  );
  const discoveryMutation = useGovernanceRunDiscoveryMutation(projectId ?? '');
  const updatePolicyMutation = useGovernanceUpdatePolicyMutation(projectId ?? '');
  const issues = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const pendingFindings = useMemo(
    () => findingsQuery.data ?? [],
    [findingsQuery.data]
  );
  const selectedIssueExists = useMemo(
    () => (issueId ? issues.some((issue) => issue.id === issueId) : false),
    [issueId, issues]
  );
  const selectedStatusLabel = useMemo(
    () =>
      STATUS_OPTIONS.find((option) => option.value === status)?.label ??
      '全部状态',
    [status]
  );

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
      handleError(findingsQuery.error, { context: '加载 pending findings 失败' });
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
    if (runnerListQuery.error) {
      handleError(runnerListQuery.error, { context: '加载 Agent Runners 失败' });
    }
  }, [handleError, runnerListQuery.error]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    if (issues.length === 0) {
      if (issueId) {
        void navigate(buildProjectGovernancePath(projectId), {
          replace: true
        });
      }
      return;
    }

    if (issueId && selectedIssueExists) {
      return;
    }

    void navigate(buildProjectGovernancePath(projectId, issues[0]!.id), {
      replace: true
    });
  }, [issueId, issues, navigate, projectId, selectedIssueExists]);

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

  const overview = overviewQuery.data;

  return (
    <Sheet open={isPolicyOpen} onOpenChange={setIsPolicyOpen}>
      <div className="flex h-full min-h-0 flex-col bg-muted/10">
        <header className="border-b bg-background px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">治理台</h2>
              <p className="text-sm text-muted-foreground">
                发现问题、筛选 backlog、推进修复与交付。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                运行 Discovery
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPolicyOpen(true)}
              >
                <SlidersHorizontal className="size-4" />
                策略设置
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <OverviewStatCard
              label="仓库画像"
              value={overview?.repositoryProfile?.branch ?? '未生成'}
              hint={
                overview?.repositoryProfile
                  ? `snapshot ${overview.repositoryProfile.snapshotAt}`
                  : '先刷新一次仓库画像'
              }
            />
            <OverviewStatCard
              label="待处理 Finding"
              value={String(overview?.findingCounts.pending ?? 0)}
              hint={pendingFindings.length > 0 ? '左侧可直接处理 triage' : '当前没有待处理 finding'}
            />
            <OverviewStatCard
              label="Issue Backlog"
              value={String(issues.length)}
              hint={
                issues.length > 0
                  ? '左侧 backlog 可直接进入 issue 详情和自动化分支'
                  : '当前还没有进入 backlog 的 issue'
              }
            />
            <OverviewStatCard
              label="Review Queue"
              value={String(reviewQueueQuery.data?.length ?? 0)}
              hint={
                (reviewQueueQuery.data?.length ?? 0) > 0
                  ? '需要人工处理的治理项会集中显示在审核队列'
                  : '当前没有待审核项'
              }
            />
          </div>

          <div className="mt-4">
            <GovernanceOrchestrationBoard
              scopeId={projectId}
              projectName={project.name}
              overview={overview}
              reviewQueue={reviewQueueQuery.data ?? []}
              findings={pendingFindings}
              issues={issues}
              selectedIssue={detailQuery.data}
              changeUnits={changeUnitsQuery.data ?? []}
              deliveryArtifacts={deliveryArtifactsQuery.data ?? []}
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-80 flex-shrink-0 flex-col border-r bg-background">
            <div className="space-y-3 border-b px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Issue Backlog
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    当前筛选：{selectedStatusLabel}
                  </p>
                </div>
                <Badge variant="outline">{issues.length}</Badge>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="governance-status-filter"
                  className="text-xs font-medium text-muted-foreground"
                >
                  状态过滤
                </label>
                <NativeSelect
                  id="governance-status-filter"
                  aria-label="治理状态过滤"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as GovernanceIssueStatus | 'all')
                  }
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
                <section className="border-b px-4 py-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        待处理 Findings
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        triage 失败或待归并的问题发现
                      </p>
                    </div>
                    <Badge variant="secondary">{pendingFindings.length}</Badge>
                  </div>
                  <GovernanceFindingList
                    findings={pendingFindings}
                    retryingFindingId={
                      retryTriageMutation.variables ?? null
                    }
                    onRetry={(findingId) => {
                      void retryTriageMutation
                        .mutateAsync(findingId)
                        .catch((error) => {
                          handleError(error, { context: '重试 triage 失败' });
                        });
                    }}
                  />
                </section>
              ) : null}

              <section className="px-4 py-4">
                {listQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : issues.length > 0 ? (
                  <GovernanceIssueList
                    issues={issues}
                    selectedId={issueId ?? null}
                    onSelect={(nextIssueId) =>
                      void navigate(buildProjectGovernancePath(projectId, nextIssueId))
                    }
                  />
                ) : (
                  <EmptyState
                    size="compact"
                    title="暂无 Governance Issue"
                    description="当前筛选下还没有进入 backlog 的问题项。"
                  />
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
              <GovernanceOverviewPanel
                issuesCount={issues.length}
                changeUnits={changeUnitsQuery.data?.slice(0, 6) ?? []}
                artifacts={deliveryArtifactsQuery.data?.slice(0, 6) ?? []}
                onSelectIssue={(nextIssueId) =>
                  void navigate(buildProjectGovernancePath(projectId, nextIssueId))
                }
              />
            )}
          </main>
        </div>
      </div>

      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>治理策略</SheetTitle>
          <SheetDescription>
            Runner 选择和 priority / auto-action / delivery 策略放在这里统一维护。
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

function OverviewStatCard({
  label,
  value,
  hint,
  action
}: {
  label: string;
  value: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {action}
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}

function GovernanceOverviewPanel({
  issuesCount,
  changeUnits,
  artifacts,
  onSelectIssue
}: {
  issuesCount: number;
  changeUnits: Parameters<typeof GovernanceChangeUnitSummaryList>[0]['changeUnits'];
  artifacts: Parameters<
    typeof GovernanceDeliveryArtifactSummaryList
  >[0]['artifacts'];
  onSelectIssue: (issueId: string) => void;
}) {
  const hasBacklog = issuesCount > 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <SurfaceCard className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">治理概览</h3>
          <p className="text-sm text-muted-foreground">
            {hasBacklog
              ? '从左侧 Issue Backlog 选择一个问题项，进入评估、规划、执行和交付。'
              : '当前还没有可处理的 Issue。先运行 Discovery 或等待 triage 生成 backlog。'}
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <SurfaceCard className="space-y-3 rounded-xl border-border/50 bg-background p-4 shadow-none">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                最近 Change Unit
              </h4>
              <p className="text-xs text-muted-foreground">
                查看最近执行中的变更单元和验证结果。
              </p>
            </div>
            <GovernanceChangeUnitSummaryList
              changeUnits={changeUnits}
              onSelectIssue={onSelectIssue}
            />
          </SurfaceCard>

          <SurfaceCard className="space-y-3 rounded-xl border-border/50 bg-background p-4 shadow-none">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                最近 Delivery Artifact
              </h4>
              <p className="text-xs text-muted-foreground">
                这里汇总最近待审批的交付单和关联结果。
              </p>
            </div>
            <GovernanceDeliveryArtifactSummaryList
              artifacts={artifacts}
              onSelectIssue={onSelectIssue}
            />
          </SurfaceCard>
        </div>
      </SurfaceCard>
    </div>
  );
}
