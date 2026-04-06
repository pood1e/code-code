import { PipelineArtifactKey } from '@agent-workbench/shared';

import type {
  PipelineArtifactRecord,
  PipelineHumanReviewRecord,
  StageExecutionAttemptRecord
} from './pipeline.repository';
import type { PipelineRuntimeState } from './pipeline-runtime-state';

export function buildPipelineHumanReviewRecord(input: {
  humanReview: PipelineRuntimeState['feedback']['humanReview'];
  attempts: StageExecutionAttemptRecord[];
  artifacts: PipelineArtifactRecord[];
}): PipelineHumanReviewRecord | null {
  if (!input.humanReview) {
    return null;
  }
  const humanReview = input.humanReview;

  const sourceAttempt = humanReview.sourceAttemptId
    ? input.attempts.find((attempt) => attempt.id === humanReview.sourceAttemptId) ??
      null
    : null;

  return {
    reason: humanReview.reason,
    sourceStageKey: humanReview.sourceStageKey,
    sourceAttemptId: humanReview.sourceAttemptId,
    sourceSessionId: sourceAttempt?.sessionId ?? null,
    summary: humanReview.summary,
    candidateOutput: humanReview.candidateOutput ?? null,
    suggestedActions: humanReview.suggestedActions,
    reviewerComment: humanReview.reviewerComment ?? null,
    attempts: input.attempts,
    artifacts: input.artifacts.map((artifact) => ({
      artifactId: artifact.id,
      artifactKey: toPipelineArtifactKey(artifact.artifactKey),
      name: artifact.name,
      contentType: artifact.contentType,
      attempt: artifact.attempt,
      version: artifact.version
    }))
  };
}

function toPipelineArtifactKey(value: string | null): PipelineArtifactKey | null {
  switch (value) {
    case PipelineArtifactKey.Prd:
      return PipelineArtifactKey.Prd;
    case PipelineArtifactKey.AcSpec:
      return PipelineArtifactKey.AcSpec;
    case PipelineArtifactKey.PlanReport:
      return PipelineArtifactKey.PlanReport;
    default:
      return null;
  }
}
