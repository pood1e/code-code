export enum PipelineStatus {
  Draft = 'draft',
  Pending = 'pending',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

export enum PipelineStageStatus {
  Pending = 'pending',
  Running = 'running',
  AwaitingReview = 'awaiting_review',
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
  Cancelled = 'cancelled'
}

export enum PipelineStageType {
  Breakdown = 'breakdown',
  Evaluation = 'evaluation',
  Spec = 'spec',
  Estimate = 'estimate',
  TestDesign = 'test_design',
  TestImpl = 'test_impl',
  RedGate = 'red_gate',
  Impl = 'impl',
  GreenGate = 'green_gate',
  Refactor = 'refactor',
  QualityGate = 'quality_gate',
  Review = 'review',
  Release = 'release',
  SmokeTestGate = 'smoke_test_gate',
  HumanReview = 'human_review'
}

export enum StageExecutionAttemptStatus {
  Pending = 'pending',
  Running = 'running',
  WaitingRepair = 'waiting_repair',
  Succeeded = 'succeeded',
  Failed = 'failed',
  NeedsHumanReview = 'needs_human_review',
  ResolvedByHuman = 'resolved_by_human',
  Cancelled = 'cancelled'
}

export enum HumanReviewAction {
  Retry = 'retry',
  EditAndContinue = 'edit_and_continue',
  Skip = 'skip',
  Terminate = 'terminate'
}

export enum HumanReviewReason {
  AgentTimeout = 'AGENT_TIMEOUT',
  AgentRuntimeError = 'AGENT_RUNTIME_ERROR',
  ParseFailed = 'PARSE_FAILED',
  ManualEscalation = 'MANUAL_ESCALATION',
  EvaluationRejected = 'EVALUATION_REJECTED'
}

export type ArtifactContentType =
  | 'application/json'
  | 'text/markdown'
  | 'text/typescript'
  | 'text/plain';

export enum PipelineArtifactKey {
  Prd = 'prd',
  AcSpec = 'ac_spec',
  PlanReport = 'plan_report'
}

export type PipelineArtifactMetadata = {
  artifactKey: PipelineArtifactKey;
  attempt: number;
  version: number;
};

export type ArtifactRef = {
  filePath: string;
  summary: string;
};

export type PRDTask = {
  id: string;
  title: string;
  description: string;
  interface?: string;
  dependencies: string[];
  type: 'api' | 'ui' | 'infra' | 'other';
  estimatedAC: number;
};

export type PRD = {
  feature: string;
  userStories: string[];
  systemBoundary: { in: string[]; out: string[]; outOfScope: string[] };
  ambiguities: string[];
  tasks: PRDTask[];
};

export type AcceptanceCriterion = {
  id: string;
  given: string;
  when: string;
  then: string;
};

export type TaskACSpec = {
  taskId: string;
  ac: AcceptanceCriterion[];
};

export type PlanReport = {
  totalEstimateDays: number;
  confidence: number;
  taskEstimates: Array<{
    taskId: string;
    title: string;
    estimateDays: number;
    complexity: 'low' | 'medium' | 'high';
    risks: string[];
  }>;
  overallRisks: string[];
  assumptions: string[];
  notes?: string;
};

export const PIPELINE_RUNTIME_STAGE_KEYS = [
  'breakdown',
  'evaluation',
  'spec',
  'estimate',
  'human_review',
  'complete'
] as const;

export type PipelineRuntimeStageKey =
  (typeof PIPELINE_RUNTIME_STAGE_KEYS)[number];

export type ReviewableStageKey = Exclude<
  PipelineRuntimeStageKey,
  'evaluation' | 'human_review' | 'complete'
>;

export type PipelineRetryBudget = {
  breakdown: {
    remaining: number;
    agentFailureCount: number;
    evaluationRejectCount: number;
  };
  spec: {
    remaining: number;
  };
  estimate: {
    remaining: number;
  };
};

export type HumanReviewState = {
  reason: HumanReviewReason;
  sourceStageKey: ReviewableStageKey | null;
  sourceAttemptId: string | null;
  summary: string;
  candidateOutput?: unknown;
  suggestedActions: HumanReviewAction[];
  reviewerAction?: HumanReviewAction | null;
  reviewerComment?: string | null;
};

export type PipelineRuntimeState = {
  currentStageKey: PipelineRuntimeStageKey;
  config: PipelineConfig;
  retryBudget: PipelineRetryBudget;
  artifacts: {
    prd: PRD | ArtifactRef | null;
    acSpec: TaskACSpec[] | ArtifactRef | null;
    planReport: PlanReport | null;
  };
  feedback: {
    breakdownRejectionHistory: string[];
    humanReview: HumanReviewState | null;
  };
  lastError: {
    stageKey: string | null;
    attemptId: string | null;
    code: string | null;
    message: string | null;
    at: string | null;
  } | null;
};

export type PipelineAgentConfig = {
  workspaceResources: Array<'code' | 'doc'>;
  skillIds: string[];
  ruleIds: string[];
  mcps: Array<{
    resourceId: string;
    configOverride?: Record<string, unknown>;
  }>;
  runnerSessionConfig: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
};

export type StageExecutionAttemptSummary = {
  id: string;
  stageId: string;
  attemptNo: number;
  status: StageExecutionAttemptStatus;
  sessionId: string | null;
  activeRequestMessageId: string | null;
  reviewReason: HumanReviewReason | null;
  failureCode: string | null;
  failureMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineHumanReviewArtifactSummary = {
  artifactId: string;
  artifactKey: PipelineArtifactKey | null;
  name: string;
  contentType: ArtifactContentType;
  attempt: number | null;
  version: number | null;
};

export type PipelineHumanReviewPayload = {
  reason: HumanReviewReason;
  sourceStageKey: ReviewableStageKey | null;
  sourceAttemptId: string | null;
  sourceSessionId: string | null;
  summary: string;
  candidateOutput: unknown | null;
  suggestedActions: HumanReviewAction[];
  reviewerComment: string | null;
  attempts: StageExecutionAttemptSummary[];
  artifacts: PipelineHumanReviewArtifactSummary[];
};

export type PipelineSummary = {
  id: string;
  scopeId: string;
  runnerId: string | null;
  name: string;
  description: string | null;
  status: PipelineStatus;
  currentStageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineDetail = PipelineSummary & {
  featureRequest: string | null;
  stages: PipelineStageSummary[];
  artifacts: PipelineArtifactSummary[];
  humanReview: PipelineHumanReviewPayload | null;
};

export type PipelineStageSummary = {
  id: string;
  pipelineId: string;
  name: string;
  stageType: PipelineStageType;
  order: number;
  status: PipelineStageStatus;
  retryCount: number;
  attemptCount: number;
  latestFailureReason: string | null;
  attempts: StageExecutionAttemptSummary[];
  createdAt: string;
  updatedAt: string;
};

export type PipelineArtifactSummary = {
  id: string;
  pipelineId: string;
  stageId: string | null;
  name: string;
  contentType: ArtifactContentType;
  storageRef: string | null;
  metadata: PipelineArtifactMetadata | null;
  createdAt: string;
};

export type CreatePipelineInput = {
  scopeId: string;
  name: string;
  description?: string | null;
  featureRequest?: string | null;
};

export type UpdatePipelineInput = {
  name?: string;
  description?: string | null;
  featureRequest?: string | null;
};

export type PipelineHumanReviewDecision =
  | {
      action: HumanReviewAction.Retry;
      comment?: string;
    }
  | {
      action: HumanReviewAction.EditAndContinue;
      comment?: string;
      editedOutput: unknown;
    }
  | {
      action: HumanReviewAction.Skip;
      comment: string;
    }
  | {
      action: HumanReviewAction.Terminate;
      comment: string;
    };

export type SubmitHumanDecisionInput = {
  decision: PipelineHumanReviewDecision;
};

export type CreatePipelineArtifactInput = {
  stageId?: string | null;
  name: string;
  contentType: ArtifactContentType;
  content: string;
  metadata?: Record<string, unknown> | null;
};

export type PipelineConfig = {
  maxRetry: number;
  requireHumanReviewOnSuccess: boolean;
};

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  maxRetry: 3,
  requireHumanReviewOnSuccess: true
};

export type StartPipelineInput = {
  runnerId: string;
  config?: Partial<PipelineConfig>;
};

export const PIPELINE_EVENT_KINDS = [
  'pipeline_started',
  'stage_started',
  'stage_completed',
  'stage_failed',
  'pipeline_paused',
  'pipeline_resumed',
  'pipeline_completed',
  'pipeline_failed',
  'pipeline_cancelled'
] as const;

export type PipelineEventKind = (typeof PIPELINE_EVENT_KINDS)[number];

export type PipelineEvent = {
  kind: PipelineEventKind;
  pipelineId: string;
  eventId: number;
  stageId?: string;
  stageType?: PipelineStageType;
  timestamp: string;
  data?: Record<string, unknown>;
};
