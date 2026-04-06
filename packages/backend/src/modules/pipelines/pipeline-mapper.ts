import type {
  ArtifactContentType,
  PipelineArtifactKey,
  PipelineArtifactMetadata,
  PipelineArtifactSummary,
  PipelineDetail,
  PipelineHumanReviewArtifactSummary,
  PipelineHumanReviewPayload,
  PipelineStageSummary,
  StageExecutionAttemptSummary,
  PipelineSummary
} from '@agent-workbench/shared';

import type {
  PipelineArtifactRecord,
  PipelineDetailRecord,
  PipelineHumanReviewArtifactRecord,
  PipelineHumanReviewRecord,
  PipelineRecord,
  PipelineStageRecord,
  StageExecutionAttemptRecord
} from './pipeline.repository';

export function toPipelineSummary(pipeline: PipelineRecord): PipelineSummary {
  return {
    id: pipeline.id,
    scopeId: pipeline.scopeId,
    runnerId: pipeline.runnerId,
    name: pipeline.name,
    description: pipeline.description,
    status: pipeline.status,
    currentStageId: pipeline.currentStageId,
    createdAt: pipeline.createdAt.toISOString(),
    updatedAt: pipeline.updatedAt.toISOString()
  };
}

export function toPipelineDetail(
  pipeline: PipelineDetailRecord
): PipelineDetail {
  return {
    ...toPipelineSummary(pipeline),
    featureRequest: pipeline.featureRequest,
    stages: pipeline.stages
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toPipelineStageSummary),
    artifacts: pipeline.artifacts
      .slice()
      .sort(compareArtifacts)
      .map(toPipelineArtifactSummary),
    humanReview: pipeline.humanReview
      ? toPipelineHumanReviewPayload(pipeline.humanReview)
      : null
  };
}

export function toPipelineStageSummary(
  stage: PipelineStageRecord
): PipelineStageSummary {
  return {
    id: stage.id,
    pipelineId: stage.pipelineId,
    name: stage.name,
    stageType: stage.stageType,
    order: stage.order,
    status: stage.status,
    retryCount: stage.retryCount,
    attemptCount: stage.attempts.length,
    latestFailureReason: stage.attempts.find((attempt) => attempt.failureMessage)
      ?.failureMessage ?? null,
    attempts: stage.attempts.map(toStageExecutionAttemptSummary),
    createdAt: stage.createdAt.toISOString(),
    updatedAt: stage.updatedAt.toISOString()
  };
}

export function toStageExecutionAttemptSummary(
  attempt: StageExecutionAttemptRecord
): StageExecutionAttemptSummary {
  return {
    id: attempt.id,
    stageId: attempt.stageId,
    attemptNo: attempt.attemptNo,
    status: attempt.status,
    sessionId: attempt.sessionId,
    activeRequestMessageId: attempt.activeRequestMessageId,
    reviewReason: attempt.reviewReason,
    failureCode: attempt.failureCode,
    failureMessage: attempt.failureMessage,
    startedAt: attempt.startedAt?.toISOString() ?? null,
    finishedAt: attempt.finishedAt?.toISOString() ?? null,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString()
  };
}

export function toPipelineArtifactSummary(
  artifact: PipelineArtifactRecord
): PipelineArtifactSummary {
  return {
    id: artifact.id,
    pipelineId: artifact.pipelineId,
    stageId: artifact.stageId,
    name: artifact.name,
    contentType: artifact.contentType as ArtifactContentType,
    storageRef: artifact.storageRef,
    metadata: toPipelineArtifactMetadata(artifact),
    createdAt: artifact.createdAt.toISOString()
  };
}

function toPipelineHumanReviewPayload(
  review: PipelineHumanReviewRecord
): PipelineHumanReviewPayload {
  return {
    ...review,
    attempts: review.attempts.map(toStageExecutionAttemptSummary),
    artifacts: review.artifacts.map(toPipelineHumanReviewArtifactSummary)
  };
}

function toPipelineHumanReviewArtifactSummary(
  artifact: PipelineHumanReviewArtifactRecord
): PipelineHumanReviewArtifactSummary {
  return artifact;
}

function compareArtifacts(left: PipelineArtifactRecord, right: PipelineArtifactRecord) {
  if (
    left.version !== null &&
    right.version !== null &&
    left.version !== right.version
  ) {
    return right.version - left.version;
  }

  if (left.version !== null && right.version === null) {
    return -1;
  }

  if (left.version === null && right.version !== null) {
    return 1;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

function toPipelineArtifactMetadata(
  artifact: PipelineArtifactRecord
): PipelineArtifactMetadata | null {
  if (
    !isPipelineArtifactKey(artifact.artifactKey) ||
    artifact.attempt === null ||
    artifact.version === null ||
    artifact.attempt < 1 ||
    artifact.version < 1
  ) {
    return null;
  }

  return {
    artifactKey: artifact.artifactKey,
    attempt: artifact.attempt,
    version: artifact.version
  };
}

function isPipelineArtifactKey(value: unknown): value is PipelineArtifactKey {
  return (
    value === 'prd' || value === 'ac_spec' || value === 'plan_report'
  );
}
