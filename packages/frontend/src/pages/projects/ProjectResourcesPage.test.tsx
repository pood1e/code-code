import { screen, waitFor } from '@testing-library/react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChangeUnit,
  DeliveryArtifact,
  Finding,
  GovernanceExecutionAttemptSummary,
  GovernanceIssueDetail,
  GovernanceIssueSummary,
  GovernancePolicy,
  GovernancePriority,
  GovernanceReviewQueueItem,
  Project
} from '@agent-workbench/shared';
import {
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceChangePlanStatus,
  GovernanceChangeUnitStatus,
  GovernanceDeliveryArtifactStatus,
  GovernanceExecutionAttemptStatus,
  GovernanceExecutionMode,
  GovernanceFindingSource,
  GovernanceFindingStatus,
  GovernanceIssueKind,
  GovernanceIssueStatus,
  GovernancePriority as GovernancePriorityEnum,
  GovernanceReviewQueueItemKind,
  GovernanceViolationPolicy
} from '@agent-workbench/shared';

import { useGovernanceRetryTriageMutation } from '@/features/governance/hooks/use-governance-mutations';
import {
  useGovernanceChangeUnitList,
  useGovernanceDeliveryArtifactList,
  useGovernanceFindingList,
  useGovernanceIssueDetail,
  useGovernanceIssueList,
  useGovernancePolicy,
  useGovernanceReviewQueue
} from '@/features/governance/hooks/use-governance-queries';
import { renderWithProviders } from '@/test/render';

import { ProjectResourcesPage } from './ProjectResourcesPage';
import { useProjectPageData } from './use-project-page-data';

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

vi.mock('@/features/governance/hooks/use-governance-queries', () => ({
  useGovernancePolicy: vi.fn(),
  useGovernanceReviewQueue: vi.fn(),
  useGovernanceFindingList: vi.fn(),
  useGovernanceIssueList: vi.fn(),
  useGovernanceIssueDetail: vi.fn(),
  useGovernanceChangeUnitList: vi.fn(),
  useGovernanceDeliveryArtifactList: vi.fn()
}));

vi.mock('@/features/governance/hooks/use-governance-mutations', () => ({
  useGovernanceRetryTriageMutation: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: () => vi.fn()
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
      defaultEligibility: 'human_review_required',
      severityOverrides: {},
      issueKindOverrides: {}
    },
    deliveryPolicy: {
      commitMode: 'per_unit',
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
      status: GovernanceExecutionAttemptStatus.NeedsHumanReview,
      sessionId: 'session-triage-1'
    }),
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function createIssueSummary(
  overrides: Partial<GovernanceIssueSummary> = {}
): GovernanceIssueSummary {
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
    }),
    ...overrides
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

function createArtifact(): DeliveryArtifact {
  return {
    id: 'artifact-1',
    scopeId: 'project-1',
    changePlanId: 'plan-1',
    linkedIssueIds: ['issue-1'],
    linkedChangeUnitIds: ['change-unit-1'],
    linkedVerificationResultIds: [],
    title: 'Prepare delivery package',
    summary: '等待合并前检查',
    status: GovernanceDeliveryArtifactStatus.Draft,
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
    deliveryArtifact: createArtifact()
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
  } as unknown as UseMutationResult<TData, Error, TVariables, unknown>;
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderProjectResourcesPage(route = '/projects/project-1/resources') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/:id/resources"
        element={
          <>
            <ProjectResourcesPage />
            <RouteEcho />
          </>
        }
      />
      <Route
        path="/projects/:id/resources/:issueId"
        element={
          <>
            <ProjectResourcesPage />
            <RouteEcho />
          </>
        }
      />
      <Route path="/projects/:id/governance" element={<RouteEcho />} />
      <Route path="/projects/:id/reviews" element={<RouteEcho />} />
    </Routes>,
    { route }
  );
}

describe('ProjectResourcesPage', () => {
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
    vi.mocked(useGovernancePolicy).mockReturnValue(createQueryResult(createPolicy()));
    vi.mocked(useGovernanceReviewQueue).mockReturnValue(
      createQueryResult([createReviewQueueItem()])
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
      createQueryResult([createArtifact()])
    );
    vi.mocked(useGovernanceRetryTriageMutation).mockReturnValue(
      createMutationResult<void, string>()
    );
  });

  it('应渲染资源页双栏结构并默认选中第一个 issue', async () => {
    renderProjectResourcesPage();

    expect(screen.getByRole('heading', { name: '资源' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Issue' })).toBeInTheDocument();
    expect(screen.getByText('待归并发现')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/resources/issue-1'
      );
    });
  });

  it('应支持 backlog 搜索并自动切换到命中的 issue', async () => {
    vi.mocked(useGovernanceIssueList).mockReturnValue(
      createQueryResult([
        createIssueSummary(),
        createIssueSummary({
          id: 'issue-2',
          title: 'Improve review queue scanning',
          statement: 'review queue 需要更高的扫描密度',
          impactSummary: '审核页需要列表化',
          affectedTargets: [{ kind: 'file', ref: 'src/reviews.tsx' }],
          latestPlanningAttempt: null,
          updatedAt: '2026-04-06T01:00:00.000Z'
        })
      ])
    );
    vi.mocked(useGovernanceIssueDetail).mockReturnValue(
      createQueryResult(createIssueDetail())
    );

    const { user } = renderProjectResourcesPage();

    await user.type(
      screen.getByPlaceholderText('搜索 title、summary、target'),
      'review queue'
    );

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/resources/issue-2'
      );
    });

    expect(screen.getByText('Improve review queue scanning')).toBeInTheDocument();
    expect(
      screen.queryByText('Stabilize governance queue')
    ).not.toBeInTheDocument();
  });

  it('应提供治理工作流入口', async () => {
    const { user } = renderProjectResourcesPage();

    await user.click(screen.getByRole('button', { name: '治理工作流' }));

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/governance'
      );
    });
  });

  it('应提供审核队列入口', async () => {
    const { user } = renderProjectResourcesPage();

    await user.click(screen.getByRole('button', { name: /审核队列/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/reviews'
      );
    });
  });
});
