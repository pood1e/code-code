import { screen } from '@testing-library/react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentRunnerSummary,
  GovernanceAutoActionEligibility,
  GovernanceIssueDetail,
  GovernanceDeliveryCommitMode,
  GovernanceIssueSummary,
  GovernancePolicy,
  GovernancePriority,
  GovernanceScopeOverview,
  RepositoryProfile,
  Project
} from '@agent-workbench/shared';
import {
  GovernanceAutoActionEligibility as GovernanceAutoActionEligibilityEnum,
  GovernanceDeliveryCommitMode as GovernanceDeliveryCommitModeEnum,
  GovernancePriority as GovernancePriorityEnum,
  type UpdateGovernancePolicyInput
} from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { ProjectGovernancePage } from './ProjectGovernancePage';
import { useProjectPageData } from './use-project-page-data';
import {
  useGovernanceChangeUnitList,
  useGovernanceDeliveryArtifactList,
  useGovernanceFindingList,
  useGovernanceIssueDetail,
  useGovernanceIssueList,
  useGovernancePolicy,
  useGovernanceRunnerList,
  useGovernanceScopeOverview
} from '@/features/governance/hooks/use-governance-queries';
import {
  useGovernanceRefreshRepositoryProfileMutation,
  useGovernanceRetryTriageMutation,
  useGovernanceRunDiscoveryMutation,
  useGovernanceUpdatePolicyMutation
} from '@/features/governance/hooks/use-governance-mutations';

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

vi.mock('@/features/governance/hooks/use-governance-queries', () => ({
  useGovernanceScopeOverview: vi.fn(),
  useGovernancePolicy: vi.fn(),
  useGovernanceRunnerList: vi.fn(),
  useGovernanceFindingList: vi.fn(),
  useGovernanceIssueList: vi.fn(),
  useGovernanceIssueDetail: vi.fn(),
  useGovernanceChangeUnitList: vi.fn(),
  useGovernanceDeliveryArtifactList: vi.fn()
}));

vi.mock('@/features/governance/hooks/use-governance-mutations', () => ({
  useGovernanceRetryTriageMutation: vi.fn(),
  useGovernanceRefreshRepositoryProfileMutation: vi.fn(),
  useGovernanceRunDiscoveryMutation: vi.fn(),
  useGovernanceUpdatePolicyMutation: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: () => vi.fn()
}));

vi.mock('@/features/governance/components/GovernancePolicyPanel', () => ({
  GovernancePolicyPanel: () => <div>治理策略表单</div>
}));

vi.mock('@/features/governance/components/GovernanceIssueDetail', () => ({
  GovernanceIssueDetail: () => <div>Issue Detail</div>
}));

function createProject(): Project {
  return {
    id: 'project-1',
    name: 'code-code',
    description: null,
    repoGitUrl: 'git@github.com:pood1e/code-code.git',
    workspaceRootPath: '/tmp/workbench',
    docGitUrl: null,
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function createOverview(): GovernanceScopeOverview {
  return {
    scopeId: 'project-1',
    repositoryProfile: null,
    latestBaselineAttempt: null,
    latestDiscoveryAttempt: null,
    findingCounts: {
      pending: 0,
      merged: 0,
      dismissed: 0,
      ignored: 0
    }
  };
}

function createPolicy(): GovernancePolicy {
  return {
    id: 'policy-1',
    scopeId: 'project-1',
    priorityPolicy: {
      defaultPriority: GovernancePriorityEnum.P2,
      severityOverrides: {
        critical: GovernancePriorityEnum.P0,
        high: GovernancePriorityEnum.P1,
        medium: GovernancePriorityEnum.P2,
        low: GovernancePriorityEnum.P3
      } satisfies Partial<Record<string, GovernancePriority>>
    },
    autoActionPolicy: {
      defaultEligibility:
        GovernanceAutoActionEligibilityEnum.HumanReviewRequired,
      severityOverrides: {
        critical: GovernanceAutoActionEligibilityEnum.Forbidden,
        high: GovernanceAutoActionEligibilityEnum.HumanReviewRequired,
        medium: GovernanceAutoActionEligibilityEnum.HumanReviewRequired,
        low: GovernanceAutoActionEligibilityEnum.SuggestOnly
      } satisfies Partial<Record<string, GovernanceAutoActionEligibility>>,
      issueKindOverrides: {
        bug: GovernanceAutoActionEligibilityEnum.HumanReviewRequired,
        risk: GovernanceAutoActionEligibilityEnum.Forbidden,
        debt: GovernanceAutoActionEligibilityEnum.HumanReviewRequired,
        improvement: GovernanceAutoActionEligibilityEnum.SuggestOnly,
        gap: GovernanceAutoActionEligibilityEnum.HumanReviewRequired,
        violation: GovernanceAutoActionEligibilityEnum.Forbidden
      } satisfies Partial<Record<string, GovernanceAutoActionEligibility>>
    },
    deliveryPolicy: {
      commitMode: GovernanceDeliveryCommitModeEnum.PerUnit,
      autoCloseIssueOnApprovedDelivery: true
    },
    runnerSelection: {
      defaultRunnerId: null,
      discoveryRunnerId: null,
      triageRunnerId: null,
      planningRunnerId: null,
      executionRunnerId: null
    },
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function createRunner(): AgentRunnerSummary {
  return {
    id: 'runner-1',
    name: 'MiniMax 2.7 Runner',
    type: 'claude-code',
    description: null,
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function mockMutationHook() {
  return {
    data: undefined,
    error: null,
    isError: false,
    isIdle: true,
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isPaused: false,
    isPlaceholderData: false,
    status: 'idle',
    reset: vi.fn(),
    variables: null,
    submittedAt: 0,
    failureCount: 0,
    failureReason: null,
    context: undefined
  };
}

function createQueryResult<TData>(data: TData): UseQueryResult<TData, Error> {
  return {
    data,
    error: null,
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: true,
    isFetching: false,
    isRefetching: false,
    isLoadingError: false,
    isRefetchError: false,
    isPlaceholderData: false,
    isStale: false,
    status: 'success',
    fetchStatus: 'idle',
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    refetch: vi.fn(),
    remove: vi.fn(),
    isFetched: true,
    isFetchedAfterMount: true,
    isInitialLoading: false,
    isPaused: false,
    isEnabled: true,
    promise: Promise.resolve(data)
  } as unknown as UseQueryResult<TData, Error>;
}

function createMutationResult<TData, TVariables>(): UseMutationResult<
  TData,
  Error,
  TVariables,
  unknown
> {
  return mockMutationHook() as unknown as UseMutationResult<
    TData,
    Error,
    TVariables,
    unknown
  >;
}

function mockQueries() {
  vi.mocked(useGovernanceScopeOverview).mockReturnValue(
    createQueryResult(createOverview())
  );
  vi.mocked(useGovernancePolicy).mockReturnValue(createQueryResult(createPolicy()));
  vi.mocked(useGovernanceRunnerList).mockReturnValue(
    createQueryResult([createRunner()])
  );
  vi.mocked(useGovernanceFindingList).mockReturnValue(createQueryResult([]));
  vi.mocked(useGovernanceIssueList).mockReturnValue(
    createQueryResult([] as GovernanceIssueSummary[])
  );
  vi.mocked(useGovernanceIssueDetail).mockReturnValue(
    createQueryResult({} as GovernanceIssueDetail)
  );
  vi.mocked(useGovernanceChangeUnitList).mockReturnValue(
    createQueryResult([])
  );
  vi.mocked(useGovernanceDeliveryArtifactList).mockReturnValue(
    createQueryResult([])
  );
}

function mockMutations() {
  vi.mocked(useGovernanceRetryTriageMutation).mockReturnValue(
    createMutationResult<void, string>()
  );
  vi.mocked(useGovernanceRefreshRepositoryProfileMutation).mockReturnValue(
    createMutationResult<RepositoryProfile | null, void>()
  );
  vi.mocked(useGovernanceRunDiscoveryMutation).mockReturnValue(
    createMutationResult<GovernanceScopeOverview, void>()
  );
  vi.mocked(useGovernanceUpdatePolicyMutation).mockReturnValue(
    createMutationResult<GovernancePolicy, UpdateGovernancePolicyInput>()
  );
}

function renderProjectGovernancePage() {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:id/governance" element={<ProjectGovernancePage />} />
      <Route
        path="/projects/:id/governance/:issueId"
        element={<ProjectGovernancePage />}
      />
    </Routes>,
    {
      route: '/projects/project-1/governance'
    }
  );
}

describe('ProjectGovernancePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useProjectPageData).mockReturnValue({
      id: 'project-1',
      project: createProject(),
      projects: [createProject()],
      isLoading: false,
      isNotFound: false,
      goToProjects: vi.fn(),
      goToProjectTab: vi.fn()
    });
    mockQueries();
    mockMutations();
  });

  it('应默认展示 backlog 布局，并把策略表单收进抽屉', async () => {
    const { user } = renderProjectGovernancePage();

    expect(screen.getByText('Issue Backlog')).toBeInTheDocument();
    expect(screen.getByText('治理概览')).toBeInTheDocument();
    expect(screen.getByText('最近 Change Unit')).toBeInTheDocument();
    expect(screen.queryByText('治理策略表单')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /策略设置/i }));

    expect(await screen.findByText('治理策略表单')).toBeInTheDocument();
  });
});
