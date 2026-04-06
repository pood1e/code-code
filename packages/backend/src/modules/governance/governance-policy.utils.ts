import {
  GovernanceAutoActionEligibility,
  GovernanceExecutionMode,
  type GovernanceIssueKind,
  type GovernancePolicy,
  type GovernancePriority,
  type GovernanceSeverity
} from '@agent-workbench/shared';

export function deriveGovernancePriority(input: {
  policy: Pick<GovernancePolicy, 'priorityPolicy'>;
  severity: GovernanceSeverity;
}): GovernancePriority {
  return (
    input.policy.priorityPolicy.severityOverrides?.[input.severity] ??
    input.policy.priorityPolicy.defaultPriority
  );
}

export function deriveGovernanceAutoActionEligibility(input: {
  policy: Pick<GovernancePolicy, 'autoActionPolicy'>;
  issueKind: GovernanceIssueKind;
  severity: GovernanceSeverity;
}): GovernanceAutoActionEligibility {
  return (
    input.policy.autoActionPolicy.issueKindOverrides?.[input.issueKind] ??
    input.policy.autoActionPolicy.severityOverrides?.[input.severity] ??
    input.policy.autoActionPolicy.defaultEligibility
  );
}

export function deriveGovernanceExecutionMode(input: {
  eligibility: GovernanceAutoActionEligibility;
  suggestedMode: GovernanceExecutionMode | undefined;
}): GovernanceExecutionMode {
  const suggestedMode =
    input.suggestedMode ?? GovernanceExecutionMode.SemiAuto;

  switch (input.eligibility) {
    case GovernanceAutoActionEligibility.Forbidden:
    case GovernanceAutoActionEligibility.SuggestOnly:
      return GovernanceExecutionMode.Manual;
    case GovernanceAutoActionEligibility.HumanReviewRequired:
      return suggestedMode === GovernanceExecutionMode.Auto
        ? GovernanceExecutionMode.SemiAuto
        : suggestedMode;
    case GovernanceAutoActionEligibility.AutoAllowed:
      return suggestedMode;
  }
}
