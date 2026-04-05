import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { PipelineStatus } from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { PIPELINE_ARTIFACT_STATUS } from './pipeline-artifact.constants';
import type {
  PipelineArtifactRecord,
  PipelineDetailRecord,
  PipelineRecord,
  PipelineStageRecord
} from './pipeline.repository';
import { PipelineRepository } from './pipeline.repository';

type PipelineRow = Prisma.PipelineGetPayload<object>;
type PipelineStageRow = Prisma.PipelineStageGetPayload<object>;
type PipelineArtifactRow = Prisma.PipelineArtifactGetPayload<object>;
type PipelineDetailRow = Prisma.PipelineGetPayload<{
  include: {
    stages: true;
    artifacts: {
      where: {
        status: string;
      };
    };
  };
}>;

@Injectable()
export class PrismaPipelineRepository extends PipelineRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async projectExists(scopeId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: scopeId },
      select: { id: true }
    });

    return project !== null;
  }

  async runnerExists(runnerId: string): Promise<boolean> {
    const runner = await this.prisma.agentRunner.findUnique({
      where: { id: runnerId },
      select: { id: true }
    });

    return runner !== null;
  }

  createPipeline(input: {
    scopeId: string;
    name: string;
    description?: string | null;
    featureRequest?: string | null;
  }): Promise<PipelineRecord> {
    return this.prisma.pipeline
      .create({
        data: {
          scopeId: input.scopeId,
          name: input.name,
          description: input.description ?? null,
          featureRequest: input.featureRequest ?? null
        }
      })
      .then(toPipelineRecord);
  }

  async findPipelineById(id: string): Promise<PipelineRecord | null> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id }
    });

    return pipeline ? toPipelineRecord(pipeline) : null;
  }

  updatePipeline(
    id: string,
    input: {
      name?: string;
      description?: string | null;
      featureRequest?: string | null;
    }
  ): Promise<PipelineRecord> {
    return this.prisma.pipeline
      .update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.featureRequest !== undefined
            ? { featureRequest: input.featureRequest }
            : {})
        }
      })
      .then(toPipelineRecord);
  }

  async deletePipeline(id: string): Promise<void> {
    await this.prisma.pipeline.delete({
      where: { id }
    });
  }

  async listPipelines(
    scopeId?: string,
    status?: PipelineStatus
  ): Promise<PipelineRecord[]> {
    const pipelines = await this.prisma.pipeline.findMany({
      where: {
        ...(scopeId ? { scopeId } : {}),
        ...(status ? { status } : {})
      },
      orderBy: { createdAt: 'desc' }
    });

    return pipelines.map(toPipelineRecord);
  }

  async getPipelineDetail(id: string): Promise<PipelineDetailRecord | null> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: true,
        artifacts: {
          where: {
            status: PIPELINE_ARTIFACT_STATUS.Ready
          }
        }
      }
    });

    return pipeline ? toPipelineDetailRecord(pipeline) : null;
  }

  async getPipelineStages(id: string): Promise<PipelineStageRecord[]> {
    const stages = await this.prisma.pipelineStage.findMany({
      where: { pipelineId: id },
      orderBy: { order: 'asc' }
    });

    return stages.map(toPipelineStageRecord);
  }

  async getReadyArtifactsByPipelineId(
    pipelineId: string
  ): Promise<PipelineArtifactRecord[]> {
    const artifacts = await this.prisma.pipelineArtifact.findMany({
      where: {
        pipelineId,
        status: PIPELINE_ARTIFACT_STATUS.Ready
      },
      orderBy: { createdAt: 'desc' }
    });

    return artifacts.map(toPipelineArtifactRecord);
  }
}

function toPipelineDetailRecord(pipeline: PipelineDetailRow): PipelineDetailRecord {
  return {
    ...toPipelineRecord(pipeline),
    stages: pipeline.stages.map(toPipelineStageRecord),
    artifacts: pipeline.artifacts.map(toPipelineArtifactRecord)
  };
}

export function toPipelineRecord(pipeline: PipelineRow): PipelineRecord {
  return {
    id: pipeline.id,
    scopeId: pipeline.scopeId,
    runnerId: pipeline.runnerId,
    name: pipeline.name,
    description: pipeline.description,
    featureRequest: pipeline.featureRequest,
    status: pipeline.status as PipelineStatus,
    currentStageId: pipeline.currentStageId,
    executionOwnerId: pipeline.executionOwnerId,
    executionLeaseExpiresAt: pipeline.executionLeaseExpiresAt,
    state: pipeline.state,
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt
  };
}

export function toPipelineStageRecord(stage: PipelineStageRow): PipelineStageRecord {
  return {
    id: stage.id,
    pipelineId: stage.pipelineId,
    name: stage.name,
    stageType: stage.stageType as PipelineStageRecord['stageType'],
    order: stage.order,
    status: stage.status as PipelineStageRecord['status'],
    retryCount: stage.retryCount,
    sessionId: stage.sessionId,
    createdAt: stage.createdAt,
    updatedAt: stage.updatedAt
  };
}

export function toPipelineArtifactRecord(
  artifact: PipelineArtifactRow
): PipelineArtifactRecord {
  return {
    id: artifact.id,
    pipelineId: artifact.pipelineId,
    stageId: artifact.stageId,
    artifactKey: artifact.artifactKey,
    attempt: artifact.attempt,
    version: artifact.version,
    status: artifact.status as PipelineArtifactRecord['status'],
    materializerOwnerId: artifact.materializerOwnerId,
    materializerLeaseExpiresAt: artifact.materializerLeaseExpiresAt,
    name: artifact.name,
    contentType: artifact.contentType as PipelineArtifactRecord['contentType'],
    storageRef: artifact.storageRef,
    content: artifact.content,
    lastError: artifact.lastError,
    materializeAttempts: artifact.materializeAttempts,
    metadata: artifact.metadata,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt
  };
}
