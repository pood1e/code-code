import { screen } from '@testing-library/react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentRunnerSummary,
  ChangeUnit,
  Finding,
  GovernanceAutoActionEligibility,
  GovernanceExecutionAttemptSummary,
  GovernanceIssueDetail,
  GovernanceDeliveryCommitMode,
  GovernanceIssueSummary,
  GovernancePolicy,
  GovernancePriority,
  GovernanceReviewQueueItem,
  GovernanceScopeOverview,
  RepositoryProfile,
  Project
} from '@agent-workbench/shared';
import {
  GovernanceAutoActionEligibility as GovernanceAutoActionEligibilityEnum,
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceChangeUnitStatus,
  GovernanceChangePlanStatus,
  GovernanceDeliveryCommitMode as GovernanceDeliveryCommitModeEnum,
  GovernanceExecutionMode,
  GovernanceExecutionAttemptStatus,
  GovernanceFindingSource,
  GovernanceFindingStatus,
  GovernanceIssueKind,
  GovernanceIssueStatus,
  GovernancePriority as GovernancePriorityEnum,
  GovernanceReviewQueueItemKind,
  GovernanceViolationPolicy,
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
  useGovernanceReviewQueue,
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
  useGovernanceReviewQueue: vi.fn(),
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

vi.mock('@/features/governance/components/GovernanceSessionHistorySheet', () => ({
  GovernanceSessionHistorySheet: ({
    title,
    triggerLabel = '查看日志'
  }: {
    title: string;
    triggerLabel?: string;
  }) => <button type="button">{`${triggerLabel}:${title}`}</button>
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
    latestBaselineAttempt: {
      id: 'attempt-baseline-1',
      stageType: GovernanceAutomationStage.Baseline,
      subjectType: GovernanceAutomationSubjectType.Scope,
      subjectId: 'project-1',
      attemptNo: 1,
      status: GovernanceExecutionAttemptStatus.Succeeded,
      sessionId: 'session-baseline-1',
      activeRequestMessageId: 'message-baseline-1',
      failureCode: null,
      failureMessage: null,
      updatedAt: '2026-04-06T00:00:00.000Z'
    },
    latestDiscoveryAttempt: {
      id: 'attempt-discovery-1',
      stageType: GovernanceAutomationStage.Discovery,
      subjectType: GovernanceAutomationSubjectType.Scope,
      subjectId: 'project-1',
      attemptNo: 1,
      status: GovernanceExecutionAttemptStatus.Running,
      sessionId: 'session-discovery-1',
      activeRequestMessageId: 'message-discovery-1',
      failureCode: null,
      failureMessage: null,
      updatedAt: '2026-04-06T00:00:00.000Z'
    },
    findingCounts: {
      pending: 0,
      merged: 0,
      dismissed: 0,
      ignored: 0
    }
  };
}

function createAttempt(
  input: {
    stageType: GovernanceAutomationStage;
    subjectType: GovernanceAutomationSubjectType;
    subjectId: string;
    status: GovernanceExecutionAttemptStatus;
    sessionId: string;
  }
): GovernanceExecutionAttemptSummary {
  return {
    id: `attempt-${input.stageType}-${input.subjectId}`,
    stageType: input.stageType,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    attemptNo: 1,
    status: input.status,
    sessionId: input.sessionId,
    activeRequestMessageId: `message-${input.stageType}-${input.subjectId}`,
    failureCode: null,
    failureMessage: null,
    updatedAt: '2026-04-06T00:00:00.000Z'
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
    sourceSelection: {
      repoBranch: null,
      docBranch: null
    },
    agentStrategy: {
      defaultRunnerIds: [],
      discovery: null,
      triage: null,
      planning: null,
      execution: null
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

function createFinding(): Finding {
  return {
    id: 'finding-1',
    scopeId: 'project-1',
    source: GovernanceFindingSource.AgentReview,
    title: 'duplicate null check',
    summary: '重复空判断可以自动归并到已有 issue。',
    evidence: [],
    categories: ['clean_code'],
    tags: [],
    affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
    status: GovernanceFindingStatus.Pending,
    latestTriageAttempt: createAttempt({
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectId: 'finding-1',
      status: GovernanceExecutionAttemptStatus.Running,
      sessionId: 'session-triage-1'
    }),
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function createIssueSummary(): GovernanceIssueSummary {
  return {
    id: 'issue-1',
    scopeId: 'project-1',
    title: 'Stabilize governance queue',
    statement: '治理任务排队状态需要更直观。',
    kind: GovernanceIssueKind.Improvement,
    categories: ['governance'],
    tags: [],
    relatedFindingIds: ['finding-1'],
    status: GovernanceIssueStatus.Open,
    affectedTargets: [{ kind: 'file', ref: 'src/governance.tsx' }],
    impactSummary: '需要提高治理台可见性',
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z',
    relatedFindingCount: 1,
    latestAssessment: null,
    latestResolutionDecision: null,
    latestChangePlanStatus: GovernanceChangePlanStatus.Draft,
    latestPlanningAttempt: createAttempt({
      stageType: GovernanceAutomationStage.Planning,
      subjectType: GovernanceAutomationSubjectType.Issue,
      subjectId: 'issue-1',
      status: GovernanceExecutionAttemptStatus.Running,
      sessionId: 'session-planning-1'
    })
  };
}

function createChangeUnit(): ChangeUnit {
  return {
    id: 'change-unit-1',
    changePlanId: 'plan-1',
    issueId: 'issue-1',
    sourceActionId: 'action-1',
    dependsOnUnitIds: [],
    title: 'Render governance pipeline board',
    description: '让治理台可以看到阶段状态和运行中 agent。',
    scope: {
      targets: [
        {
          kind: 'file',
          ref: 'src/pages/projects/ProjectGovernancePage.tsx'
        }
      ],
      violationPolicy: GovernanceViolationPolicy.Warn
    },
    executionMode: GovernanceExecutionMode.SemiAuto,
    maxRetries: 2,
    currentAttemptNo: 1,
    status: GovernanceChangeUnitStatus.Running,
    producedCommitIds: [],
    latestExecutionAttempt: createAttempt({
      stageType: GovernanceAutomationStage.Execution,
      subjectType: GovernanceAutomationSubjectType.ChangeUnit,
      subjectId: 'change-unit-1',
      status: GovernanceExecutionAttemptStatus.Running,
      sessionId: 'session-execution-1'
    }),
    latestVerificationResult: null,
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function createIssueDetail(): GovernanceIssueDetail {
  return {
    ...createIssueSummary(),
    relatedFindings: [createFinding()],
    changePlan: null,
    changeUnits: [createChangeUnit()],
    verificationPlans: [],
    verificationResults: [],
    planLevelVerificationResult: null,
    deliveryArtifact: null
  };
}

function createReviewQueueItem(): GovernanceReviewQueueItem {
  return {
    kind: GovernanceReviewQueueItemKind.DeliveryArtifact,
    scopeId: 'project-1',
    subjectId: 'artifact-1',
    issueId: 'issue-1',
    title: 'PR review waiting',
    status: 'needs_human_review',
    failureCode: null,
    failureMessage: '等待人工确认交付说明。',
    sessionId: 'session-review-1',
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
  vi.mocked(useGovernanceReviewQueue).mockReturnValue(
    createQueryResult([createReviewQueueItem()])
  );
  vi.mocked(useGovernanceRunnerList).mockReturnValue(
    createQueryResult([createRunner()])
  );
  vi.mocked(useGovernanceFindingList).mockReturnValue(
    createQueryResult([createFinding()])
  );
  vi.mocked(useGovernanceIssueList).mockReturnValue(
    createQueryResult([createIssueSummary()])
  );
  vi.mocked(useGovernanceIssueDetail).mockReturnValue(
    createQueryResult(createIssueDetail())
  );
  vi.mocked(useGovernanceChangeUnitList).mockReturnValue(
    createQueryResult([createChangeUnit()])
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
    vi.mocked(useGovernanceIssueList).mockReturnValue(
      createQueryResult([] as GovernanceIssueSummary[])
    );
    vi.mocked(useGovernanceIssueDetail).mockReturnValue(
      createQueryResult(undefined as unknown as GovernanceIssueDetail)
    );

    const { user } = renderProjectGovernancePage();

    expect(
      screen.getByRole('heading', { name: 'Issue Backlog' })
    ).toBeInTheDocument();
    expect(screen.getByText('治理流水线')).toBeInTheDocument();
    expect(screen.getByText('运行中 Agent')).toBeInTheDocument();
    expect(screen.getByText('最近 Change Unit')).toBeInTheDocument();
    expect(screen.queryByText('治理策略表单')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /策略设置/i }));

    expect(await screen.findByText('治理策略表单')).toBeInTheDocument();
  });

  it('应为 baseline 和 discovery 展示日志入口', () => {
    renderProjectGovernancePage();

    expect(
      screen.getByRole('button', { name: '查看日志:code-code · Baseline 日志' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: '查看日志:code-code · Discovery 日志' })
        .length
    ).toBeGreaterThan(0);
  });

  it('应展示运行中 agent 和治理流水线', () => {
    renderProjectGovernancePage();

    expect(screen.getByText('运行中 Agent')).toBeInTheDocument();
    expect(screen.getByText('治理流水线')).toBeInTheDocument();
    expect(screen.getByText('问题发现')).toBeInTheDocument();
    expect(screen.getAllByText('duplicate null check').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Stabilize governance queue').length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Render governance pipeline board').length
    ).toBeGreaterThan(0);
    expect(screen.getByText('1 items waiting review')).toBeInTheDocument();
  });
});
