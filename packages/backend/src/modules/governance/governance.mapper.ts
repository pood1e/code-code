import type {
  ChangePlan,
  ChangeUnit,
  DeliveryArtifact,
  Finding,
  GovernancePolicy,
  GovernanceScopeOverview,
  GovernanceViolationPolicy,
  GovernanceIssueDetail,
  GovernanceIssueSummary,
  RepositoryProfile,
  GovernanceTargetRef,
  GovernanceVerificationCheck,
  GovernanceExecutionAttemptSummary,
  Issue,
  IssueAssessment,
  ResolutionDecision,
  VerificationResult,
  VerificationPlan
} from '@agent-workbench/shared';

import type {
  ChangePlanRecord,
  ChangeUnitRecord,
  DeliveryArtifactRecord,
  GovernanceExecutionAttemptRecord,
  GovernanceFindingRecord,
  GovernanceIssueDetailRecord,
  GovernanceIssueRecord,
  GovernancePolicyRecord,
  GovernanceScopeOverviewRecord,
  GovernanceIssueSummaryRecord,
  IssueAssessmentRecord,
  RepositoryProfileRecord,
  ResolutionDecisionRecord,
  VerificationResultRecord,
  VerificationPlanRecord
} from './governance.repository';

export function toFinding(record: GovernanceFindingRecord): Finding {
  return {
    id: record.id,
    scopeId: record.scopeId,
    source: record.source,
    ...(record.sourceRef ? { sourceRef: record.sourceRef } : {}),
    title: record.title,
    summary: record.summary,
    evidence: asArray(record.evidence),
    categories: asStringArray(record.categories),
    tags: asStringArray(record.tags),
    ...(record.severityHint ? { severityHint: record.severityHint } : {}),
    ...(record.confidence !== null ? { confidence: record.confidence } : {}),
    affectedTargets: asTargetRefArray(record.affectedTargets),
    ...(isRecord(record.metadata) ? { metadata: record.metadata } : {}),
    ...(record.fingerprint ? { fingerprint: record.fingerprint } : {}),
    discoveredAt: record.discoveredAt.toISOString(),
    status: record.status,
    latestTriageAttempt: record.latestTriageAttempt
      ? toGovernanceExecutionAttemptSummary(record.latestTriageAttempt)
      : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function toRepositoryProfile(
  record: RepositoryProfileRecord
): RepositoryProfile {
  return {
    id: record.id,
    scopeId: record.scopeId,
    branch: record.branch,
    snapshotAt: record.snapshotAt.toISOString(),
    modules: asRepositoryModules(record.modules),
    testBaseline: asRepositoryTestBaseline(record.testBaseline),
    buildStatus: record.buildStatus,
    ...(isRecord(record.metadata) ? { metadata: record.metadata } : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function toGovernanceScopeOverview(
  record: GovernanceScopeOverviewRecord
): GovernanceScopeOverview {
  return {
    scopeId: record.scopeId,
    repositoryProfile: record.repositoryProfile
      ? toRepositoryProfile(record.repositoryProfile)
      : null,
    latestBaselineAttempt: record.latestBaselineAttempt
      ? toGovernanceExecutionAttemptSummary(record.latestBaselineAttempt)
      : null,
    latestDiscoveryAttempt: record.latestDiscoveryAttempt
      ? toGovernanceExecutionAttemptSummary(record.latestDiscoveryAttempt)
      : null,
    findingCounts: record.findingCounts
  };
}

export function toGovernancePolicy(
  record: GovernancePolicyRecord
): GovernancePolicy {
  return {
    id: record.id,
    scopeId: record.scopeId,
    priorityPolicy: record.priorityPolicy,
    autoActionPolicy: record.autoActionPolicy,
    deliveryPolicy: record.deliveryPolicy,
    runnerSelection: record.runnerSelection,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function toGovernanceIssueSummary(
  record: GovernanceIssueSummaryRecord
): GovernanceIssueSummary {
  return {
    ...toIssue(record),
    relatedFindingCount: record.relatedFindingCount,
    latestAssessment: record.latestAssessment
      ? toIssueAssessment(record.latestAssessment)
      : null,
    latestResolutionDecision: record.latestResolutionDecision
      ? toResolutionDecision(record.latestResolutionDecision)
      : null,
    latestChangePlanStatus: record.latestChangePlanStatus,
    latestPlanningAttempt: record.latestPlanningAttempt
      ? toGovernanceExecutionAttemptSummary(record.latestPlanningAttempt)
      : null
  };
}

export function toGovernanceIssueDetail(
  record: GovernanceIssueDetailRecord
): GovernanceIssueDetail {
  return {
    ...toIssue(record),
    latestAssessment: record.latestAssessment
      ? toIssueAssessment(record.latestAssessment)
      : null,
    latestResolutionDecision: record.latestResolutionDecision
      ? toResolutionDecision(record.latestResolutionDecision)
      : null,
    relatedFindings: record.relatedFindings.map(toFinding),
    changePlan: record.changePlan ? toChangePlan(record.changePlan) : null,
    changeUnits: record.changeUnits.map(toChangeUnit),
    verificationPlans: record.verificationPlans.map(toVerificationPlan),
    verificationResults: record.verificationResults.map(toVerificationResult),
    planLevelVerificationResult: record.planLevelVerificationResult
      ? toVerificationResult(record.planLevelVerificationResult)
      : null,
    deliveryArtifact: record.deliveryArtifact
      ? toDeliveryArtifact(record.deliveryArtifact)
      : null,
    latestPlanningAttempt: record.latestPlanningAttempt
      ? toGovernanceExecutionAttemptSummary(record.latestPlanningAttempt)
      : null
  };
}

function toGovernanceExecutionAttemptSummary(
  record: GovernanceExecutionAttemptRecord
): GovernanceExecutionAttemptSummary {
  return {
    id: record.id,
    stageType: record.stageType,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    attemptNo: record.attemptNo,
    status: record.status,
    sessionId: record.sessionId,
    activeRequestMessageId: record.activeRequestMessageId,
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    updatedAt: record.updatedAt.toISOString()
  };
}

function toIssue(record: GovernanceIssueRecord): Issue {
  return {
    id: record.id,
    scopeId: record.scopeId,
    title: record.title,
    statement: record.statement,
    kind: record.kind,
    categories: asStringArray(record.categories),
    tags: asStringArray(record.tags),
    relatedFindingIds: asStringArray(record.relatedFindingIds),
    status: record.status,
    affectedTargets: asTargetRefArray(record.affectedTargets),
    ...(record.rootCause ? { rootCause: record.rootCause } : {}),
    impactSummary: record.impactSummary,
    ...(record.isRegression ? { isRegression: true } : {}),
    ...(record.regressionOfIssueId
      ? { regressionOfIssueId: record.regressionOfIssueId }
      : {}),
    ...(record.spinOffOfIssueId
      ? { spinOffOfIssueId: record.spinOffOfIssueId }
      : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toIssueAssessment(record: IssueAssessmentRecord): IssueAssessment {
  return {
    id: record.id,
    issueId: record.issueId,
    severity: record.severity,
    priority: record.priority,
    userImpact: record.userImpact,
    systemRisk: record.systemRisk,
    strategicValue: record.strategicValue,
    fixCost: record.fixCost,
    autoActionEligibility: record.autoActionEligibility,
    rationale: asStringArray(record.rationale),
    assessedBy: record.assessedBy,
    assessedAt: record.assessedAt.toISOString(),
    createdAt: record.createdAt.toISOString()
  };
}

function toResolutionDecision(
  record: ResolutionDecisionRecord
): ResolutionDecision {
  return {
    id: record.id,
    issueId: record.issueId,
    resolution: record.resolution,
    reason: record.reason,
    ...(record.deferUntil ? { deferUntil: record.deferUntil.toISOString() } : {}),
    ...(record.primaryIssueId ? { primaryIssueId: record.primaryIssueId } : {}),
    ...(record.approvedBy ? { approvedBy: record.approvedBy } : {}),
    decidedAt: record.decidedAt.toISOString(),
    createdAt: record.createdAt.toISOString()
  };
}

function toChangePlan(record: ChangePlanRecord): ChangePlan {
  return {
    id: record.id,
    issueId: record.issueId,
    objective: record.objective,
    strategy: record.strategy,
    affectedTargets: asTargetRefArray(record.affectedTargets),
    proposedActions: asArray(record.proposedActions),
    risks: asStringArray(record.risks),
    ...(record.rollbackPlan ? { rollbackPlan: record.rollbackPlan } : {}),
    ...(Array.isArray(record.assumptions)
      ? { assumptions: asStringArray(record.assumptions) }
      : {}),
    baselineCommitSha: record.baselineCommitSha,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function toChangeUnit(record: ChangeUnitRecord): ChangeUnit {
  return {
    id: record.id,
    changePlanId: record.changePlanId,
    issueId: record.issueId,
    sourceActionId: record.sourceActionId,
    dependsOnUnitIds: asStringArray(record.dependsOnUnitIds),
    title: record.title,
    description: record.description,
    scope: asChangeUnitScope(record.scope),
    executionMode: record.executionMode,
    maxRetries: record.maxRetries,
    currentAttemptNo: record.currentAttemptNo,
    status: record.status,
    producedCommitIds: asStringArray(record.producedCommitIds),
    latestExecutionAttempt: record.latestExecutionAttempt
      ? toGovernanceExecutionAttemptSummary(record.latestExecutionAttempt)
      : null,
    latestVerificationResult: record.latestVerificationResult
      ? toVerificationResult(record.latestVerificationResult)
      : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toVerificationPlan(record: VerificationPlanRecord): VerificationPlan {
  return {
    id: record.id,
    subjectType: record.subjectType,
    ...(record.changeUnitId ? { changeUnitId: record.changeUnitId } : {}),
    ...(record.changePlanId ? { changePlanId: record.changePlanId } : {}),
    ...(record.issueId ? { issueId: record.issueId } : {}),
    checks: asVerificationChecks(record.checks),
    passCriteria: asStringArray(record.passCriteria),
    createdAt: record.createdAt.toISOString()
  };
}

function toVerificationResult(
  record: VerificationResultRecord
): VerificationResult {
  return {
    id: record.id,
    verificationPlanId: record.verificationPlanId,
    subjectType: record.subjectType,
    ...(record.changeUnitId ? { changeUnitId: record.changeUnitId } : {}),
    ...(record.changePlanId ? { changePlanId: record.changePlanId } : {}),
    executionAttemptNo: record.executionAttemptNo,
    status: record.status,
    checkResults: asVerificationCheckResults(record.checkResults),
    summary: record.summary,
    executedAt: record.executedAt.toISOString()
  };
}

export function toDeliveryArtifact(record: DeliveryArtifactRecord): DeliveryArtifact {
  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    body: record.body,
    linkedIssueIds: asStringArray(record.linkedIssueIds),
    linkedChangeUnitIds: asStringArray(record.linkedChangeUnitIds),
    linkedVerificationResultIds: asStringArray(record.linkedVerificationResultIds),
    bodyStrategy: record.bodyStrategy,
    ...(record.externalRef ? { externalRef: record.externalRef } : {}),
    status: record.status,
    createdAt: record.createdAt.toISOString()
  };
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function asTargetRefArray(value: unknown): GovernanceTargetRef[] {
  return Array.isArray(value)
    ? value.filter(isTargetRef)
    : [];
}

function asVerificationChecks(value: unknown): GovernanceVerificationCheck[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is GovernanceVerificationCheck =>
          isRecord(item) &&
          typeof item.id === 'string' &&
          typeof item.type === 'string' &&
          typeof item.required === 'boolean'
      )
    : [];
}

function asVerificationCheckResults(
  value: unknown
): VerificationResult['checkResults'] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is VerificationResult['checkResults'][number] =>
          isRecord(item) &&
          typeof item.checkId === 'string' &&
          (item.status === 'passed' ||
            item.status === 'failed' ||
            item.status === 'skipped') &&
          typeof item.summary === 'string'
      )
    : [];
}

function asChangeUnitScope(value: unknown): ChangeUnit['scope'] {
  if (!isRecord(value)) {
    return {
      targets: [],
      violationPolicy: 'warn' as GovernanceViolationPolicy
    };
  }

  return {
    targets: asTargetRefArray(value.targets),
    ...(typeof value.maxFiles === 'number' ? { maxFiles: value.maxFiles } : {}),
    ...(typeof value.maxDiffLines === 'number'
      ? { maxDiffLines: value.maxDiffLines }
      : {}),
    violationPolicy:
      value.violationPolicy === 'fail' ||
      value.violationPolicy === 'split' ||
      value.violationPolicy === 'warn'
        ? (value.violationPolicy as GovernanceViolationPolicy)
        : ('warn' as GovernanceViolationPolicy)
  };
}

function asRepositoryModules(value: unknown): RepositoryProfile['modules'] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is RepositoryProfile['modules'][number] =>
          isRecord(item) &&
          typeof item.name === 'string' &&
          typeof item.path === 'string' &&
          typeof item.language === 'string' &&
          Array.isArray(item.dependencies) &&
          item.dependencies.every((dependency) => typeof dependency === 'string')
      )
    : [];
}

function asRepositoryTestBaseline(
  value: unknown
): RepositoryProfile['testBaseline'] {
  if (!isRecord(value)) {
    return {
      totalTests: 0,
      failingTests: 0
    };
  }

  return {
    ...(typeof value.coveragePercent === 'number'
      ? { coveragePercent: value.coveragePercent }
      : {}),
    totalTests: typeof value.totalTests === 'number' ? value.totalTests : 0,
    failingTests:
      typeof value.failingTests === 'number' ? value.failingTests : 0,
    ...(typeof value.lastRunAt === 'string'
      ? { lastRunAt: value.lastRunAt }
      : {})
  };
}

function isTargetRef(value: unknown): value is GovernanceTargetRef {
  return (
    isRecord(value) &&
    typeof value.kind === 'string' &&
    typeof value.ref === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
