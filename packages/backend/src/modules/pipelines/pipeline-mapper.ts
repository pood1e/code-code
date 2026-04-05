import type { Prisma } from '@prisma/client';

import type {
  ArtifactContentType,
  PipelineArtifactKey,
  PipelineArtifactMetadata,
  PipelineArtifactSummary,
  PipelineDetail,
  PipelineStageStatus,
  PipelineStageType,
  PipelineStageSummary,
  PipelineStatus,
  PipelineSummary
} from '@agent-workbench/shared';

import { sanitizeJson } from '../../common/json.utils';

type PipelineRow = Prisma.PipelineGetPayload<object>;
type PipelineStageRow = Prisma.PipelineStageGetPayload<object>;
type PipelineArtifactRow = Prisma.PipelineArtifactGetPayload<object>;

type PipelineWithRelations = Prisma.PipelineGetPayload<{
  include: { stages: true; artifacts: true };
}>;

export function toPipelineSummary(pipeline: PipelineRow): PipelineSummary {
  return {
    id: pipeline.id,
    scopeId: pipeline.scopeId,
    runnerId: pipeline.runnerId,
    name: pipeline.name,
    description: pipeline.description,
    status: pipeline.status as PipelineStatus,
    currentStageId: pipeline.currentStageId,
    createdAt: pipeline.createdAt.toISOString(),
    updatedAt: pipeline.updatedAt.toISOString()
  };
}

export function toPipelineDetail(
  pipeline: PipelineWithRelations
): PipelineDetail {
  return {
    ...toPipelineSummary(pipeline),
    featureRequest: pipeline.featureRequest,
    stages: pipeline.stages
      .slice()
      .sort(
        (a: PipelineStageRow, b: PipelineStageRow) => a.order - b.order
      )
      .map(toPipelineStageSummary),
    artifacts: pipeline.artifacts
      .slice()
      .sort(compareArtifacts)
      .map(toPipelineArtifactSummary)
  };
}

export function toPipelineStageSummary(
  stage: PipelineStageRow
): PipelineStageSummary {
  return {
    id: stage.id,
    pipelineId: stage.pipelineId,
    name: stage.name,
    stageType: stage.stageType as PipelineStageType,
    order: stage.order,
    status: stage.status as PipelineStageStatus,
    retryCount: stage.retryCount,
    sessionId: stage.sessionId,
    createdAt: stage.createdAt.toISOString(),
    updatedAt: stage.updatedAt.toISOString()
  };
}

export function toPipelineArtifactSummary(
  artifact: PipelineArtifactRow
): PipelineArtifactSummary {
  const metadata = parsePipelineArtifactMetadata(artifact.metadata);

  return {
    id: artifact.id,
    pipelineId: artifact.pipelineId,
    stageId: artifact.stageId,
    name: artifact.name,
    contentType: artifact.contentType as ArtifactContentType,
    storageRef: artifact.storageRef,
    metadata,
    createdAt: artifact.createdAt.toISOString()
  };
}

function compareArtifacts(left: PipelineArtifactRow, right: PipelineArtifactRow) {
  if (left.version !== right.version) {
    return right.version - left.version;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

function parsePipelineArtifactMetadata(
  value: Prisma.JsonValue | null
): PipelineArtifactMetadata | null {
  if (!value) {
    return null;
  }

  const metadata = sanitizeJson(value) as Record<string, unknown>;
  const artifactKey = metadata.artifactKey;
  const attempt = metadata.attempt;
  const version = metadata.version;

  if (
    !isPipelineArtifactKey(artifactKey) ||
    typeof attempt !== 'number' ||
    !Number.isInteger(attempt) ||
    attempt < 1 ||
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return null;
  }

  return {
    artifactKey,
    attempt,
    version
  };
}

function isPipelineArtifactKey(value: unknown): value is PipelineArtifactKey {
  return (
    value === 'prd' || value === 'ac_spec' || value === 'plan_report'
  );
}
