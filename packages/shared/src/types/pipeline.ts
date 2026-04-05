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
  // Pipeline 1: Plan
  Breakdown = 'breakdown',
  Evaluation = 'evaluation',
  Spec = 'spec',
  Estimate = 'estimate',

  // Pipeline 2: Test Design
  TestDesign = 'test_design',

  // Pipeline 3: Test Impl
  TestImpl = 'test_impl',
  RedGate = 'red_gate',

  // Pipeline 4: Build
  Impl = 'impl',
  GreenGate = 'green_gate',

  // Pipeline 5: Quality
  Refactor = 'refactor',
  QualityGate = 'quality_gate',
  Review = 'review',

  // Pipeline 6: Release
  Release = 'release',
  SmokeTestGate = 'smoke_test_gate',

  // Generic
  HumanReview = 'human_review'
}

export enum HumanDecisionAction {
  Approve = 'approve',
  Modify = 'modify',
  Reject = 'reject'
}

export type HumanDecision = {
  action: HumanDecisionAction;
  feedback?: string;
};

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
};

export type PipelineStageSummary = {
  id: string;
  pipelineId: string;
  name: string;
  stageType: PipelineStageType;
  order: number;
  status: PipelineStageStatus;
  retryCount: number;
  sessionId: string | null;
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

export type SubmitHumanDecisionInput = {
  decision: HumanDecision;
};

export type CreatePipelineArtifactInput = {
  stageId?: string | null;
  name: string;
  contentType: ArtifactContentType;
  content: string;
  metadata?: Record<string, unknown> | null;
};

// ─── Plan Pipeline: PRD & AC Spec ────────────────────────────────────────────

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

export type BreakdownMode = 'full' | 'partial' | 'split';

export type BreakdownFeedback = {
  mode: BreakdownMode;
  targetTaskIds?: string[];
  reason: string;
  suggestion?: string;
};

// ─── Pipeline Runtime Config ──────────────────────────────────────────────────

export type PipelineConfig = {
  /** Maximum breakdown/evaluation retry loops before Pipeline → failed. Default: 3 */
  maxRetry: number;
};

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  maxRetry: 3
};

export type StartPipelineInput = {
  runnerId: string;
  config?: Partial<PipelineConfig>;
};

// ─── Pipeline SSE Events ──────────────────────────────────────────────────────

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
