import {
  GovernanceAutoActionEligibility,
  GovernanceExecutionMode,
  type GovernanceIssueDetail,
  GovernanceIssueStatus,
  type GovernancePolicy,
  type GovernancePriority,
  type GovernanceSeverity
} from '@agent-workbench/shared';

import { Badge } from '@/components/ui/badge';

export function getGovernancePolicyAssessment(input: {
  issue: GovernanceIssueDetail;
  policy?: GovernancePolicy;
}) {
  if (!input.issue.latestAssessment || !input.policy) {
    return null;
  }

  return {
    priority: deriveGovernancePriority({
      policy: input.policy,
      severity: input.issue.latestAssessment.severity
    }),
    autoActionEligibility: deriveGovernanceAutoActionEligibility({
      policy: input.policy,
      issueKind: input.issue.kind,
      severity: input.issue.latestAssessment.severity
    })
  };
}

export function GovernanceIssueStatusNotice(input: {
  issue: GovernanceIssueDetail;
}) {
  const message = getIssueStatusNotice(input.issue);
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function GovernanceChangeUnitExecutionCard(input: {
  issue: GovernanceIssueDetail;
  changeUnit: GovernanceIssueDetail['changeUnits'][number];
  policy?: GovernancePolicy;
}) {
  const effectiveExecutionMode =
    input.policy && input.issue.latestAssessment
      ? deriveGovernanceExecutionMode({
          eligibility: deriveGovernanceAutoActionEligibility({
            policy: input.policy,
            issueKind: input.issue.kind,
            severity: input.issue.latestAssessment.severity
          }),
          suggestedMode: input.changeUnit.executionMode
        })
      : input.changeUnit.executionMode;

  return (
    <div className="rounded-2xl border border-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {input.changeUnit.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {input.changeUnit.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{input.changeUnit.status}</Badge>
          <Badge variant="secondary">{effectiveExecutionMode}</Badge>
          {input.changeUnit.latestExecutionAttempt ? (
            <Badge variant="secondary">
              exec #{input.changeUnit.latestExecutionAttempt.attemptNo}
            </Badge>
          ) : null}
        </div>
      </div>
      {effectiveExecutionMode !== input.changeUnit.executionMode ? (
        <p className="mt-2 text-xs text-muted-foreground">
          policy adjusted mode from {input.changeUnit.executionMode} to{' '}
          {effectiveExecutionMode}
        </p>
      ) : null}
      {input.changeUnit.latestExecutionAttempt?.failureMessage ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {input.changeUnit.latestExecutionAttempt.failureMessage}
        </p>
      ) : null}
      {input.changeUnit.latestVerificationResult ? (
        <p className="mt-2 text-xs text-muted-foreground">
          verification: {input.changeUnit.latestVerificationResult.status} ·{' '}
          {input.changeUnit.latestVerificationResult.summary}
        </p>
      ) : null}
      {input.changeUnit.producedCommitIds.length > 0 ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          commits: {input.changeUnit.producedCommitIds.join(', ')}
        </p>
      ) : null}
    </div>
  );
}

function deriveGovernancePriority(input: {
  policy: Pick<GovernancePolicy, 'priorityPolicy'>;
  severity: GovernanceSeverity;
}): GovernancePriority {
  return (
    input.policy.priorityPolicy.severityOverrides?.[input.severity] ??
    input.policy.priorityPolicy.defaultPriority
  );
}

function deriveGovernanceAutoActionEligibility(input: {
  policy: Pick<GovernancePolicy, 'autoActionPolicy'>;
  issueKind: GovernanceIssueDetail['kind'];
  severity: GovernanceSeverity;
}): GovernanceAutoActionEligibility {
  return (
    input.policy.autoActionPolicy.issueKindOverrides?.[input.issueKind] ??
    input.policy.autoActionPolicy.severityOverrides?.[input.severity] ??
    input.policy.autoActionPolicy.defaultEligibility
  );
}

function deriveGovernanceExecutionMode(input: {
  eligibility: GovernanceAutoActionEligibility;
  suggestedMode: GovernanceExecutionMode;
}): GovernanceExecutionMode {
  switch (input.eligibility) {
    case GovernanceAutoActionEligibility.Forbidden:
    case GovernanceAutoActionEligibility.SuggestOnly:
      return GovernanceExecutionMode.Manual;
    case GovernanceAutoActionEligibility.HumanReviewRequired:
      return input.suggestedMode === GovernanceExecutionMode.Auto
        ? GovernanceExecutionMode.SemiAuto
        : input.suggestedMode;
    case GovernanceAutoActionEligibility.AutoAllowed:
      return input.suggestedMode;
  }
}

function getIssueStatusNotice(issue: GovernanceIssueDetail) {
  switch (issue.status) {
    case GovernanceIssueStatus.Blocked:
      return '当前 issue 已 blocked。通常意味着验证失败、scope 漂移，或存在需要人工处理的 change unit。';
    case GovernanceIssueStatus.IntegrationFailed:
      return '计划级验证失败。修正后可对相关 change unit 使用 Edit & Continue，或在工作区完成修复后继续推进。';
    case GovernanceIssueStatus.InReview:
      return issue.deliveryArtifact?.status === 'closed'
        ? '交付审批被拒绝，issue 已回到 in_review。修正交付内容后可再次提交 delivery artifact。'
        : '所有活跃 change unit 已完成验证，当前等待最终交付审批。';
    case GovernanceIssueStatus.Resolved:
      return issue.deliveryArtifact?.status === 'submitted'
        ? '交付物已生成并待审批。当前 issue 已 resolved，但尚未最终 closed。'
        : '当前 issue 已 resolved。';
    case GovernanceIssueStatus.PartiallyResolved:
      return issue.spinOffOfIssueId
        ? '这是由部分交付产生的 follow-up spin-off issue。'
        : '当前 issue 仅部分解决。未完成单元会在交付后派生 spin-off issue 继续处理。';
    default:
      return null;
  }
}
