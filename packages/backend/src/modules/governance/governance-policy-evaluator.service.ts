import { Injectable } from '@nestjs/common';

import {
  type GovernanceAssessmentSource,
  type GovernanceAutoActionEligibility,
  deriveGovernanceAutoActionEligibility,
  deriveGovernanceExecutionMode,
  deriveGovernancePriority,
  GovernanceExecutionMode,
  type GovernancePolicy,
  type GovernancePlanningOutput,
  type GovernancePriority,
  type GovernanceIssueKind,
  type GovernanceSeverity
} from '@agent-workbench/shared';

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
    const priority = deriveGovernancePriority(
      input.policy,
      input.assessment.severity
    );
    const autoActionEligibility = deriveGovernanceAutoActionEligibility(
      input.policy,
      input.issueKind,
      input.assessment.severity
    );

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
    return deriveGovernanceAutoActionEligibility(
      input.policy,
      input.issueKind,
      input.severity
    );
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
        executionMode: deriveGovernanceExecutionMode(
          eligibility,
          unit.executionMode ?? GovernanceExecutionMode.SemiAuto
        )
      }))
    };
  }
}
