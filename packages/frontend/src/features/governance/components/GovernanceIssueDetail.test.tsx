import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GovernanceDeliveryCommitMode,
  GovernanceDeliveryArtifactKind,
  GovernanceDeliveryArtifactStatus,
  GovernanceDeliveryBodyStrategy,
  GovernanceAssessmentSource,
  GovernanceAutoActionEligibility,
  GovernanceChangeUnitStatus,
  GovernanceExecutionMode,
  GovernanceFindingSource,
  GovernanceFindingStatus,
  GovernanceIssueKind,
  GovernanceIssueStatus,
  GovernancePriority,
  GovernanceSeverity,
  GovernanceViolationPolicy,
  type GovernancePolicy,
  type GovernanceIssueDetail
} from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { GovernanceIssueDetail as GovernanceIssueDetailPanel } from './GovernanceIssueDetail';

const resolutionMutateAsync = vi.fn();
const reviewMutateAsync = vi.fn();

vi.mock('../hooks/use-governance-mutations', () => ({
  useGovernanceResolutionDecisionMutation: () => ({
    mutateAsync: resolutionMutateAsync,
    isPending: false
  }),
  useGovernanceRetryPlanningMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  }),
  useGovernanceReviewDecisionMutation: () => ({
    mutateAsync: reviewMutateAsync,
    isPending: false
  })
}));

function createIssue(): GovernanceIssueDetail {
  return {
    id: 'issue-1',
    scopeId: 'project-1',
    title: '重复判空逻辑',
    statement: '同一模块存在重复判空逻辑',
    kind: GovernanceIssueKind.Debt,
    categories: ['clean_code'],
    tags: ['duplication'],
    relatedFindingIds: ['finding-1'],
    status: GovernanceIssueStatus.Open,
    affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
    impactSummary: '增加维护成本',
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z',
    latestAssessment: {
      id: 'assessment-1',
      issueId: 'issue-1',
      severity: GovernanceSeverity.Medium,
      priority: GovernancePriority.P2,
      userImpact: 2,
      systemRisk: 3,
      strategicValue: 4,
      fixCost: 2,
      autoActionEligibility: GovernanceAutoActionEligibility.HumanReviewRequired,
      rationale: ['重复逻辑会继续扩散'],
      assessedBy: GovernanceAssessmentSource.Agent,
      assessedAt: '2026-04-06T10:00:00.000Z',
      createdAt: '2026-04-06T10:00:00.000Z'
    },
    latestResolutionDecision: null,
    latestPlanningAttempt: null,
    relatedFindings: [
      {
        id: 'finding-1',
        scopeId: 'project-1',
        source: GovernanceFindingSource.AgentReview,
        title: '误报 candidate',
        summary: '有一条可 dismiss 的 finding',
        evidence: [{ kind: 'file', ref: 'src/service.ts' }],
        categories: ['clean_code'],
        tags: [],
        affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
        status: GovernanceFindingStatus.Pending,
        latestTriageAttempt: null,
        createdAt: '2026-04-06T10:00:00.000Z',
        updatedAt: '2026-04-06T10:00:00.000Z'
      }
    ],
    changePlan: null,
    changeUnits: [],
    verificationPlans: [],
    verificationResults: [],
    planLevelVerificationResult: null,
    deliveryArtifact: null
  };
}

function createIssueTwo(): GovernanceIssueDetail {
  return {
    ...createIssue(),
    id: 'issue-2',
    title: '测试缺口',
    statement: '缺少关键路径单测',
    spinOffOfIssueId: 'issue-1',
    latestAssessment: {
      ...createIssue().latestAssessment!,
      id: 'assessment-2'
    },
    relatedFindings: [
      {
        ...createIssue().relatedFindings[0]!,
        id: 'finding-2',
        title: '缺少测试',
        summary: '需要补测试'
      }
    ]
  };
}

function createManualReadyIssue(): GovernanceIssueDetail {
  return {
    ...createIssue(),
    id: 'issue-manual',
    status: GovernanceIssueStatus.Blocked,
    changeUnits: [
      {
        id: 'change-unit-1',
        changePlanId: 'plan-1',
        issueId: 'issue-manual',
        sourceActionId: 'action-1',
        dependsOnUnitIds: [],
        title: '手工修复单元',
        description: '需要人工先修改工作区再继续验证',
        scope: {
          targets: [{ kind: 'file', ref: 'src/service.ts' }],
          violationPolicy: GovernanceViolationPolicy.Warn
        },
        executionMode: GovernanceExecutionMode.Manual,
        maxRetries: 1,
        currentAttemptNo: 0,
        status: GovernanceChangeUnitStatus.Ready,
        producedCommitIds: [],
        createdAt: '2026-04-06T10:00:00.000Z',
        updatedAt: '2026-04-06T10:00:00.000Z'
      }
    ],
    deliveryArtifact: {
      id: 'artifact-1',
      kind: GovernanceDeliveryArtifactKind.ReviewRequest,
      title: 'Governance review: 重复判空逻辑',
      body: 'delivery rejected',
      linkedIssueIds: ['issue-manual'],
      linkedChangeUnitIds: ['change-unit-1'],
      linkedVerificationResultIds: [],
      bodyStrategy: GovernanceDeliveryBodyStrategy.AutoAggregate,
      status: GovernanceDeliveryArtifactStatus.Closed,
      createdAt: '2026-04-06T10:00:00.000Z'
    }
  };
}

function createPolicy(): GovernancePolicy {
  return {
    id: 'policy-1',
    scopeId: 'project-1',
    priorityPolicy: {
      defaultPriority: GovernancePriority.P1
    },
    autoActionPolicy: {
      defaultEligibility: GovernanceAutoActionEligibility.SuggestOnly
    },
    deliveryPolicy: {
      commitMode: GovernanceDeliveryCommitMode.Squash,
      autoCloseIssueOnApprovedDelivery: false
    },
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z'
  };
}

describe('GovernanceIssueDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应展示 issue 信息并支持提交 duplicate resolution', async () => {
    const { user } = renderWithProviders(
      <GovernanceIssueDetailPanel
        scopeId="project-1"
        issueId="issue-1"
        issue={createIssue()}
        isLoading={false}
        policy={createPolicy()}
      />
    );

    expect(screen.getByText('重复判空逻辑')).toBeInTheDocument();
    expect(screen.getByText('同一模块存在重复判空逻辑')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('Resolution'),
      'duplicate'
    );
    await user.type(screen.getByLabelText('Reason'), '与主 issue 重复');
    await user.type(
      screen.getByLabelText('Primary Issue ID'),
      'issue-master'
    );
    await user.click(screen.getByRole('button', { name: '提交 Resolution' }));

    expect(resolutionMutateAsync).toHaveBeenCalledWith({
      resolution: 'duplicate',
      reason: '与主 issue 重复',
      primaryIssueId: 'issue-master'
    });
  });

  it('切换 issue 时应重置表单输入', async () => {
    const { user, rerender } = renderWithProviders(
      <GovernanceIssueDetailPanel
        scopeId="project-1"
        issueId="issue-1"
        issue={createIssue()}
        isLoading={false}
        policy={createPolicy()}
      />
    );

    await user.type(screen.getByLabelText('Reason'), '待清空内容');
    await user.type(
      screen.getByLabelText('Reviewer', { selector: '#governance-finding-reviewer' }),
      'reviewer-a'
    );

    rerender(
      <GovernanceIssueDetailPanel
        scopeId="project-1"
        issueId="issue-2"
        issue={createIssueTwo()}
        isLoading={false}
        policy={createPolicy()}
      />
    );

    expect(screen.getByLabelText('Reason')).toHaveValue('');
    expect(
      screen.getByLabelText('Reviewer', { selector: '#governance-finding-reviewer' })
    ).toHaveValue('');
    expect(screen.getByText('测试缺口')).toBeInTheDocument();
  });

  it('应展示 spin-off 来源 issue', () => {
    renderWithProviders(
      <GovernanceIssueDetailPanel
        scopeId="project-1"
        issueId="issue-2"
        issue={createIssueTwo()}
        isLoading={false}
        policy={createPolicy()}
      />
    );

    expect(screen.getByText('spin-off')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'issue-1' })
    ).toHaveAttribute('href', '/projects/project-1/governance/issue-1');
  });

  it('应展示 policy 推导结果与 commit mode', () => {
    renderWithProviders(
      <GovernanceIssueDetailPanel
        scopeId="project-1"
        issueId="issue-1"
        issue={createIssue()}
        isLoading={false}
        policy={createPolicy()}
      />
    );

    expect(
      screen.getByText('priority p1 · eligibility suggest_only · commit squash')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/当前 commit mode: squash/)
    ).toBeInTheDocument();
  });

  it('manual ready change unit 应提示使用 Edit & Continue 且不展示 Approve Unit', () => {
    renderWithProviders(
      <GovernanceIssueDetailPanel
        scopeId="project-1"
        issueId="issue-manual"
        issue={createManualReadyIssue()}
        isLoading={false}
        policy={createPolicy()}
      />
    );

    expect(
      screen.getByText(/已被 policy 降级为 manual/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit & Continue' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve Unit' })
    ).not.toBeInTheDocument();
  });

  it('应展示 blocked 与 delivery reject 的状态提示', () => {
    renderWithProviders(
      <GovernanceIssueDetailPanel
        scopeId="project-1"
        issueId="issue-manual"
        issue={createManualReadyIssue()}
        isLoading={false}
        policy={createPolicy()}
      />
    );

    expect(
      screen.getByText(/当前 issue 已 blocked/)
    ).toBeInTheDocument();
  });
});
