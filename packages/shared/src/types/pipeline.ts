export enum PipelineStatus {
  Draft = 'draft',
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
  Skipped = 'skipped'
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

export type PipelineSummary = {
  id: string;
  scopeId: string;
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
  storageRef: string;
  metadata: Record<string, unknown> | null;
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
