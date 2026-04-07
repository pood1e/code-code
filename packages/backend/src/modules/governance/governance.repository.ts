import type {
  GovernanceAssessmentOverrideInput,
  GovernanceAgentStrategy,
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceAutoActionEligibility,
  GovernanceAssessmentSource,
  GovernanceChangePlanStatus,
  GovernanceChangeUnitStatus,
  GovernanceClusterBasis,
  GovernanceDeliveryArtifactKind,
  GovernanceDeliveryArtifactStatus,
  GovernanceDeliveryBodyStrategy,
  GovernanceDeliveryCommitMode,
  GovernanceExecutionMode,
  GovernanceExecutionAttemptStatus,
  GovernanceFindingSource,
  GovernanceFindingStatus,
  GovernanceIssueKind,
  GovernanceIssueStatus,
  GovernancePriority,
  GovernanceResolutionType,
  GovernanceReviewDecisionType,
  GovernanceReviewQueueItemKind,
  GovernanceReviewSubjectType,
  GovernanceSeverity,
  GovernanceSourceSelection,
  GovernanceVerificationCheck,
  GovernanceVerificationResultStatus,
  GovernanceVerificationSubjectType,
  GovernanceViolationPolicy,
  RepositoryBuildStatus
} from '@agent-workbench/shared';

export type RepositoryProfileRecord = {
  id: string;
  scopeId: string;
  branch: string;
  snapshotAt: Date;
  modules: unknown;
  testBaseline: unknown;
  buildStatus: RepositoryBuildStatus;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type GovernanceFindingRecord = {
  id: string;
  scopeId: string;
  source: GovernanceFindingSource;
  sourceRef: string | null;
  title: string;
  summary: string;
  evidence: unknown;
  categories: unknown;
  tags: unknown;
  severityHint: GovernanceSeverity | null;
  confidence: number | null;
  affectedTargets: unknown;
  metadata: unknown;
  fingerprint: string | null;
  discoveredAt: Date;
  status: GovernanceFindingStatus;
  version: number;
  latestTriageAttempt: GovernanceExecutionAttemptRecord | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GovernanceIssueRecord = {
  id: string;
  scopeId: string;
  title: string;
  statement: string;
  kind: GovernanceIssueKind;
  categories: unknown;
  tags: unknown;
  relatedFindingIds: unknown;
  status: GovernanceIssueStatus;
  affectedTargets: unknown;
  rootCause: string | null;
  impactSummary: string;
  isRegression: boolean;
  regressionOfIssueId: string | null;
  spinOffOfIssueId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type GovernancePolicyRecord = {
  id: string;
  scopeId: string;
  priorityPolicy: {
    defaultPriority: GovernancePriority;
    severityOverrides?: Partial<Record<GovernanceSeverity, GovernancePriority>>;
  };
  autoActionPolicy: {
    defaultEligibility: GovernanceAutoActionEligibility;
    severityOverrides?: Partial<
      Record<GovernanceSeverity, GovernanceAutoActionEligibility>
    >;
    issueKindOverrides?: Partial<
      Record<GovernanceIssueKind, GovernanceAutoActionEligibility>
    >;
  };
  deliveryPolicy: {
    commitMode: GovernanceDeliveryCommitMode;
    autoCloseIssueOnApprovedDelivery: boolean;
  };
  sourceSelection: GovernanceSourceSelection;
  agentStrategy: GovernanceAgentStrategy;
  createdAt: Date;
  updatedAt: Date;
};

export type IssueAssessmentRecord = {
  id: string;
  issueId: string;
  severity: GovernanceSeverity;
  priority: GovernancePriority;
  userImpact: number;
  systemRisk: number;
  strategicValue: number;
  fixCost: number;
  autoActionEligibility: GovernanceAutoActionEligibility;
  rationale: unknown;
  assessedBy: GovernanceAssessmentSource;
  assessedAt: Date;
  createdAt: Date;
};

export type ResolutionDecisionRecord = {
  id: string;
  issueId: string;
  resolution: GovernanceResolutionType;
  reason: string;
  deferUntil: Date | null;
  primaryIssueId: string | null;
  approvedBy: string | null;
  decidedAt: Date;
  createdAt: Date;
};

export type ChangePlanRecord = {
  id: string;
  issueId: string;
  objective: string;
  strategy: string;
  affectedTargets: unknown;
  proposedActions: unknown;
  risks: unknown;
  rollbackPlan: string | null;
  assumptions: unknown;
  baselineCommitSha: string;
  status: GovernanceChangePlanStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ChangeUnitRecord = {
  id: string;
  changePlanId: string;
  issueId: string;
  sourceActionId: string;
  dependsOnUnitIds: unknown;
  title: string;
  description: string;
  scope: unknown;
  executionMode: GovernanceExecutionMode;
  maxRetries: number;
  currentAttemptNo: number;
  status: GovernanceChangeUnitStatus;
  producedCommitIds: unknown;
  latestExecutionAttempt: GovernanceExecutionAttemptRecord | null;
  latestVerificationResult: VerificationResultRecord | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type VerificationPlanRecord = {
  id: string;
  subjectType: GovernanceVerificationSubjectType;
  changeUnitId: string | null;
  changePlanId: string | null;
  issueId: string | null;
  checks: unknown;
  passCriteria: unknown;
  createdAt: Date;
};

export type VerificationResultRecord = {
  id: string;
  verificationPlanId: string;
  subjectType: GovernanceVerificationSubjectType;
  changeUnitId: string | null;
  changePlanId: string | null;
  issueId: string | null;
  executionAttemptNo: number;
  status: GovernanceVerificationResultStatus;
  checkResults: unknown;
  summary: string;
  executedAt: Date;
  createdAt: Date;
};

export type ReviewDecisionRecord = {
  id: string;
  scopeId: string;
  subjectType: GovernanceReviewSubjectType;
  subjectId: string;
  decision: GovernanceReviewDecisionType;
  assessmentOverride: unknown;
  comment: string | null;
  reviewer: string;
  createdAt: Date;
};

export type DeliveryArtifactRecord = {
  id: string;
  scopeId: string;
  issueId: string;
  changePlanId: string | null;
  kind: GovernanceDeliveryArtifactKind;
  title: string;
  body: string;
  linkedIssueIds: unknown;
  linkedChangeUnitIds: unknown;
  linkedVerificationResultIds: unknown;
  bodyStrategy: GovernanceDeliveryBodyStrategy;
  externalRef: string | null;
  status: GovernanceDeliveryArtifactStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type GovernanceExecutionAttemptRecord = {
  id: string;
  scopeId: string;
  stageType: GovernanceAutomationStage;
  subjectType: GovernanceAutomationSubjectType;
  subjectId: string;
  attemptNo: number;
  status: GovernanceExecutionAttemptStatus;
  sessionId: string | null;
  activeRequestMessageId: string | null;
  ownerLeaseToken: string | null;
  leaseExpiresAt: Date | null;
  inputSnapshot: unknown;
  candidateOutput: unknown;
  parsedOutput: unknown;
  failureCode: string | null;
  failureMessage: string | null;
  resolvedByReviewDecisionId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GovernanceIssueSummaryRecord = GovernanceIssueRecord & {
  latestAssessment: IssueAssessmentRecord | null;
  latestResolutionDecision: ResolutionDecisionRecord | null;
  latestChangePlanStatus: GovernanceChangePlanStatus | null;
  relatedFindingCount: number;
  latestPlanningAttempt: GovernanceExecutionAttemptRecord | null;
};

export type GovernanceIssueDetailRecord = GovernanceIssueRecord & {
  latestAssessment: IssueAssessmentRecord | null;
  latestResolutionDecision: ResolutionDecisionRecord | null;
  relatedFindings: GovernanceFindingRecord[];
  changePlan: ChangePlanRecord | null;
  changeUnits: ChangeUnitRecord[];
  verificationPlans: VerificationPlanRecord[];
  verificationResults: VerificationResultRecord[];
  planLevelVerificationResult: VerificationResultRecord | null;
  deliveryArtifact: DeliveryArtifactRecord | null;
  latestPlanningAttempt: GovernanceExecutionAttemptRecord | null;
};

export type GovernanceScopeOverviewRecord = {
  scopeId: string;
  repositoryProfile: RepositoryProfileRecord | null;
  latestBaselineAttempt: GovernanceExecutionAttemptRecord | null;
  latestDiscoveryAttempt: GovernanceExecutionAttemptRecord | null;
  findingCounts: Record<GovernanceFindingStatus, number>;
};

export type GovernanceReviewQueueItemRecord = {
  kind: GovernanceReviewQueueItemKind;
  scopeId: string;
  subjectId: string;
  issueId: string | null;
  title: string;
  status: string;
  failureCode: string | null;
  failureMessage: string | null;
  sessionId: string | null;
  updatedAt: Date;
};

export type GovernanceProjectSourceRecord = {
  id: string;
  repoGitUrl: string;
  workspaceRootPath: string;
};

export type CreateIssueWithAssessmentInput = {
  scopeId: string;
  title: string;
  statement: string;
  kind: GovernanceIssueKind;
  categories: string[];
  tags?: string[];
  relatedFindingIds?: string[];
  affectedTargets: Array<{ kind: string; ref: string }>;
  rootCause?: string | null;
  impactSummary: string;
  isRegression?: boolean;
  regressionOfIssueId?: string | null;
  spinOffOfIssueId?: string | null;
  assessment: {
    severity: GovernanceSeverity;
    priority: GovernancePriority;
    userImpact: number;
    systemRisk: number;
    strategicValue: number;
    fixCost: number;
    autoActionEligibility: GovernanceAutoActionEligibility;
    rationale: string[];
    assessedBy: GovernanceAssessmentSource;
    assessedAt?: Date;
  };
};

export type CreateChangePlanBundleInput = {
  issueId: string;
  objective: string;
  strategy: string;
  affectedTargets: Array<{ kind: string; ref: string }>;
  proposedActions: Array<{
    id: string;
    type: string;
    description: string;
    targets: Array<{ kind: string; ref: string }>;
  }>;
  risks: string[];
  rollbackPlan?: string | null;
  assumptions?: string[] | null;
  baselineCommitSha: string;
  status?: GovernanceChangePlanStatus;
  changeUnits: Array<{
    sourceActionId: string;
    dependsOnUnitIds?: string[];
    title: string;
    description: string;
    scope: {
      targets: Array<{ kind: string; ref: string }>;
      maxFiles?: number;
      maxDiffLines?: number;
      violationPolicy: GovernanceViolationPolicy;
    };
    executionMode: GovernanceExecutionMode;
    maxRetries?: number;
    currentAttemptNo?: number;
    status?: GovernanceChangeUnitStatus;
    producedCommitIds?: string[];
  }>;
  verificationPlans: Array<{
    subjectType: GovernanceVerificationSubjectType;
    checks: GovernanceVerificationCheck[];
    passCriteria: string[];
    changeUnitIndex?: number;
  }>;
};

export abstract class GovernanceRepository {
  abstract listGovernanceScopes(): Promise<GovernanceProjectSourceRecord[]>;
  abstract projectExists(scopeId: string): Promise<boolean>;
  abstract issueExists(issueId: string): Promise<boolean>;
  abstract findFindingById(id: string): Promise<GovernanceFindingRecord | null>;
  abstract findFindingByFingerprint(
    scopeId: string,
    fingerprint: string
  ): Promise<GovernanceFindingRecord | null>;
  abstract findIssueById(id: string): Promise<GovernanceIssueRecord | null>;
  abstract findChangePlanById(id: string): Promise<ChangePlanRecord | null>;
  abstract getProjectSource(
    scopeId: string
  ): Promise<GovernanceProjectSourceRecord | null>;
  abstract getLatestRepositoryProfile(
    scopeId: string
  ): Promise<RepositoryProfileRecord | null>;
  abstract getOrCreateGovernancePolicy(
    scopeId: string
  ): Promise<GovernancePolicyRecord>;
  abstract updateGovernancePolicy(input: {
    scopeId: string;
    priorityPolicy: GovernancePolicyRecord['priorityPolicy'];
    autoActionPolicy: GovernancePolicyRecord['autoActionPolicy'];
    deliveryPolicy: GovernancePolicyRecord['deliveryPolicy'];
    sourceSelection?: GovernancePolicyRecord['sourceSelection'];
    agentStrategy?: GovernancePolicyRecord['agentStrategy'];
  }): Promise<GovernancePolicyRecord>;
  abstract agentRunnerExists(runnerId: string): Promise<boolean>;
  abstract createRepositoryProfileSnapshot(input: {
    scopeId: string;
    branch: string;
    snapshotAt: Date;
    modules: Array<{
      name: string;
      path: string;
      language: string;
      dependencies: string[];
    }>;
    testBaseline: {
      coveragePercent?: number;
      totalTests: number;
      failingTests: number;
      lastRunAt?: string;
    };
    buildStatus: RepositoryBuildStatus;
    metadata?: Record<string, unknown> | null;
  }): Promise<RepositoryProfileRecord>;
  abstract getScopeOverview(
    scopeId: string
  ): Promise<GovernanceScopeOverviewRecord | null>;
  abstract listReviewQueue(
    scopeId: string
  ): Promise<GovernanceReviewQueueItemRecord[]>;
  abstract findLatestAutomationAttempt(input: {
    stageType: GovernanceAutomationStage;
    subjectType: GovernanceAutomationSubjectType;
    subjectId: string;
  }): Promise<GovernanceExecutionAttemptRecord | null>;
  abstract createAutomationAttempt(input: {
    scopeId: string;
    stageType: GovernanceAutomationStage;
    subjectType: GovernanceAutomationSubjectType;
    subjectId: string;
    inputSnapshot: Record<string, unknown>;
    ownerLeaseToken?: string;
    leaseExpiresAt?: Date;
  }): Promise<GovernanceExecutionAttemptRecord>;
  abstract claimAutomationAttempt(input: {
    attemptId: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<GovernanceExecutionAttemptRecord | null>;
  abstract markAutomationAttemptRunning(input: {
    attemptId: string;
    ownerLeaseToken: string;
    leaseExpiresAt: Date;
  }): Promise<boolean>;
  abstract attachAutomationAttemptSession(input: {
    attemptId: string;
    ownerLeaseToken: string;
    sessionId: string;
    activeRequestMessageId: string | null;
  }): Promise<boolean>;
  abstract updateAutomationAttemptMessage(input: {
    attemptId: string;
    ownerLeaseToken: string;
    activeRequestMessageId: string | null;
  }): Promise<boolean>;
  abstract markAutomationAttemptWaitingRepair(input: {
    attemptId: string;
    ownerLeaseToken: string;
    activeRequestMessageId: string | null;
    failureCode: string;
    failureMessage: string;
    candidateOutput?: unknown;
  }): Promise<boolean>;
  abstract markAutomationAttemptSucceeded(input: {
    attemptId: string;
    ownerLeaseToken: string;
    activeRequestMessageId: string | null;
    candidateOutput?: unknown;
    parsedOutput: unknown;
  }): Promise<boolean>;
  abstract markAutomationAttemptFailed(input: {
    attemptId: string;
    ownerLeaseToken: string;
    failureCode: string;
    failureMessage: string;
    candidateOutput?: unknown;
    needsHumanReview: boolean;
  }): Promise<boolean>;
  abstract markAutomationAttemptResolvedByHuman(
    attemptId: string,
    reviewDecisionId?: string | null
  ): Promise<void>;
  abstract renewAutomationAttemptLease(input: {
    attemptId: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<boolean>;
  abstract releaseAutomationAttemptLease(input: {
    attemptId: string;
    ownerLeaseToken: string;
  }): Promise<boolean>;
  abstract recoverInterruptedAutomation(now: Date): Promise<number>;
  abstract recoverErroredAutomationAttempts(now: Date): Promise<number>;
  abstract wakeDeferredIssues(now: Date): Promise<number>;
  abstract claimNextPendingFinding(input: {
    scopeId?: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<GovernanceFindingRecord | null>;
  abstract claimNextPlanningIssue(input: {
    scopeId?: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<GovernanceIssueRecord | null>;
  abstract claimNextExecutableChangeUnit(input: {
    scopeId?: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<ChangeUnitRecord | null>;
  abstract releaseFindingLease(input: {
    findingId: string;
    ownerLeaseToken: string;
  }): Promise<boolean>;
  abstract releaseIssueLease(input: {
    issueId: string;
    ownerLeaseToken: string;
  }): Promise<boolean>;
  abstract releaseChangeUnitLease(input: {
    changeUnitId: string;
    ownerLeaseToken: string;
  }): Promise<boolean>;
  abstract getChangeUnitExecutionContext(changeUnitId: string): Promise<{
    scopeId: string;
    project: GovernanceProjectSourceRecord;
    issue: GovernanceIssueRecord;
    changePlan: ChangePlanRecord;
    changeUnit: ChangeUnitRecord;
    unitVerificationPlan: VerificationPlanRecord | null;
    planVerificationPlan: VerificationPlanRecord | null;
  } | null>;
  abstract applyTriageCreateIssue(input: {
    findingId: string;
    scopeId: string;
    expectedFindingVersion: number;
    issue: {
      title: string;
      statement: string;
      kind: GovernanceIssueKind;
      categories: string[];
      tags?: string[];
      affectedTargets: Array<{ kind: string; ref: string }>;
      rootCause?: string;
      impactSummary: string;
      isRegression?: boolean;
      regressionOfIssueId?: string;
    };
    assessment: CreateIssueWithAssessmentInput['assessment'];
  }): Promise<GovernanceIssueDetailRecord>;
  abstract applyTriageMerge(input: {
    findingId: string;
    expectedFindingVersion: number;
    targetIssueId: string;
    clusterBasis: GovernanceClusterBasis[];
    assessmentRefresh?: CreateIssueWithAssessmentInput['assessment'];
  }): Promise<GovernanceIssueDetailRecord>;
  abstract createPlanningBundleFromAutomation(
    input: CreateChangePlanBundleInput
  ): Promise<GovernanceIssueDetailRecord>;
  abstract createVerificationResult(input: {
    verificationPlanId: string;
    subjectType: GovernanceVerificationSubjectType;
    changeUnitId?: string | null;
    changePlanId?: string | null;
    issueId?: string | null;
    executionAttemptNo: number;
    status: GovernanceVerificationResultStatus;
    checkResults: Array<{
      checkId: string;
      status: 'passed' | 'failed' | 'skipped';
      summary: string;
      artifactRefs?: string[];
    }>;
    summary: string;
  }): Promise<VerificationResultRecord>;
  abstract updateChangeUnitExecutionState(input: {
    changeUnitId: string;
    expectedVersion?: number;
    status: GovernanceChangeUnitStatus;
    currentAttemptNo?: number;
    ownerLeaseToken?: string | null;
    leaseExpiresAt?: Date | null;
  }): Promise<boolean>;
  abstract appendChangeUnitCommit(input: {
    changeUnitId: string;
    commitId: string;
    expectedVersion?: number;
    ownerLeaseToken?: string | null;
  }): Promise<boolean>;
  abstract updateIssueState(input: {
    issueId: string;
    expectedVersion?: number;
    status: GovernanceIssueStatus;
    ownerLeaseToken?: string | null;
    leaseExpiresAt?: Date | null;
  }): Promise<boolean>;
  abstract createOrUpdateDeliveryArtifact(input: {
    scopeId: string;
    issueId: string;
    changePlanId?: string | null;
    kind: GovernanceDeliveryArtifactKind;
    title: string;
    body: string;
    linkedIssueIds: string[];
    linkedChangeUnitIds: string[];
    linkedVerificationResultIds: string[];
    bodyStrategy: GovernanceDeliveryBodyStrategy;
    status: GovernanceDeliveryArtifactStatus;
  }): Promise<DeliveryArtifactRecord>;
  abstract updateDeliveryArtifactStatus(input: {
    deliveryArtifactId: string;
    status: GovernanceDeliveryArtifactStatus;
  }): Promise<boolean>;
  abstract reviewChangeUnit(input: {
    changeUnitId: string;
    reviewer: string;
    comment?: string;
    decision:
      | GovernanceReviewDecisionType.Approved
      | GovernanceReviewDecisionType.Rejected
      | GovernanceReviewDecisionType.Retry
      | GovernanceReviewDecisionType.EditAndContinue
      | GovernanceReviewDecisionType.Skip
      | GovernanceReviewDecisionType.Terminate;
  }): Promise<string>;
  abstract reviewDeliveryArtifact(input: {
    deliveryArtifactId: string;
    reviewer: string;
    comment?: string;
    decision:
      | GovernanceReviewDecisionType.Approved
      | GovernanceReviewDecisionType.Rejected;
  }): Promise<string>;
  abstract findDeliveryArtifactById(id: string): Promise<DeliveryArtifactRecord | null>;
  abstract findSpinOffIssueBySourceIssueId(
    issueId: string
  ): Promise<GovernanceIssueRecord | null>;
  abstract retryTriage(findingId: string): Promise<void>;
  abstract retryPlanning(issueId: string): Promise<void>;
  abstract retryBaseline(scopeId: string): Promise<void>;
  abstract retryDiscovery(scopeId: string): Promise<void>;
  abstract createFinding(input: {
    scopeId: string;
    source: GovernanceFindingSource;
    sourceRef?: string;
    title: string;
    summary: string;
    evidence: unknown;
    categories: string[];
    tags: string[];
    severityHint?: GovernanceSeverity;
    confidence?: number;
    affectedTargets: unknown;
    metadata?: Record<string, unknown>;
    fingerprint?: string;
    discoveredAt?: Date;
  }): Promise<GovernanceFindingRecord>;
  abstract listFindings(filter: {
    scopeId?: string;
    status?: GovernanceFindingStatus;
  }): Promise<GovernanceFindingRecord[]>;
  abstract listIssues(filter: {
    scopeId?: string;
    status?: GovernanceIssueStatus;
  }): Promise<GovernanceIssueSummaryRecord[]>;
  abstract listChangeUnits(filter: {
    scopeId?: string;
    issueId?: string;
    status?: GovernanceChangeUnitStatus;
  }): Promise<ChangeUnitRecord[]>;
  abstract listDeliveryArtifacts(filter: {
    scopeId?: string;
    status?: GovernanceDeliveryArtifactStatus;
  }): Promise<DeliveryArtifactRecord[]>;
  abstract getIssueDetail(id: string): Promise<GovernanceIssueDetailRecord | null>;
  abstract submitResolutionDecision(input: {
    issueId: string;
    resolution: GovernanceResolutionType;
    reason: string;
    deferUntil: Date | null;
    primaryIssueId?: string | null;
    approvedBy?: string | null;
    nextIssueStatus: GovernanceIssueStatus;
    expectedVersion: number;
  }): Promise<void>;
  abstract dismissFinding(input: {
    findingId: string;
    reviewer: string;
    comment?: string;
  }): Promise<void>;
  abstract overrideAssessment(input: {
    assessmentId: string;
    reviewer: string;
    comment?: string;
    assessmentOverride: GovernanceAssessmentOverrideInput;
  }): Promise<string>;
  abstract reviewChangePlan(input: {
    changePlanId: string;
    reviewer: string;
    comment?: string;
    decision:
      | GovernanceReviewDecisionType.Approved
      | GovernanceReviewDecisionType.Rejected;
  }): Promise<string>;
  abstract createIssueWithAssessment(
    input: CreateIssueWithAssessmentInput
  ): Promise<GovernanceIssueDetailRecord>;
  abstract createChangePlanBundle(
    input: CreateChangePlanBundleInput
  ): Promise<GovernanceIssueDetailRecord>;
}
