import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  type GovernancePolicy,
  type GovernanceIssueDetail,
  GovernanceIssueStatus
} from '@agent-workbench/shared';

import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import {
  getGovernancePolicyAssessment,
  GovernanceIssueStatusNotice
} from '@/features/governance/components/governance-issue-detail.support';
import {
  GovernanceAssessmentOverrideSection,
  GovernanceAutomationSection,
  GovernanceExecutionDeliverySection,
  GovernanceIssueInfoBlock,
  GovernanceRelatedFindingsSection,
  GovernanceResolutionSection,
  GovernanceReviewActionsSection
} from '@/features/governance/components/governance-issue-detail.sections';
import { useGovernanceIssueDetailFormState } from '@/features/governance/components/use-governance-issue-detail-form-state';
import {
  useGovernanceResolutionDecisionMutation,
  useGovernanceRetryPlanningMutation,
  useGovernanceReviewDecisionMutation
} from '@/features/governance/hooks/use-governance-mutations';
import { buildProjectGovernancePath } from '@/types/projects';

type GovernanceIssueDetailProps = {
  scopeId: string;
  issueId: string;
  issue: GovernanceIssueDetail | undefined;
  isLoading: boolean;
  policy?: GovernancePolicy;
  selectedStatus?: GovernanceIssueStatus;
};

export function GovernanceIssueDetail({
  scopeId,
  issueId,
  issue,
  isLoading,
  policy,
  selectedStatus
}: GovernanceIssueDetailProps) {
  const resolutionMutation = useGovernanceResolutionDecisionMutation(
    issueId,
    scopeId,
    selectedStatus
  );
  const reviewMutation = useGovernanceReviewDecisionMutation(
    scopeId,
    issueId,
    selectedStatus
  );
  const retryPlanningMutation = useGovernanceRetryPlanningMutation(
    scopeId,
    issueId
  );
  const {
    resolutionForm,
    assessmentOverrideForm,
    findingDismissForm,
    changePlanReviewForm,
    changeUnitReviewForm,
    deliveryReviewForm,
    resolution,
    pendingFindings,
    actionableChangeUnits,
    selectedChangeUnit,
    isSelectedChangeUnitManualReady,
    resolutionError,
    setResolutionError,
    assessmentError,
    setAssessmentError,
    dismissError,
    setDismissError,
    changePlanError,
    setChangePlanError,
    planningError,
    setPlanningError,
    changeUnitError,
    setChangeUnitError,
    deliveryError,
    setDeliveryError
  } = useGovernanceIssueDetailFormState(issue);
  const policyDerivedAssessment = useMemo(() => {
    if (!issue) {
      return null;
    }
    return getGovernancePolicyAssessment({ issue, policy });
  }, [issue, policy]);
  const deliveryCommitMode = policy?.deliveryPolicy.commitMode ?? null;

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (!issue) {
    return (
      <EmptyState
        title="选择一个 Issue"
        description="从左侧 backlog 选择 Issue 后，这里会展示评估、方案和审批动作。"
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <SurfaceCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge>{issue.status}</Badge>
                <Badge variant="outline">{issue.kind}</Badge>
                {issue.spinOffOfIssueId ? (
                  <Badge variant="secondary">spin-off</Badge>
                ) : null}
                {issue.latestAssessment ? (
                  <>
                    <Badge variant="secondary">
                      {issue.latestAssessment.priority}
                    </Badge>
                    <Badge variant="outline">
                      {issue.latestAssessment.severity}
                    </Badge>
                  </>
                ) : null}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {issue.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {issue.statement}
                </p>
              </div>
            </div>
          </div>

          <GovernanceIssueStatusNotice issue={issue} />

          <div className="grid gap-4 md:grid-cols-2">
            <GovernanceIssueInfoBlock
              label="Impact Summary"
              value={issue.impactSummary}
            />
            <GovernanceIssueInfoBlock
              label="Latest Resolution"
              value={
                issue.latestResolutionDecision
                  ? `${issue.latestResolutionDecision.resolution} · ${issue.latestResolutionDecision.reason}`
                  : '尚未决策'
              }
            />
            <GovernanceIssueInfoBlock
              label="Categories"
              value={issue.categories.join(', ') || '未分类'}
            />
            <GovernanceIssueInfoBlock
              label="Targets"
              value={
                issue.affectedTargets.map((target) => target.ref).join(', ') ||
                '无'
              }
            />
            {policyDerivedAssessment ? (
              <GovernanceIssueInfoBlock
                label="Policy"
                value={`priority ${policyDerivedAssessment.priority} · eligibility ${policyDerivedAssessment.autoActionEligibility} · commit ${deliveryCommitMode ?? 'n/a'}`}
              />
            ) : null}
            {issue.spinOffOfIssueId ? (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Spin-off Source
                </p>
                <Link
                  className="mt-2 inline-flex text-sm font-medium text-primary"
                  to={buildProjectGovernancePath(scopeId, issue.spinOffOfIssueId)}
                >
                  {issue.spinOffOfIssueId}
                </Link>
              </div>
            ) : null}
          </div>
        </SurfaceCard>

        <GovernanceExecutionDeliverySection
          issue={issue}
          policy={policy}
          deliveryCommitMode={deliveryCommitMode}
          reviewMutation={reviewMutation}
          actionableChangeUnits={actionableChangeUnits}
          selectedChangeUnit={selectedChangeUnit}
          isSelectedChangeUnitManualReady={isSelectedChangeUnitManualReady}
          changeUnitReviewForm={changeUnitReviewForm}
          deliveryReviewForm={deliveryReviewForm}
          changeUnitError={changeUnitError}
          setChangeUnitError={setChangeUnitError}
          deliveryError={deliveryError}
          setDeliveryError={setDeliveryError}
        />

        <GovernanceAutomationSection
          issue={issue}
          retryPlanningMutation={retryPlanningMutation}
          planningError={planningError}
          setPlanningError={setPlanningError}
        />

        <GovernanceResolutionSection
          resolutionForm={resolutionForm}
          resolution={resolution}
          resolutionMutation={resolutionMutation}
          resolutionError={resolutionError}
          setResolutionError={setResolutionError}
        />

        <GovernanceAssessmentOverrideSection
          issue={issue}
          reviewMutation={reviewMutation}
          assessmentOverrideForm={assessmentOverrideForm}
          assessmentError={assessmentError}
          setAssessmentError={setAssessmentError}
        />

        <GovernanceReviewActionsSection
          issue={issue}
          pendingFindings={pendingFindings}
          reviewMutation={reviewMutation}
          findingDismissForm={findingDismissForm}
          changePlanReviewForm={changePlanReviewForm}
          dismissError={dismissError}
          setDismissError={setDismissError}
          changePlanError={changePlanError}
          setChangePlanError={setChangePlanError}
        />

        <GovernanceRelatedFindingsSection issue={issue} />
      </div>
    </div>
  );
}
