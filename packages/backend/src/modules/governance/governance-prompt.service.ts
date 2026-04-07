import { Injectable } from '@nestjs/common';

import type {
  GovernanceAutomationStage,
  GovernancePolicy,
  GovernanceScopeOverview,
  GovernanceIssueSummary,
  RepositoryProfile
} from '@agent-workbench/shared';

type DiscoveryPromptInput = {
  scopeId: string;
  repositoryProfile: RepositoryProfile | null;
  candidateIssues: GovernanceIssueSummary[];
  overview: GovernanceScopeOverview;
  policy: GovernancePolicy;
  attemptNo: number;
};

type TriagePromptInput = {
  finding: Record<string, unknown>;
  scopeId: string;
  candidateIssues: GovernanceIssueSummary[];
  repositoryProfile: RepositoryProfile | null;
  policy: GovernancePolicy;
  attemptNo: number;
};

type PlanningPromptInput = {
  issue: Record<string, unknown>;
  repositoryProfile: RepositoryProfile | null;
  policy: GovernancePolicy;
  baselineCommitSha: string;
  attemptNo: number;
};

type ExecutionPromptInput = {
  issue: Record<string, unknown>;
  changePlan: Record<string, unknown>;
  changeUnit: Record<string, unknown>;
  policy: GovernancePolicy;
  baselineCommitSha: string;
  attemptNo: number;
};

@Injectable()
export class GovernancePromptService {
  buildDiscoveryPrompt(input: DiscoveryPromptInput) {
    const inputSnapshot = {
      scopeId: input.scopeId,
      repositoryProfile: input.repositoryProfile,
      overview: input.overview,
      policy: toPolicyPromptContext(input.policy),
      candidateIssues: input.candidateIssues.map((issue) => ({
        id: issue.id,
        title: issue.title,
        status: issue.status,
        categories: issue.categories,
        affectedTargets: issue.affectedTargets
      })),
      attemptNo: input.attemptNo
    };

    return {
      inputSnapshot,
      prompt: [
        'You are discovering governance findings for the provided software project.',
        'Return only a single fenced code block using `json governance-output`.',
        'Do not include prose before or after the fence.',
        'Produce high-signal findings only. Do not repeat already-covered issues.',
        'Do not dismiss or merge findings. Discovery only proposes raw findings.',
        'Prefer actionable targets such as files, packages, services, APIs, or screens.',
        'Respect the project policy when judging severity, priority, and automation readiness.',
        'GOVERNANCE_STAGE:discovery',
        'GOVERNANCE_INPUT_JSON_START',
        JSON.stringify(inputSnapshot, null, 2),
        'GOVERNANCE_INPUT_JSON_END'
      ].join('\n')
    };
  }

  buildTriagePrompt(input: TriagePromptInput) {
    const inputSnapshot = {
      scopeId: input.scopeId,
      finding: input.finding,
      repositoryProfile: input.repositoryProfile,
      policy: toPolicyPromptContext(input.policy),
      candidateIssues: input.candidateIssues.map((issue) => ({
        id: issue.id,
        title: issue.title,
        status: issue.status,
        kind: issue.kind,
        categories: issue.categories,
        affectedTargets: issue.affectedTargets,
        latestAssessment: issue.latestAssessment
          ? {
              priority: issue.latestAssessment.priority,
              severity: issue.latestAssessment.severity
            }
          : null,
        latestResolutionDecision: issue.latestResolutionDecision
          ? {
              resolution: issue.latestResolutionDecision.resolution
            }
          : null
      })),
      attemptNo: input.attemptNo
    };

    return {
      inputSnapshot,
      prompt: [
        'You are triaging a governance finding into the issue backlog.',
        'Return only a single fenced code block using `json governance-output`.',
        'Do not include prose before or after the fence.',
        'Choose exactly one action: `create_issue` or `merge_into_issue`.',
        'Do not dismiss the finding. Human review handles dismissals.',
        'The project policy is authoritative for priority and auto-action eligibility.',
        'When creating a new issue or assessment refresh, align `priority` and `autoActionEligibility` with the provided policy overrides.',
        'GOVERNANCE_STAGE:triage',
        'GOVERNANCE_INPUT_JSON_START',
        JSON.stringify(inputSnapshot, null, 2),
        'GOVERNANCE_INPUT_JSON_END'
      ].join('\n')
    };
  }

  buildPlanningPrompt(input: PlanningPromptInput) {
    const inputSnapshot = {
      issue: input.issue,
      repositoryProfile: input.repositoryProfile,
      policy: toPolicyPromptContext(input.policy),
      baselineCommitSha: input.baselineCommitSha,
      attemptNo: input.attemptNo
    };

    return {
      inputSnapshot,
      prompt: [
        'You are generating a governance change plan for the provided issue.',
        'Return only a single fenced code block using `json governance-output`.',
        'Do not include prose before or after the fence.',
        'Produce one draft plan with concrete actions, change units, and verification plans.',
        'Do not include baselineCommitSha in the output. The backend owns it.',
        'Respect the project policy when choosing automation level, risk posture, and delivery shape.',
        'Keep change units scoped tightly enough to fit the delivery policy and auto-action constraints.',
        'GOVERNANCE_STAGE:planning',
        'GOVERNANCE_INPUT_JSON_START',
        JSON.stringify(inputSnapshot, null, 2),
        'GOVERNANCE_INPUT_JSON_END'
      ].join('\n')
    };
  }

  buildExecutionPrompt(input: ExecutionPromptInput) {
    const inputSnapshot = {
      issue: input.issue,
      changePlan: input.changePlan,
      changeUnit: input.changeUnit,
      policy: toPolicyPromptContext(input.policy),
      baselineCommitSha: input.baselineCommitSha,
      attemptNo: input.attemptNo
    };

    return {
      inputSnapshot,
      prompt: [
        'You are executing a governance change unit inside the project workspace.',
        'Apply the requested change only within the scoped targets.',
        'Respect the project policy, especially delivery commit mode and automation boundaries.',
        'Do not explain the plan. Make the workspace change directly if the runner supports tools.',
        'After finishing, reply with a short summary of what changed.',
        'GOVERNANCE_STAGE:execution',
        'GOVERNANCE_INPUT_JSON_START',
        JSON.stringify(inputSnapshot, null, 2),
        'GOVERNANCE_INPUT_JSON_END'
      ].join('\n')
    };
  }

  buildRepairPrompt(
    stageType: GovernanceAutomationStage,
    errorMessage: string
  ) {
    return [
      `The previous ${stageType} output could not be parsed.`,
      `Parser error: ${errorMessage}`,
      'Please resend only one fenced code block using `json governance-output` with valid JSON.',
      `GOVERNANCE_STAGE:${stageType}`
    ].join('\n');
  }
}

function toPolicyPromptContext(policy: GovernancePolicy) {
  return {
    priorityPolicy: policy.priorityPolicy,
    autoActionPolicy: policy.autoActionPolicy,
    deliveryPolicy: policy.deliveryPolicy,
    sourceSelection: policy.sourceSelection,
    agentStrategy: policy.agentStrategy
  };
}
