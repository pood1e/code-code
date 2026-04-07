import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceChangePlanStatus,
  GovernanceChangeUnitStatus,
  GovernanceExecutionMode,
  GovernanceExecutionAttemptStatus,
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
  type GovernanceScopeOverview
} from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { GovernanceOrchestrationBoard } from './GovernanceOrchestrationBoard';

vi.mock('./GovernanceSessionHistorySheet', () => ({
  GovernanceSessionHistorySheet: ({
    title,
    triggerLabel = '查看日志'
  }: {
    title: string;
    triggerLabel?: string;
  }) => <button type="button">{`${triggerLabel}:${title}`}</button>
}));

function createAttempt(
  stageType: GovernanceAutomationStage,
  subjectType: GovernanceAutomationSubjectType,
  subjectId: string,
  status: GovernanceExecutionAttemptStatus,
  sessionId: string | null
): GovernanceExecutionAttemptSummary {
  return {
    id: `${stageType}-${subjectId}`,
    stageType,
    subjectType,
    subjectId,
    attemptNo: 1,
    status,
    sessionId,
    activeRequestMessageId: `message-${stageType}-${subjectId}`,
    failureCode: null,
    failureMessage: null,
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function createOverview(): GovernanceScopeOverview {
  return {
    scopeId: 'project-1',
    repositoryProfile: null,
    latestBaselineAttempt: createAttempt(
      GovernanceAutomationStage.Baseline,
      GovernanceAutomationSubjectType.Scope,
      'project-1',
      GovernanceExecutionAttemptStatus.Succeeded,
      'session-baseline'
    ),
    latestDiscoveryAttempt: createAttempt(
      GovernanceAutomationStage.Discovery,
      GovernanceAutomationSubjectType.Scope,
      'project-1',
      GovernanceExecutionAttemptStatus.Running,
      'session-discovery'
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
    title: '发现重复逻辑',
    summary: '需要 triage',
    evidence: [],
    categories: ['clean_code'],
    tags: [],
    affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
    status: GovernanceFindingStatus.Pending,
    latestTriageAttempt: createAttempt(
      GovernanceAutomationStage.Triage,
      GovernanceAutomationSubjectType.Finding,
      'finding-1',
      GovernanceExecutionAttemptStatus.NeedsHumanReview,
      'session-triage'
    ),
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function createIssue(): GovernanceIssueSummary {
  return {
    id: 'issue-1',
    scopeId: 'project-1',
    title: '治理工作流需要收敛',
    statement: '当前页面职责混杂',
    kind: GovernanceIssueKind.Improvement,
    categories: ['governance'],
    tags: [],
    relatedFindingIds: ['finding-1'],
    status: GovernanceIssueStatus.Open,
    affectedTargets: [{ kind: 'file', ref: 'src/governance.tsx' }],
    impactSummary: '影响治理扫描效率',
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z',
    relatedFindingCount: 1,
    latestAssessment: null,
    latestResolutionDecision: null,
    latestChangePlanStatus: GovernanceChangePlanStatus.Draft,
    latestPlanningAttempt: createAttempt(
      GovernanceAutomationStage.Planning,
      GovernanceAutomationSubjectType.Issue,
      'issue-1',
      GovernanceExecutionAttemptStatus.Running,
      'session-planning'
    )
  };
}

function createChangeUnit(): ChangeUnit {
  return {
    id: 'change-unit-1',
    changePlanId: 'plan-1',
    issueId: 'issue-1',
    sourceActionId: 'action-1',
    dependsOnUnitIds: [],
    title: '执行治理改造',
    description: '进入 execution',
    scope: {
      targets: [{ kind: 'file', ref: 'src/governance.tsx' }],
      violationPolicy: GovernanceViolationPolicy.Warn
    },
    executionMode: GovernanceExecutionMode.SemiAuto,
    maxRetries: 1,
    currentAttemptNo: 1,
    status: GovernanceChangeUnitStatus.Running,
    producedCommitIds: [],
    latestExecutionAttempt: createAttempt(
      GovernanceAutomationStage.Execution,
      GovernanceAutomationSubjectType.ChangeUnit,
      'change-unit-1',
      GovernanceExecutionAttemptStatus.Running,
      'session-execution'
    ),
    latestVerificationResult: null,
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function createReviewQueueItem(
  sessionId: string | null = null
): GovernanceReviewQueueItem {
  return {
    kind: GovernanceReviewQueueItemKind.DeliveryArtifact,
    scopeId: 'project-1',
    subjectId: 'artifact-1',
    issueId: 'issue-1',
    title: '等待人工 review',
    status: 'needs_human_review',
    failureCode: null,
    failureMessage: '等待审批',
    sessionId,
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

describe('GovernanceOrchestrationBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary 模式应仅展示阶段摘要，不展示运行中 agent 面板', () => {
    renderWithProviders(
      <GovernanceOrchestrationBoard
        scopeId="project-1"
        projectName="code-code"
        overview={createOverview()}
        reviewQueue={[createReviewQueueItem(null)]}
        findings={[createFinding()]}
        issues={[createIssue()]}
        changeUnits={[createChangeUnit()]}
        deliveryArtifacts={[]}
        mode="summary"
      />
    );

    expect(screen.getByText('Baseline')).toBeInTheDocument();
    expect(screen.queryByText('运行中 Agent')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '查看日志:code-code · Baseline 日志' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Review 日志/ })
    ).not.toBeInTheDocument();
  });

  it('workspace 模式应将运行状态并回阶段条，并保留当前 issue 上下文', () => {
    renderWithProviders(
      <GovernanceOrchestrationBoard
        scopeId="project-1"
        projectName="code-code"
        overview={createOverview()}
        reviewQueue={[createReviewQueueItem('session-review')]}
        findings={[createFinding()]}
        issues={[createIssue()]}
        selectedIssue={{
          ...createIssue(),
          relatedFindings: [createFinding()],
          changePlan: null,
          changeUnits: [createChangeUnit()],
          verificationPlans: [],
          verificationResults: [],
          planLevelVerificationResult: null,
          deliveryArtifact: null
        }}
        changeUnits={[createChangeUnit()]}
        deliveryArtifacts={[]}
      />
    );

    expect(screen.getByText('Baseline')).toBeInTheDocument();
    expect(screen.queryByText('运行中 Agent')).not.toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getAllByText('治理工作流需要收敛').length).toBeGreaterThan(0);
    expect(screen.getAllByText('执行治理改造').length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: '查看日志:code-code · Discovery 日志' })
        .length
    ).toBeGreaterThan(0);
  });
});
