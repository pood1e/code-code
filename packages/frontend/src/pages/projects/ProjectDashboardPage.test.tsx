import { screen, waitFor } from '@testing-library/react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import {
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceChangePlanStatus,
  GovernanceChangeUnitStatus,
  GovernanceExecutionAttemptStatus,
  GovernanceExecutionMode,
  GovernanceFindingSource,
  GovernanceFindingStatus,
  GovernanceIssueKind,
  GovernanceIssueStatus,
  GovernanceReviewQueueItemKind,
  GovernanceViolationPolicy,
  type ChangeUnit,
  type Finding,
  type GovernanceExecutionAttemptSummary,
  type GovernanceIssueSummary,
  type GovernanceReviewQueueItem,
  type GovernanceScopeOverview,
  type Project
} from '@agent-workbench/shared';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useGovernanceRunDiscoveryMutation
} from '@/features/governance/hooks/use-governance-mutations';
import {
  useGovernanceChangeUnitList,
  useGovernanceDeliveryArtifactList,
  useGovernanceFindingList,
  useGovernanceIssueList,
  useGovernanceReviewQueue,
  useGovernanceScopeOverview
} from '@/features/governance/hooks/use-governance-queries';
import { renderWithProviders } from '@/test/render';

import { ProjectDashboardPage } from './ProjectDashboardPage';
import { useProjectPageData } from './use-project-page-data';

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

vi.mock('@/features/governance/hooks/use-governance-queries', () => ({
  useGovernanceScopeOverview: vi.fn(),
  useGovernanceReviewQueue: vi.fn(),
  useGovernanceFindingList: vi.fn(),
  useGovernanceIssueList: vi.fn(),
  useGovernanceChangeUnitList: vi.fn(),
  useGovernanceDeliveryArtifactList: vi.fn()
}));

vi.mock('@/features/governance/hooks/use-governance-mutations', () => ({
  useGovernanceRunDiscoveryMutation: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: () => vi.fn()
}));

vi.mock('@/features/governance/components/GovernanceOrchestrationBoard', () => ({
  GovernanceOrchestrationBoard: ({ mode }: { mode: 'summary' | 'workspace' }) => (
    <div>{`治理流水线:${mode}`}</div>
  )
}));

function createProject(): Project {
  return {
    id: 'project-1',
    name: 'Workbench',
    description: 'Demo project',
    repoGitUrl: 'https://github.com/example/workbench.git',
    workspaceRootPath: '/tmp/workbench',
    docGitUrl: null,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createAttempt(
  status: GovernanceExecutionAttemptStatus,
  subjectId: string,
  stageType: GovernanceAutomationStage
): GovernanceExecutionAttemptSummary {
  return {
    id: `${stageType}-${subjectId}`,
    stageType,
    subjectType:
      stageType === GovernanceAutomationStage.Execution
        ? GovernanceAutomationSubjectType.ChangeUnit
        : GovernanceAutomationSubjectType.Scope,
    subjectId,
    attemptNo: 1,
    status,
    sessionId: `session-${stageType}-${subjectId}`,
    activeRequestMessageId: `message-${stageType}-${subjectId}`,
    failureCode: null,
    failureMessage: null,
    updatedAt: '2026-04-06T10:00:00.000Z'
  };
}

function createOverview(): GovernanceScopeOverview {
  return {
    scopeId: 'project-1',
    repositoryProfile: null,
    latestBaselineAttempt: createAttempt(
      GovernanceExecutionAttemptStatus.Succeeded,
      'project-1',
      GovernanceAutomationStage.Baseline
    ),
    latestDiscoveryAttempt: createAttempt(
      GovernanceExecutionAttemptStatus.Running,
      'project-1',
      GovernanceAutomationStage.Discovery
    ),
    findingCounts: {
      pending: 1,
      merged: 0,
      dismissed: 0,
      ignored: 0
    }
  };
}

function createFinding(): Finding {
  return {
    id: 'finding-1',
    scopeId: 'project-1',
    source: GovernanceFindingSource.AgentReview,
    title: '需要归并的 finding',
    summary: 'triage 尚未完成',
    evidence: [],
    categories: ['clean_code'],
    tags: [],
    affectedTargets: [{ kind: 'file', ref: 'src/app.tsx' }],
    status: GovernanceFindingStatus.Pending,
    latestTriageAttempt: {
      id: 'triage-finding-1',
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectId: 'finding-1',
      attemptNo: 1,
      status: GovernanceExecutionAttemptStatus.WaitingRepair,
      sessionId: 'session-triage-finding-1',
      activeRequestMessageId: 'message-triage-finding-1',
      failureCode: null,
      failureMessage: null,
      updatedAt: '2026-04-06T10:00:00.000Z'
    },
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z'
  };
}

function createIssue(): GovernanceIssueSummary {
  return {
    id: 'issue-1',
    scopeId: 'project-1',
    title: '治理总览缺少真实数据',
    statement: 'dashboard 还没有承担 overview 职责',
    kind: GovernanceIssueKind.Improvement,
    categories: ['governance'],
    tags: [],
    relatedFindingIds: ['finding-1'],
    status: GovernanceIssueStatus.Open,
    affectedTargets: [{ kind: 'file', ref: 'src/dashboard.tsx' }],
    impactSummary: '运营视角无法快速判断治理健康度',
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z',
    relatedFindingCount: 1,
    latestAssessment: null,
    latestResolutionDecision: null,
    latestChangePlanStatus: GovernanceChangePlanStatus.Draft,
    latestPlanningAttempt: null
  };
}

function createReviewQueueItem(): GovernanceReviewQueueItem {
  return {
    kind: GovernanceReviewQueueItemKind.Discovery,
    scopeId: 'project-1',
    subjectId: 'scope-1',
    issueId: 'issue-1',
    title: 'Discovery 需要人工确认',
    status: 'needs_human_review',
    failureCode: 'DISCOVERY_TIMEOUT',
    failureMessage: '等待人工确认',
    sessionId: 'session-discovery-review',
    updatedAt: '2026-04-06T12:00:00.000Z'
  };
}

function createChangeUnit(): ChangeUnit {
  return {
    id: 'change-unit-1',
    changePlanId: 'plan-1',
    issueId: 'issue-1',
    sourceActionId: 'action-1',
    dependsOnUnitIds: [],
    title: '运行中的执行单元',
    description: '用于统计活动会话',
    scope: {
      targets: [{ kind: 'file', ref: 'src/dashboard.tsx' }],
      violationPolicy: GovernanceViolationPolicy.Warn
    },
    executionMode: GovernanceExecutionMode.SemiAuto,
    maxRetries: 1,
    currentAttemptNo: 1,
    status: GovernanceChangeUnitStatus.Running,
    producedCommitIds: [],
    latestExecutionAttempt: createAttempt(
      GovernanceExecutionAttemptStatus.Running,
      'change-unit-1',
      GovernanceAutomationStage.Execution
    ),
    latestVerificationResult: null,
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z'
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

function createMutationResult(): UseMutationResult<
  GovernanceScopeOverview,
  Error,
  void,
  unknown
> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isIdle: true,
    isPaused: false,
    isPending: false,
    isSuccess: false,
    status: 'idle',
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(createOverview()),
    reset: vi.fn(),
    variables: undefined,
    submittedAt: 0,
    failureCount: 0,
    failureReason: null,
    context: undefined
  } as unknown as UseMutationResult<GovernanceScopeOverview, Error, void, unknown>;
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderProjectDashboardPage() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/:id/dashboard"
        element={
          <>
            <ProjectDashboardPage />
            <RouteEcho />
          </>
        }
      />
      <Route path="/projects/:id/governance" element={<RouteEcho />} />
      <Route path="/projects/:id/governance/:issueId" element={<RouteEcho />} />
      <Route path="/projects/:id/reviews" element={<RouteEcho />} />
      <Route path="/projects" element={<RouteEcho />} />
    </Routes>,
    {
      route: '/projects/project-1/dashboard'
    }
  );
}

describe('ProjectDashboardPage', () => {
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
    vi.mocked(useGovernanceScopeOverview).mockReturnValue(
      createQueryResult(createOverview())
    );
    vi.mocked(useGovernanceReviewQueue).mockReturnValue(
      createQueryResult([createReviewQueueItem()])
    );
    vi.mocked(useGovernanceFindingList).mockReturnValue(
      createQueryResult([createFinding()])
    );
    vi.mocked(useGovernanceIssueList).mockReturnValue(
      createQueryResult([createIssue()])
    );
    vi.mocked(useGovernanceChangeUnitList).mockReturnValue(
      createQueryResult([createChangeUnit()])
    );
    vi.mocked(useGovernanceDeliveryArtifactList).mockReturnValue(
      createQueryResult([])
    );
    vi.mocked(useGovernanceRunDiscoveryMutation).mockReturnValue(
      createMutationResult()
    );
  });

  it('应展示治理概览与进入治理工作流的 CTA', async () => {
    const { user } = renderProjectDashboardPage();

    expect(
      screen.getByRole('heading', { name: '治理概览' })
    ).toBeInTheDocument();
    expect(screen.getByText('待审核')).toBeInTheDocument();
    expect(screen.getByText('Open Issue')).toBeInTheDocument();
    expect(screen.getByText('待归并发现')).toBeInTheDocument();
    expect(screen.getByText('运行中')).toBeInTheDocument();
    expect(screen.getByText('治理流水线:summary')).toBeInTheDocument();
    expect(screen.getByText('待处理审核项')).toBeInTheDocument();
    expect(screen.getByText('优先处理的 Issue')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '治理工作流' }));

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/governance'
      );
    });
  });

  it('应允许从概览触发 Discovery', async () => {
    const discoveryMutation = createMutationResult();
    vi.mocked(useGovernanceRunDiscoveryMutation).mockReturnValue(discoveryMutation);

    const { user } = renderProjectDashboardPage();

    await user.click(screen.getByRole('button', { name: '运行 Discovery' }));

    await waitFor(() => {
      expect(discoveryMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('Project 不存在时应展示空态，并允许返回 Projects', async () => {
    const goToProjects = vi.fn();
    vi.mocked(useProjectPageData).mockReturnValue({
      id: 'project-missing',
      project: null,
      projects: [createProject()],
      isLoading: false,
      isNotFound: true,
      goToProjects,
      goToProjectTab: vi.fn()
    });

    const { user } = renderProjectDashboardPage();

    expect(screen.getByText('Project 不存在')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '返回 Projects' }));

    expect(goToProjects).toHaveBeenCalledTimes(1);
  });
});
