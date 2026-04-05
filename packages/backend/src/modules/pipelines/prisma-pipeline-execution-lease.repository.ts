import { Injectable } from '@nestjs/common';

import { PipelineStatus } from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { PIPELINE_ARTIFACT_STATUS } from './pipeline-artifact.constants';
import { PipelineExecutionLeaseRepository } from './pipeline-execution-lease.repository';
import type { ClaimedPipelineRecord } from './pipeline-runtime.repository';
import { toPipelineArtifactRecord } from './prisma-pipeline.repository';

@Injectable()
export class PrismaPipelineExecutionLeaseRepository extends PipelineExecutionLeaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async claimPipelineExecution(input: {
    ownerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<ClaimedPipelineRecord | null> {
    const candidate = await this.prisma.pipeline.findFirst({
      where: {
        OR: [
          { status: PipelineStatus.Pending },
          {
            status: PipelineStatus.Running,
            OR: [
              { executionLeaseExpiresAt: null },
              { executionLeaseExpiresAt: { lt: input.now } }
            ]
          }
        ]
      },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        featureRequest: true,
        state: true
      }
    });

    if (!candidate) {
      return null;
    }

    const claimed = await this.prisma.pipeline.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: PipelineStatus.Pending },
          {
            status: PipelineStatus.Running,
            OR: [
              { executionLeaseExpiresAt: null },
              { executionLeaseExpiresAt: { lt: input.now } }
            ]
          }
        ]
      },
      data: {
        status: PipelineStatus.Running,
        executionOwnerId: input.ownerId,
        executionLeaseExpiresAt: input.leaseExpiresAt
      }
    });

    return claimed.count === 1 ? candidate : null;
  }

  renewPipelineExecutionLease(input: {
    pipelineId: string;
    ownerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<boolean> {
    return this.prisma.pipeline
      .updateMany({
        where: {
          id: input.pipelineId,
          status: PipelineStatus.Running,
          executionOwnerId: input.ownerId,
          executionLeaseExpiresAt: { gte: input.now }
        },
        data: {
          executionLeaseExpiresAt: input.leaseExpiresAt
        }
      })
      .then((result) => result.count === 1);
  }

  async claimArtifactMaterialization(input: {
    ownerId: string;
    now: Date;
    retryBefore: Date;
    leaseExpiresAt: Date;
  }) {
    const candidate = await this.prisma.pipelineArtifact.findFirst({
      where: {
        content: { not: null },
        OR: [
          { status: PIPELINE_ARTIFACT_STATUS.Pending },
          {
            status: PIPELINE_ARTIFACT_STATUS.Failed,
            updatedAt: { lt: input.retryBefore }
          },
          {
            status: PIPELINE_ARTIFACT_STATUS.Processing,
            OR: [
              { materializerLeaseExpiresAt: null },
              { materializerLeaseExpiresAt: { lt: input.now } }
            ]
          }
        ]
      },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }]
    });

    if (!candidate) {
      return null;
    }

    const claimed = await this.prisma.pipelineArtifact.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: PIPELINE_ARTIFACT_STATUS.Pending },
          {
            status: PIPELINE_ARTIFACT_STATUS.Failed,
            updatedAt: { lt: input.retryBefore }
          },
          {
            status: PIPELINE_ARTIFACT_STATUS.Processing,
            OR: [
              { materializerLeaseExpiresAt: null },
              { materializerLeaseExpiresAt: { lt: input.now } }
            ]
          }
        ]
      },
      data: {
        status: PIPELINE_ARTIFACT_STATUS.Processing,
        materializerOwnerId: input.ownerId,
        materializerLeaseExpiresAt: input.leaseExpiresAt
      }
    });

    if (claimed.count !== 1) {
      return null;
    }

    return toPipelineArtifactRecord({
      ...candidate,
      status: PIPELINE_ARTIFACT_STATUS.Processing,
      materializerOwnerId: input.ownerId,
      materializerLeaseExpiresAt: input.leaseExpiresAt
    });
  }

  renewArtifactMaterializationLease(input: {
    artifactId: string;
    ownerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<boolean> {
    return this.prisma.pipelineArtifact
      .updateMany({
        where: {
          id: input.artifactId,
          status: PIPELINE_ARTIFACT_STATUS.Processing,
          materializerOwnerId: input.ownerId,
          materializerLeaseExpiresAt: { gte: input.now }
        },
        data: {
          materializerLeaseExpiresAt: input.leaseExpiresAt
        }
      })
      .then((result) => result.count === 1);
  }
}
