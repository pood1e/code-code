import { Injectable } from '@nestjs/common';

import {
  type GovernanceAssessmentSource,
  type GovernanceAutoActionEligibility,
  GovernanceExecutionMode,
  type GovernancePolicy,
  type GovernancePlanningOutput,
  type GovernancePriority,
  type GovernanceIssueKind,
  type GovernanceSeverity
} from '@agent-workbench/shared';

import {
  deriveGovernanceAutoActionEligibility,
  deriveGovernanceExecutionMode,
  deriveGovernancePriority
} from './governance-policy.utils';

@Injectable()
export class GovernancePolicyEvaluatorService {
  normalizeAssessment(input: {
    policy: GovernancePolicy;
    issueKind: GovernanceIssueKind;
    assessment: {
      severity: GovernanceSeverity;
      priority: GovernancePriority;
      autoActionEligibility: GovernanceAutoActionEligibility;
      userImpact: number;
      systemRisk: number;
      strategicValue: number;
      fixCost: number;
      rationale: string[];
      assessedBy: GovernanceAssessmentSource;
      assessedAt?: Date;
    };
  }) {
    const priority = deriveGovernancePriority({
      policy: input.policy,
      severity: input.assessment.severity
    });
    const autoActionEligibility = deriveGovernanceAutoActionEligibility({
      policy: input.policy,
      issueKind: input.issueKind,
      severity: input.assessment.severity
    });

    return {
      ...input.assessment,
      priority,
      autoActionEligibility
    };
  }

  deriveAutoActionEligibility(input: {
    policy: GovernancePolicy;
    issueKind: GovernanceIssueKind;
    severity: GovernanceSeverity;
  }) {
    return deriveGovernanceAutoActionEligibility({
      policy: input.policy,
      issueKind: input.issueKind,
      severity: input.severity
    });
  }

  normalizePlanningOutput(input: {
    policy: GovernancePolicy;
    issueKind: GovernanceIssueKind;
    severity: GovernanceSeverity;
    output: GovernancePlanningOutput;
  }): GovernancePlanningOutput {
    const eligibility = this.deriveAutoActionEligibility({
      policy: input.policy,
      issueKind: input.issueKind,
      severity: input.severity
    });

    return {
      ...input.output,
      changeUnits: input.output.changeUnits.map((unit) => ({
        ...unit,
        executionMode: deriveGovernanceExecutionMode({
          eligibility,
          suggestedMode: unit.executionMode
        })
      }))
    };
  }
}
