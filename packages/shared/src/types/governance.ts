export enum GovernanceFindingSource {
  AgentReview = 'agent_review',
  StaticAnalysis = 'static_analysis',
  TestRun = 'test_run',
  CoverageCheck = 'coverage_check',
  UxReview = 'ux_review',
  A11yCheck = 'a11y_check',
  HumanFeedback = 'human_feedback',
  RuntimeSignal = 'runtime_signal',
  DependencyScan = 'dependency_scan',
  Custom = 'custom'
}

export enum GovernanceSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low'
}

export enum GovernancePriority {
  P0 = 'p0',
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3'
}

export enum GovernanceFindingStatus {
  Pending = 'pending',
  Merged = 'merged',
  Dismissed = 'dismissed',
  Ignored = 'ignored'
}

export enum GovernanceMergeTrigger {
  AutoCluster = 'auto_cluster',
  HumanMerge = 'human_merge',
  RuleMatch = 'rule_match'
}

export enum GovernanceClusterBasis {
  SameTarget = 'same_target',
  SameCategory = 'same_category',
  SemanticSimilarity = 'semantic_similarity',
  SameSourceRef = 'same_source_ref'
}

export enum GovernanceIssueKind {
  Bug = 'bug',
  Risk = 'risk',
  Debt = 'debt',
  Improvement = 'improvement',
  Gap = 'gap',
  Violation = 'violation'
}

export enum GovernanceIssueStatus {
  Open = 'open',
  Planned = 'planned',
  InProgress = 'in_progress',
  Blocked = 'blocked',
  InReview = 'in_review',
  Resolved = 'resolved',
  PartiallyResolved = 'partially_resolved',
  IntegrationFailed = 'integration_failed',
  Closed = 'closed',
  Deferred = 'deferred',
  AcceptedRisk = 'accepted_risk',
  WontFix = 'wont_fix',
  Duplicate = 'duplicate'
}

export enum GovernanceAutoActionEligibility {
  AutoAllowed = 'auto_allowed',
  HumanReviewRequired = 'human_review_required',
  SuggestOnly = 'suggest_only',
  Forbidden = 'forbidden'
}

export enum GovernanceAssessmentSource {
  Agent = 'agent',
  RuleEngine = 'rule_engine',
  Human = 'human',
  Hybrid = 'hybrid'
}

export enum GovernanceResolutionType {
  Fix = 'fix',
  Refactor = 'refactor',
  Mitigate = 'mitigate',
  AcceptRisk = 'accept_risk',
  Defer = 'defer',
  Duplicate = 'duplicate',
  WontFix = 'wont_fix',
  NeedsHumanDecision = 'needs_human_decision'
}

export enum GovernanceChangePlanStatus {
  Draft = 'draft',
  Approved = 'approved',
  Rejected = 'rejected',
  Superseded = 'superseded'
}

export enum GovernanceChangeActionType {
  CodeChange = 'code_change',
  TestAddition = 'test_addition',
  TestFix = 'test_fix',
  ConfigChange = 'config_change',
  DependencyUpgrade = 'dependency_upgrade',
  DocUpdate = 'doc_update',
  UxAdjustment = 'ux_adjustment',
  ArchitectureRefactor = 'architecture_refactor',
  ObservabilityChange = 'observability_change'
}

export enum GovernanceViolationPolicy {
  Fail = 'fail',
  Split = 'split',
  Warn = 'warn'
}

export enum GovernanceExecutionMode {
  Auto = 'auto',
  SemiAuto = 'semi_auto',
  Manual = 'manual'
}

export enum GovernanceAutomationStage {
  Baseline = 'baseline',
  Discovery = 'discovery',
  Triage = 'triage',
  Planning = 'planning',
  Execution = 'execution'
}

export enum GovernanceAutomationSubjectType {
  Scope = 'scope',
  Finding = 'finding',
  Issue = 'issue',
  ChangeUnit = 'change_unit'
}

export enum GovernanceExecutionAttemptStatus {
  Pending = 'pending',
  Running = 'running',
  WaitingRepair = 'waiting_repair',
  Succeeded = 'succeeded',
  Failed = 'failed',
  NeedsHumanReview = 'needs_human_review',
  ResolvedByHuman = 'resolved_by_human',
  Cancelled = 'cancelled'
}

export enum GovernanceChangeUnitStatus {
  Pending = 'pending',
  Ready = 'ready',
  Running = 'running',
  VerificationFailed = 'verification_failed',
  Verified = 'verified',
  Committed = 'committed',
  Merged = 'merged',
  Cancelled = 'cancelled',
  Exhausted = 'exhausted'
}

export enum GovernanceVerificationSubjectType {
  ChangeUnit = 'change_unit',
  ChangePlan = 'change_plan'
}

export enum GovernanceVerificationCheckType {
  Lint = 'lint',
  Typecheck = 'typecheck',
  UnitTest = 'unit_test',
  IntegrationTest = 'integration_test',
  E2eTest = 'e2e_test',
  A11yCheck = 'a11y_check',
  CoverageCheck = 'coverage_check',
  StaticScan = 'static_scan',
  Build = 'build',
  Custom = 'custom'
}

export enum GovernanceVerificationResultStatus {
  Passed = 'passed',
  Failed = 'failed',
  Partial = 'partial'
}

export enum GovernanceReviewSubjectType {
  Finding = 'finding',
  Assessment = 'assessment',
  Issue = 'issue',
  ChangePlan = 'change_plan',
  ChangeUnit = 'change_unit',
  DeliveryArtifact = 'delivery_artifact'
}

export enum GovernanceReviewDecisionType {
  Approved = 'approved',
  Rejected = 'rejected',
  Retry = 'retry',
  EditAndContinue = 'edit_and_continue',
  Skip = 'skip',
  Terminate = 'terminate',
  AcceptedRisk = 'accepted_risk',
  Dismissed = 'dismissed'
}

export enum GovernanceDeliveryArtifactKind {
  PullRequest = 'pull_request',
  MergeRequest = 'merge_request',
  ReviewRequest = 'review_request',
  Report = 'report'
}

export enum GovernanceDeliveryBodyStrategy {
  AutoAggregate = 'auto_aggregate',
  HumanAuthored = 'human_authored',
  Template = 'template'
}

export enum GovernanceDeliveryArtifactStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Merged = 'merged',
  Closed = 'closed'
}

export enum GovernanceDeliveryCommitMode {
  PerUnit = 'per_unit',
  Squash = 'squash'
}

export enum GovernanceAgentMergeStrategy {
  Single = 'single',
  BestOfN = 'best_of_n',
  UnionDedup = 'union_dedup'
}

export enum RepositoryBuildStatus {
  Passing = 'passing',
  Failing = 'failing',
  Unknown = 'unknown'
}

export type GovernanceEvidenceRef = {
  kind:
    | 'file'
    | 'line_range'
    | 'report'
    | 'test_case'
    | 'snapshot'
    | 'url'
    | 'message';
  ref: string;
  excerpt?: string;
};

export type GovernanceTargetRef = {
  kind:
    | 'repository'
    | 'module'
    | 'package'
    | 'service'
    | 'file'
    | 'component'
    | 'api'
    | 'screen';
  ref: string;
};

export type RepositoryProfile = {
  id: string;
  scopeId: string;
  branch: string;
  snapshotAt: string;
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
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Finding = {
  id: string;
  scopeId: string;
  source: GovernanceFindingSource;
  sourceRef?: string;
  title: string;
  summary: string;
  evidence: GovernanceEvidenceRef[];
  categories: string[];
  tags: string[];
  severityHint?: GovernanceSeverity;
  confidence?: number;
  affectedTargets: GovernanceTargetRef[];
  metadata?: Record<string, unknown>;
  fingerprint?: string;
  discoveredAt?: string;
  status: GovernanceFindingStatus;
  latestTriageAttempt?: GovernanceExecutionAttemptSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type FindingMergeRecord = {
  id: string;
  targetIssueId: string;
  mergedFindingIds: string[];
  trigger: GovernanceMergeTrigger;
  clusterBasis?: GovernanceClusterBasis[];
  mergedBy?: string;
  mergedAt: string;
};

export type Issue = {
  id: string;
  scopeId: string;
  title: string;
  statement: string;
  kind: GovernanceIssueKind;
  categories: string[];
  tags: string[];
  relatedFindingIds: string[];
  status: GovernanceIssueStatus;
  affectedTargets: GovernanceTargetRef[];
  rootCause?: string;
  impactSummary: string;
  isRegression?: boolean;
  regressionOfIssueId?: string;
  spinOffOfIssueId?: string;
  createdAt: string;
  updatedAt: string;
};

export type GovernancePriorityPolicy = {
  defaultPriority: GovernancePriority;
  severityOverrides?: Partial<Record<GovernanceSeverity, GovernancePriority>>;
};

export type GovernanceAutoActionPolicy = {
  defaultEligibility: GovernanceAutoActionEligibility;
  severityOverrides?: Partial<
    Record<GovernanceSeverity, GovernanceAutoActionEligibility>
  >;
  issueKindOverrides?: Partial<
    Record<GovernanceIssueKind, GovernanceAutoActionEligibility>
  >;
};

export type GovernanceDeliveryPolicy = {
  commitMode: GovernanceDeliveryCommitMode;
  autoCloseIssueOnApprovedDelivery: boolean;
};

export type GovernanceSourceSelection = {
  repoBranch: string | null;
  docBranch: string | null;
};

export type GovernanceStageAgentStrategy = {
  runnerIds: string[];
  fanoutCount: number;
  mergeStrategy: GovernanceAgentMergeStrategy;
};

export type GovernanceAgentStrategy = {
  defaultRunnerIds: string[];
  discovery: GovernanceStageAgentStrategy | null;
  triage: GovernanceStageAgentStrategy | null;
  planning: GovernanceStageAgentStrategy | null;
  execution: GovernanceStageAgentStrategy | null;
};

export type GovernancePolicy = {
  id: string;
  scopeId: string;
  priorityPolicy: GovernancePriorityPolicy;
  autoActionPolicy: GovernanceAutoActionPolicy;
  deliveryPolicy: GovernanceDeliveryPolicy;
  sourceSelection: GovernanceSourceSelection;
  agentStrategy: GovernanceAgentStrategy;
  createdAt: string;
  updatedAt: string;
};

export type UpdateGovernancePolicyInput = {
  priorityPolicy: GovernancePriorityPolicy;
  autoActionPolicy: GovernanceAutoActionPolicy;
  deliveryPolicy: GovernanceDeliveryPolicy;
  sourceSelection?: GovernanceSourceSelection;
  agentStrategy?: GovernanceAgentStrategy;
};

export const DEFAULT_GOVERNANCE_SOURCE_SELECTION: GovernanceSourceSelection = {
  repoBranch: null,
  docBranch: null
};

export const DEFAULT_GOVERNANCE_AGENT_STRATEGY: GovernanceAgentStrategy = {
  defaultRunnerIds: [],
  discovery: null,
  triage: null,
  planning: null,
  execution: null
};

export const DEFAULT_GOVERNANCE_POLICY_INPUT: UpdateGovernancePolicyInput = {
  priorityPolicy: {
    defaultPriority: GovernancePriority.P2,
    severityOverrides: {
      [GovernanceSeverity.Critical]: GovernancePriority.P0,
      [GovernanceSeverity.High]: GovernancePriority.P1,
      [GovernanceSeverity.Medium]: GovernancePriority.P2,
      [GovernanceSeverity.Low]: GovernancePriority.P3
    }
  },
  autoActionPolicy: {
    defaultEligibility: GovernanceAutoActionEligibility.HumanReviewRequired,
    severityOverrides: {
      [GovernanceSeverity.Critical]:
        GovernanceAutoActionEligibility.Forbidden,
      [GovernanceSeverity.High]:
        GovernanceAutoActionEligibility.HumanReviewRequired,
      [GovernanceSeverity.Medium]:
        GovernanceAutoActionEligibility.HumanReviewRequired,
      [GovernanceSeverity.Low]: GovernanceAutoActionEligibility.SuggestOnly
    },
    issueKindOverrides: {
      [GovernanceIssueKind.Bug]:
        GovernanceAutoActionEligibility.HumanReviewRequired,
      [GovernanceIssueKind.Risk]: GovernanceAutoActionEligibility.Forbidden,
      [GovernanceIssueKind.Debt]:
        GovernanceAutoActionEligibility.HumanReviewRequired,
      [GovernanceIssueKind.Improvement]:
        GovernanceAutoActionEligibility.SuggestOnly,
      [GovernanceIssueKind.Gap]:
        GovernanceAutoActionEligibility.HumanReviewRequired,
      [GovernanceIssueKind.Violation]:
        GovernanceAutoActionEligibility.Forbidden
    }
  },
  deliveryPolicy: {
    commitMode: GovernanceDeliveryCommitMode.PerUnit,
    autoCloseIssueOnApprovedDelivery: true
  },
  sourceSelection: DEFAULT_GOVERNANCE_SOURCE_SELECTION,
  agentStrategy: DEFAULT_GOVERNANCE_AGENT_STRATEGY
};

export function resolveGovernanceAgentStrategyForStage(
  agentStrategy: GovernanceAgentStrategy,
  stageType: GovernanceAutomationStage
) {
  switch (stageType) {
    case GovernanceAutomationStage.Baseline:
      return null;
    case GovernanceAutomationStage.Discovery:
      return resolveStageAgentStrategy(agentStrategy.discovery, agentStrategy.defaultRunnerIds);
    case GovernanceAutomationStage.Triage:
      return resolveStageAgentStrategy(agentStrategy.triage, agentStrategy.defaultRunnerIds);
    case GovernanceAutomationStage.Planning:
      return resolveStageAgentStrategy(agentStrategy.planning, agentStrategy.defaultRunnerIds);
    case GovernanceAutomationStage.Execution:
      return resolveExecutionStageAgentStrategy(
        resolveStageAgentStrategy(agentStrategy.execution, agentStrategy.defaultRunnerIds)
      );
  }
}

function resolveStageAgentStrategy(
  stageStrategy: GovernanceStageAgentStrategy | null,
  defaultRunnerIds: string[]
) {
  const runnerIds = uniqueNonEmptyStrings(
    stageStrategy?.runnerIds?.length ? stageStrategy.runnerIds : defaultRunnerIds
  );
  if (runnerIds.length === 0) {
    return null;
  }

  const fanoutCount = Math.max(
    1,
    Math.min(stageStrategy?.fanoutCount ?? 1, runnerIds.length)
  );

  return {
    runnerIds: runnerIds.slice(0, fanoutCount),
    fanoutCount,
    mergeStrategy: stageStrategy?.mergeStrategy ?? GovernanceAgentMergeStrategy.Single
  } satisfies GovernanceStageAgentStrategy;
}

function resolveExecutionStageAgentStrategy(
  stageStrategy: GovernanceStageAgentStrategy | null
) {
  if (!stageStrategy) {
    return null;
  }

  return {
    runnerIds: stageStrategy.runnerIds.slice(0, 1),
    fanoutCount: 1,
    mergeStrategy: GovernanceAgentMergeStrategy.Single
  } satisfies GovernanceStageAgentStrategy;
}

function uniqueNonEmptyStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
}

export function deriveGovernancePriority(
  policy: Pick<GovernancePolicy, 'priorityPolicy'>,
  severity: GovernanceSeverity
): GovernancePriority {
  return (
    policy.priorityPolicy.severityOverrides?.[severity] ??
    policy.priorityPolicy.defaultPriority
  );
}

export function deriveGovernanceAutoActionEligibility(
  policy: Pick<GovernancePolicy, 'autoActionPolicy'>,
  issueKind: GovernanceIssueKind,
  severity: GovernanceSeverity
): GovernanceAutoActionEligibility {
  return (
    policy.autoActionPolicy.issueKindOverrides?.[issueKind] ??
    policy.autoActionPolicy.severityOverrides?.[severity] ??
    policy.autoActionPolicy.defaultEligibility
  );
}

export function deriveGovernanceExecutionMode(
  eligibility: GovernanceAutoActionEligibility,
  suggestedMode: GovernanceExecutionMode
): GovernanceExecutionMode {
  switch (eligibility) {
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

export type IssueAssessment = {
  id: string;
  issueId: string;
  severity: GovernanceSeverity;
  priority: GovernancePriority;
  userImpact: number;
  systemRisk: number;
  strategicValue: number;
  fixCost: number;
  autoActionEligibility: GovernanceAutoActionEligibility;
  rationale: string[];
  assessedBy: GovernanceAssessmentSource;
  assessedAt: string;
  createdAt: string;
};

export type ResolutionDecision = {
  id: string;
  issueId: string;
  resolution: GovernanceResolutionType;
  reason: string;
  deferUntil?: string;
  primaryIssueId?: string;
  approvedBy?: string;
  decidedAt: string;
  createdAt: string;
};

export type ChangeAction = {
  id: string;
  type: GovernanceChangeActionType;
  description: string;
  targets: GovernanceTargetRef[];
};

export type ChangePlan = {
  id: string;
  issueId: string;
  objective: string;
  strategy: string;
  affectedTargets: GovernanceTargetRef[];
  proposedActions: ChangeAction[];
  risks: string[];
  rollbackPlan?: string;
  assumptions?: string[];
  baselineCommitSha: string;
  status: GovernanceChangePlanStatus;
  createdAt: string;
  updatedAt: string;
};

export type ChangeUnit = {
  id: string;
  changePlanId: string;
  issueId: string;
  sourceActionId: string;
  dependsOnUnitIds: string[];
  title: string;
  description: string;
  scope: {
    targets: GovernanceTargetRef[];
    maxFiles?: number;
    maxDiffLines?: number;
    violationPolicy: GovernanceViolationPolicy;
  };
  executionMode: GovernanceExecutionMode;
  maxRetries: number;
  currentAttemptNo: number;
  status: GovernanceChangeUnitStatus;
  producedCommitIds: string[];
  latestExecutionAttempt?: GovernanceExecutionAttemptSummary | null;
  latestVerificationResult?: VerificationResult | null;
  createdAt: string;
  updatedAt: string;
};

export type GovernanceVerificationCheck = {
  id: string;
  type: GovernanceVerificationCheckType;
  target?: string;
  command?: string;
  required: boolean;
};

export type VerificationPlan = {
  id: string;
  subjectType: GovernanceVerificationSubjectType;
  changeUnitId?: string;
  changePlanId?: string;
  issueId?: string;
  checks: GovernanceVerificationCheck[];
  passCriteria: string[];
  createdAt: string;
};

export type GovernanceExecutionAttemptSummary = {
  id: string;
  stageType: GovernanceAutomationStage;
  subjectType: GovernanceAutomationSubjectType;
  subjectId: string;
  attemptNo: number;
  status: GovernanceExecutionAttemptStatus;
  sessionId?: string | null;
  activeRequestMessageId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  updatedAt: string;
};

export type GovernanceScopeOverview = {
  scopeId: string;
  repositoryProfile: RepositoryProfile | null;
  latestBaselineAttempt: GovernanceExecutionAttemptSummary | null;
  latestDiscoveryAttempt: GovernanceExecutionAttemptSummary | null;
  findingCounts: Record<GovernanceFindingStatus, number>;
};

export type GovernanceDiscoveredFindingDraft = {
  source: GovernanceFindingSource;
  sourceRef?: string;
  title: string;
  summary: string;
  evidence: GovernanceEvidenceRef[];
  categories: string[];
  tags?: string[];
  severityHint?: GovernanceSeverity;
  confidence?: number;
  affectedTargets: GovernanceTargetRef[];
  metadata?: Record<string, unknown>;
};

export type GovernanceTriageCreateIssueOutput = {
  action: 'create_issue';
  issue: {
    title: string;
    statement: string;
    kind: GovernanceIssueKind;
    categories: string[];
    tags?: string[];
    affectedTargets: GovernanceTargetRef[];
    rootCause?: string;
    impactSummary: string;
    isRegression?: boolean;
    regressionOfIssueId?: string;
  };
  assessment: {
    severity: GovernanceSeverity;
    priority: GovernancePriority;
    userImpact: number;
    systemRisk: number;
    strategicValue: number;
    fixCost: number;
    autoActionEligibility: GovernanceAutoActionEligibility;
    rationale: string[];
  };
};

export type GovernanceTriageMergeOutput = {
  action: 'merge_into_issue';
  targetIssueId: string;
  clusterBasis: GovernanceClusterBasis[];
  rationale: string;
  assessmentRefresh?: {
    severity: GovernanceSeverity;
    priority: GovernancePriority;
    userImpact: number;
    systemRisk: number;
    strategicValue: number;
    fixCost: number;
    autoActionEligibility: GovernanceAutoActionEligibility;
    rationale: string[];
  };
};

export type GovernanceTriageOutput =
  | GovernanceTriageCreateIssueOutput
  | GovernanceTriageMergeOutput;

export type GovernancePlanningOutput = {
  objective: string;
  strategy: string;
  affectedTargets: GovernanceTargetRef[];
  proposedActions: ChangeAction[];
  risks: string[];
  rollbackPlan?: string;
  assumptions?: string[];
  changeUnits: Array<{
    sourceActionId: string;
    dependsOnUnitIds?: string[];
    title: string;
    description: string;
    scope: ChangeUnit['scope'];
    executionMode?: GovernanceExecutionMode;
    maxRetries?: number;
  }>;
  verificationPlans: Array<{
    subjectType: GovernanceVerificationSubjectType;
    checks: GovernanceVerificationCheck[];
    passCriteria: string[];
    changeUnitIndex?: number;
  }>;
};

export type GovernanceDiscoveryOutput = {
  findings: GovernanceDiscoveredFindingDraft[];
};

export type VerificationResult = {
  id: string;
  verificationPlanId: string;
  subjectType: GovernanceVerificationSubjectType;
  changeUnitId?: string;
  changePlanId?: string;
  executionAttemptNo: number;
  status: GovernanceVerificationResultStatus;
  checkResults: Array<{
    checkId: string;
    status: 'passed' | 'failed' | 'skipped';
    summary: string;
    artifactRefs?: string[];
  }>;
  summary: string;
  executedAt: string;
};

export type ReviewDecision = {
  id: string;
  subjectType: GovernanceReviewSubjectType;
  subjectId: string;
  decision: GovernanceReviewDecisionType;
  assessmentOverride?: Partial<
    Pick<
      IssueAssessment,
      'severity' | 'priority' | 'autoActionEligibility'
    >
  >;
  comment?: string;
  reviewer: string;
  createdAt: string;
};

export type DeliveryArtifact = {
  id: string;
  kind: GovernanceDeliveryArtifactKind;
  title: string;
  body: string;
  linkedIssueIds: string[];
  linkedChangeUnitIds: string[];
  linkedVerificationResultIds: string[];
  bodyStrategy: GovernanceDeliveryBodyStrategy;
  externalRef?: string;
  status: GovernanceDeliveryArtifactStatus;
  createdAt: string;
};

export type GovernanceIssueSummary = Issue & {
  relatedFindingCount: number;
  latestAssessment: IssueAssessment | null;
  latestResolutionDecision: ResolutionDecision | null;
  latestChangePlanStatus: GovernanceChangePlanStatus | null;
  latestPlanningAttempt: GovernanceExecutionAttemptSummary | null;
};

export type GovernanceIssueDetail = Issue & {
  latestAssessment: IssueAssessment | null;
  latestResolutionDecision: ResolutionDecision | null;
  relatedFindings: Finding[];
  changePlan: ChangePlan | null;
  changeUnits: ChangeUnit[];
  verificationPlans: VerificationPlan[];
  verificationResults: VerificationResult[];
  planLevelVerificationResult: VerificationResult | null;
  deliveryArtifact: DeliveryArtifact | null;
  latestPlanningAttempt: GovernanceExecutionAttemptSummary | null;
};

export type CreateFindingInput = {
  scopeId: string;
  source: GovernanceFindingSource;
  sourceRef?: string;
  title: string;
  summary: string;
  evidence: GovernanceEvidenceRef[];
  categories: string[];
  tags?: string[];
  severityHint?: GovernanceSeverity;
  confidence?: number;
  affectedTargets: GovernanceTargetRef[];
  metadata?: Record<string, unknown>;
};

export type CreateResolutionDecisionInput = {
  resolution: GovernanceResolutionType;
  reason: string;
  deferUntil?: string;
  primaryIssueId?: string;
  approvedBy?: string;
};

export type GovernanceAssessmentOverrideInput = Partial<
  Pick<
    IssueAssessment,
    'severity' | 'priority' | 'autoActionEligibility'
  >
>;

export type CreateReviewDecisionInput =
  | {
      subjectType: GovernanceReviewSubjectType.Finding;
      subjectId: string;
      decision: GovernanceReviewDecisionType.Dismissed;
      reviewer: string;
      comment?: string;
    }
  | {
      subjectType: GovernanceReviewSubjectType.Assessment;
      subjectId: string;
      decision: GovernanceReviewDecisionType.Approved;
      reviewer: string;
      comment?: string;
      assessmentOverride: GovernanceAssessmentOverrideInput;
    }
  | {
      subjectType: GovernanceReviewSubjectType.ChangePlan;
      subjectId: string;
      decision:
        | GovernanceReviewDecisionType.Approved
        | GovernanceReviewDecisionType.Rejected;
      reviewer: string;
      comment?: string;
    }
  | {
      subjectType: GovernanceReviewSubjectType.ChangeUnit;
      subjectId: string;
      decision:
        | GovernanceReviewDecisionType.Approved
        | GovernanceReviewDecisionType.Rejected
        | GovernanceReviewDecisionType.Retry
        | GovernanceReviewDecisionType.EditAndContinue
        | GovernanceReviewDecisionType.Skip
        | GovernanceReviewDecisionType.Terminate;
      reviewer: string;
      comment?: string;
    }
  | {
      subjectType: GovernanceReviewSubjectType.DeliveryArtifact;
      subjectId: string;
      decision:
        | GovernanceReviewDecisionType.Approved
        | GovernanceReviewDecisionType.Rejected;
      reviewer: string;
      comment?: string;
    };
