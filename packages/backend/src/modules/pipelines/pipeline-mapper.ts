import type {
  ArtifactContentType,
  PipelineArtifactKey,
  PipelineArtifactMetadata,
  PipelineArtifactSummary,
  PipelineDetail,
  PipelineStageSummary,
  PipelineSummary
} from '@agent-workbench/shared';

import type {
  PipelineArtifactRecord,
  PipelineDetailRecord,
  PipelineRecord,
  PipelineStageRecord
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
      .map(toPipelineArtifactSummary)
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
    sessionId: stage.sessionId,
    createdAt: stage.createdAt.toISOString(),
    updatedAt: stage.updatedAt.toISOString()
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
