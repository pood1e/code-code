import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { toOptionalInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { PIPELINE_ARTIFACT_STATUS } from './pipeline-artifact.constants';
import type {
  CreatePipelineArtifactIntentInput
} from './pipeline-artifact.repository';
import { PipelineArtifactRepository } from './pipeline-artifact.repository';
import type { PipelineArtifactRecord } from './pipeline.repository';
import { toPipelineArtifactRecord } from './prisma-pipeline.repository';

@Injectable()
export class PrismaPipelineArtifactRepository extends PipelineArtifactRepository {
  constructor(private readonly prisma: PrismaService) {
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
        status: PIPELINE_ARTIFACT_STATUS.Pending,
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
    artifactKey: string;
    attempt: number;
    name: string;
    contentType: string;
    content: string;
  }): Promise<PipelineArtifactRecord> {
    const artifact = await this.prisma.$transaction(async (tx) => {
      const version = await this.reserveManagedArtifactVersion(
        tx,
        input.pipelineId,
        input.artifactKey
      );

      return tx.pipelineArtifact.create({
        data: {
          pipelineId: input.pipelineId,
          ...(input.stageId ? { stageId: input.stageId } : {}),
          artifactKey: input.artifactKey,
          attempt: input.attempt,
          version,
          status: PIPELINE_ARTIFACT_STATUS.Pending,
          name: input.name,
          contentType: input.contentType,
          content: input.content
        }
      });
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
        status: PIPELINE_ARTIFACT_STATUS.Processing,
        materializerOwnerId: ownerId
      },
      data: {
        status: PIPELINE_ARTIFACT_STATUS.Ready,
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
        status: PIPELINE_ARTIFACT_STATUS.Processing,
        materializerOwnerId: ownerId
      },
      data: {
        status: PIPELINE_ARTIFACT_STATUS.Failed,
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
  private async reserveManagedArtifactVersion(
    tx: Prisma.TransactionClient,
    pipelineId: string,
    artifactKey: string
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ version: number | bigint }>>`
      INSERT INTO "PipelineArtifactSeries" (
        "pipelineId",
        "artifactKey",
        "nextVersion",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${pipelineId},
        ${artifactKey},
        2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("pipelineId", "artifactKey")
      DO UPDATE SET
        "nextVersion" = "PipelineArtifactSeries"."nextVersion" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "nextVersion" - 1 AS "version"
    `;

    const rawVersion = rows.at(0)?.version;
    const version =
      typeof rawVersion === 'bigint' ? Number(rawVersion) : rawVersion;
    if (!version || !Number.isSafeInteger(version) || version < 1) {
      throw new Error(
        `Failed to allocate artifact version for ${pipelineId}/${artifactKey}`
      );
    }

    return version;
  }
}
