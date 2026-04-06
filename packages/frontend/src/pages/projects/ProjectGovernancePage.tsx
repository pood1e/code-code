import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { GovernanceFindingStatus, GovernanceIssueStatus } from '@agent-workbench/shared';

import { EmptyState } from '@/components/app/EmptyState';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { NativeSelect } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { GovernanceChangeUnitSummaryList } from '@/features/governance/components/GovernanceChangeUnitSummaryList';
import { GovernanceDeliveryArtifactSummaryList } from '@/features/governance/components/GovernanceDeliveryArtifactSummaryList';
import { GovernanceFindingList } from '@/features/governance/components/GovernanceFindingList';
import { GovernanceIssueDetail } from '@/features/governance/components/GovernanceIssueDetail';
import { GovernanceIssueList } from '@/features/governance/components/GovernanceIssueList';
import { GovernancePolicyPanel } from '@/features/governance/components/GovernancePolicyPanel';
import {
  useGovernanceRefreshRepositoryProfileMutation,
  useGovernanceRetryTriageMutation,
  useGovernanceRunDiscoveryMutation,
  useGovernanceUpdatePolicyMutation
} from '@/features/governance/hooks/use-governance-mutations';
import {
  useGovernanceFindingList,
  useGovernanceChangeUnitList,
  useGovernanceDeliveryArtifactList,
  useGovernanceIssueDetail,
  useGovernanceIssueList,
  useGovernancePolicy,
  useGovernanceScopeOverview
} from '@/features/governance/hooks/use-governance-queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { buildProjectGovernancePath } from '@/types/projects';

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
  const findingsQuery = useGovernanceFindingList(
    projectId,
    GovernanceFindingStatus.Pending
  );
  const overviewQuery = useGovernanceScopeOverview(projectId);
  const policyQuery = useGovernancePolicy(projectId);
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

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex w-72 flex-shrink-0 flex-col border-r bg-background">
        <div className="space-y-3 border-b px-4 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">治理台</h2>
            <p className="text-xs text-muted-foreground">
              Issue backlog、评估覆盖与方案审批
            </p>
          </div>
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Overview
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div>
                profile:{' '}
                <span className="font-medium text-foreground">
                  {overviewQuery.data?.repositoryProfile?.branch ?? 'none'}
                </span>
              </div>
              <div>
                pending:{' '}
                <span className="font-medium text-foreground">
                  {overviewQuery.data?.findingCounts.pending ?? 0}
                </span>
              </div>
              <div>
                baseline:{' '}
                <span className="font-medium text-foreground">
                  {overviewQuery.data?.latestBaselineAttempt?.status ?? 'idle'}
                </span>
              </div>
              <div>
                discovery:{' '}
                <span className="font-medium text-foreground">
                  {overviewQuery.data?.latestDiscoveryAttempt?.status ?? 'idle'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs font-medium text-primary disabled:text-muted-foreground"
                disabled={refreshProfileMutation.isPending}
                onClick={() => {
                  void refreshProfileMutation.mutateAsync().catch((error) => {
                    handleError(error, { context: '刷新 repository profile 失败' });
                  });
                }}
              >
                Refresh Profile
              </button>
              <button
                type="button"
                className="text-xs font-medium text-primary disabled:text-muted-foreground"
                disabled={discoveryMutation.isPending}
                onClick={() => {
                  void discoveryMutation.mutateAsync().catch((error) => {
                    handleError(error, { context: '执行 discovery 失败' });
                  });
                }}
              >
                Run Discovery
              </button>
            </div>
          </div>
          <GovernancePolicyPanel
            policy={policyQuery.data}
            isLoading={policyQuery.isLoading}
            isPending={updatePolicyMutation.isPending}
            onSubmit={async (payload) => {
              await updatePolicyMutation.mutateAsync(payload);
            }}
          />
          <NativeSelect
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

        <div className="flex-1 overflow-y-auto">
          {pendingFindings.length > 0 ? (
            <div className="border-b">
              <div className="px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pending Findings
                </p>
              </div>
              <GovernanceFindingList
                findings={pendingFindings}
                retryingFindingId={
                  retryTriageMutation.variables ?? null
                }
                onRetry={(findingId) => {
                  void retryTriageMutation.mutateAsync(findingId).catch((error) => {
                    handleError(error, { context: '重试 triage 失败' });
                  });
                }}
              />
            </div>
          ) : null}

          <div className="border-b px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Change Units
            </p>
          </div>
          <div className="border-b px-3 py-3">
            <GovernanceChangeUnitSummaryList
              changeUnits={changeUnitsQuery.data?.slice(0, 6) ?? []}
              onSelectIssue={(nextIssueId) =>
                void navigate(buildProjectGovernancePath(projectId, nextIssueId))
              }
            />
          </div>

          <div className="border-b px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Delivery Artifacts
            </p>
          </div>
          <div className="border-b px-3 py-3">
            <GovernanceDeliveryArtifactSummaryList
              artifacts={deliveryArtifactsQuery.data?.slice(0, 6) ?? []}
              onSelectIssue={(nextIssueId) =>
                void navigate(buildProjectGovernancePath(projectId, nextIssueId))
              }
            />
          </div>

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
              description="当前 Project 还没有进入 backlog 的问题项。"
            />
          )}
        </div>
      </div>

      <Separator orientation="vertical" />

      <div className="min-w-0 flex-1 overflow-hidden">
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
          <div className="flex h-full items-center justify-center px-6">
            <EmptyState
              title="选择一个 Issue"
              description="从左侧 backlog 选择一个 Issue 开始治理。"
            />
          </div>
        )}
      </div>
    </div>
  );
}
