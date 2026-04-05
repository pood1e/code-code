import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { toOptionalInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import type { PipelineArtifactKey } from '@agent-workbench/shared';
import { PIPELINE_ARTIFACT_STATUS } from './pipeline-artifact.constants';
import { PipelineArtifactVersionRepository } from './pipeline-artifact-version.repository';
import type {
  CreatePipelineArtifactIntentInput
} from './pipeline-artifact.repository';
import { PipelineArtifactRepository } from './pipeline-artifact.repository';
import type { PipelineArtifactRecord } from './pipeline.repository';
import { toPipelineArtifactRecord } from './prisma-pipeline.repository';

@Injectable()
export class PrismaPipelineArtifactRepository extends PipelineArtifactRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineArtifactVersionRepository: PipelineArtifactVersionRepository
  ) {
    super();
  }

  async createArtifactIntent(
    input: CreatePipelineArtifactIntentInput
  ): Promise<PipelineArtifactRecord> {
    const artifact = await this.prisma.pipelineArtifact.create({
      data: {
        pipelineId: input.pipelineId,
        ...(input.stageId ? { stageId: input.stageId } : {}),
        ...(input.artifactKey ? { artifactKey: input.artifactKey } : {}),
        ...(input.attempt !== undefined && input.attempt !== null
          ? { attempt: input.attempt }
          : {}),
        status: PIPELINE_ARTIFACT_STATUS.Ready,
        name: input.name,
        contentType: input.contentType,
        content: input.content,
        ...(input.metadata
          ? {
              metadata: toOptionalInputJson(
                input.metadata as Prisma.InputJsonValue | undefined
              )
            }
          : {})
      }
    });

    return toPipelineArtifactRecord(artifact);
  }

  async createManagedArtifactIntent(input: {
    pipelineId: string;
    stageId?: string | null;
    artifactKey: PipelineArtifactKey;
    attempt: number;
    name: string;
    contentType: string;
    content: string;
  }): Promise<PipelineArtifactRecord> {
    const version =
      await this.pipelineArtifactVersionRepository.reserveNextVersion(
        input.pipelineId,
        input.artifactKey
      );

    const artifact = await this.prisma.pipelineArtifact.create({
      data: {
        pipelineId: input.pipelineId,
        ...(input.stageId ? { stageId: input.stageId } : {}),
        artifactKey: input.artifactKey,
        attempt: input.attempt,
        version,
        status: PIPELINE_ARTIFACT_STATUS.Ready,
        name: input.name,
        contentType: input.contentType,
        content: input.content
      }
    });

    return toPipelineArtifactRecord(artifact);
  }

  async findArtifactById(id: string): Promise<PipelineArtifactRecord | null> {
    const artifact = await this.prisma.pipelineArtifact.findUnique({
      where: { id }
    });

    return artifact ? toPipelineArtifactRecord(artifact) : null;
  }

  async listArtifactStorageRefsByPipelineId(
    pipelineId: string
  ): Promise<string[]> {
    const artifacts = await this.prisma.pipelineArtifact.findMany({
      where: {
        pipelineId,
        storageRef: {
          not: null
        }
      },
      select: {
        storageRef: true
      }
    });

    return artifacts
      .map((artifact) => artifact.storageRef)
      .filter((value): value is string => Boolean(value));
  }

  async listManagedArtifactsForAttempt(input: {
    pipelineId: string;
    attempt: number;
    artifactKeys: readonly string[];
  }): Promise<PipelineArtifactRecord[]> {
    const artifacts = await this.prisma.pipelineArtifact.findMany({
      where: {
        pipelineId: input.pipelineId,
        attempt: input.attempt,
        artifactKey: {
          in: [...input.artifactKeys]
        }
      },
      orderBy: [
        { artifactKey: 'asc' },
        { version: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const latestByArtifactKey = new Map<string, PipelineArtifactRecord>();
    for (const artifact of artifacts) {
      if (!artifact.artifactKey || latestByArtifactKey.has(artifact.artifactKey)) {
        continue;
      }

      latestByArtifactKey.set(artifact.artifactKey, toPipelineArtifactRecord(artifact));
    }

    return [...latestByArtifactKey.values()];
  }

  async markArtifactReady(
    artifactId: string,
    ownerId: string,
    storageRef: string
  ): Promise<boolean> {
    const result = await this.prisma.pipelineArtifact.updateMany({
      where: {
        id: artifactId,
        materializerOwnerId: ownerId
      },
      data: {
        storageRef,
        lastError: null,
        materializerOwnerId: null,
        materializerLeaseExpiresAt: null
      }
    });

    return result.count === 1;
  }

  async markArtifactFailed(
    artifactId: string,
    ownerId: string,
    reason: string
  ): Promise<boolean> {
    const result = await this.prisma.pipelineArtifact.updateMany({
      where: {
        id: artifactId,
        materializerOwnerId: ownerId
      },
      data: {
        lastError: reason,
        materializeAttempts: {
          increment: 1
        },
        materializerOwnerId: null,
        materializerLeaseExpiresAt: null
      }
    });

    return result.count === 1;
  }
}
