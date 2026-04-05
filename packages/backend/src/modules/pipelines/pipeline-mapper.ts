import type { Prisma } from '@prisma/client';

import type {
  ArtifactContentType,
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
    artifacts: pipeline.artifacts.map(toPipelineArtifactSummary)
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
  return {
    id: artifact.id,
    pipelineId: artifact.pipelineId,
    stageId: artifact.stageId,
    name: artifact.name,
    contentType: artifact.contentType as ArtifactContentType,
    storageRef: artifact.storageRef,
    metadata: artifact.metadata
      ? (sanitizeJson(artifact.metadata) as Record<string, unknown>)
      : null,
    createdAt: artifact.createdAt.toISOString()
  };
}
