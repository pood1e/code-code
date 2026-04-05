import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  HumanReviewReason,
  StageExecutionAttemptStatus,
  type PipelineAgentConfig
} from '@agent-workbench/shared';

import { toInputJson, toOptionalInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { toStageExecutionAttemptRecord } from './prisma-pipeline.repository';
import type { StageExecutionAttemptRecord } from './pipeline.repository';

@Injectable()
export class PipelineStageAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestAttempt(stageId: string): Promise<StageExecutionAttemptRecord | null> {
    const attempt = await this.prisma.stageExecutionAttempt.findFirst({
      where: { stageId },
      orderBy: [{ attemptNo: 'desc' }, { createdAt: 'desc' }]
    });

    return attempt ? toStageExecutionAttemptRecord(attempt) : null;
  }

  async createAttempt(input: {
    stageId: string;
    resolvedAgentConfig: PipelineAgentConfig;
    inputSnapshot: Record<string, unknown>;
    ownerLeaseToken?: string;
    leaseExpiresAt?: Date;
  }): Promise<StageExecutionAttemptRecord> {
    const attempt = await this.prisma.$transaction(async (tx) => {
      const latestAttempt = await tx.stageExecutionAttempt.findFirst({
        where: { stageId: input.stageId },
        orderBy: [{ attemptNo: 'desc' }, { createdAt: 'desc' }]
      });

      return tx.stageExecutionAttempt.create({
        data: {
          stageId: input.stageId,
          attemptNo: (latestAttempt?.attemptNo ?? 0) + 1,
          status: StageExecutionAttemptStatus.Pending,
          resolvedAgentConfig: toInputJson(
            input.resolvedAgentConfig as unknown as Prisma.InputJsonValue
          ),
          inputSnapshot: toInputJson(
            input.inputSnapshot as unknown as Prisma.InputJsonValue
          ),
          ownerLeaseToken: input.ownerLeaseToken ?? null,
          leaseExpiresAt: input.leaseExpiresAt ?? null
        }
      });
    });

    return toStageExecutionAttemptRecord(attempt);
  }

  async claimAttempt(input: {
    attemptId: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<StageExecutionAttemptRecord | null> {
    const claimed = await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        status: {
          in: [
            StageExecutionAttemptStatus.Pending,
            StageExecutionAttemptStatus.Running,
            StageExecutionAttemptStatus.WaitingRepair
          ]
        },
        OR: [
          { ownerLeaseToken: null },
          { ownerLeaseToken: input.ownerLeaseToken },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: input.now } }
        ]
      },
      data: {
        ownerLeaseToken: input.ownerLeaseToken,
        leaseExpiresAt: input.leaseExpiresAt
      }
    });

    if (claimed.count !== 1) {
      return null;
    }

    const attempt = await this.prisma.stageExecutionAttempt.findUnique({
      where: { id: input.attemptId }
    });
    return attempt ? toStageExecutionAttemptRecord(attempt) : null;
  }

  async markRunning(input: {
    attemptId: string;
    ownerLeaseToken: string;
    leaseExpiresAt: Date;
  }): Promise<boolean> {
    const updated = await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        status: StageExecutionAttemptStatus.Running,
        ownerLeaseToken: input.ownerLeaseToken,
        leaseExpiresAt: input.leaseExpiresAt,
        startedAt: new Date()
      }
    });

    return updated.count === 1;
  }

  async attachSession(input: {
    attemptId: string;
    ownerLeaseToken: string;
    sessionId: string;
    activeRequestMessageId: string | null;
  }): Promise<boolean> {
    const updated = await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        sessionId: input.sessionId,
        activeRequestMessageId: input.activeRequestMessageId
      }
    });

    return updated.count === 1;
  }

  async updateActiveRequestMessage(input: {
    attemptId: string;
    ownerLeaseToken: string;
    activeRequestMessageId: string | null;
  }): Promise<boolean> {
    const updated = await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        activeRequestMessageId: input.activeRequestMessageId
      }
    });

    return updated.count === 1;
  }

  async markWaitingRepair(input: {
    attemptId: string;
    ownerLeaseToken: string;
    activeRequestMessageId: string | null;
    failureCode: string;
    failureMessage: string;
    candidateOutput?: unknown;
  }): Promise<boolean> {
    const updated = await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        status: StageExecutionAttemptStatus.WaitingRepair,
        activeRequestMessageId: input.activeRequestMessageId,
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        candidateOutput: toOptionalInputJson(
          input.candidateOutput as Prisma.InputJsonValue | undefined
        )
      }
    });

    return updated.count === 1;
  }

  async markSucceeded(input: {
    attemptId: string;
    ownerLeaseToken: string;
    activeRequestMessageId: string | null;
    candidateOutput?: unknown;
    parsedOutput: unknown;
  }): Promise<boolean> {
    const updated = await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        status: StageExecutionAttemptStatus.Succeeded,
        activeRequestMessageId: input.activeRequestMessageId,
        candidateOutput: toOptionalInputJson(
          input.candidateOutput as Prisma.InputJsonValue | undefined
        ),
        parsedOutput: toInputJson(
          input.parsedOutput as unknown as Prisma.InputJsonValue
        ),
        finishedAt: new Date(),
        ownerLeaseToken: null,
        leaseExpiresAt: null,
        reviewReason: null,
        failureCode: null,
        failureMessage: null
      }
    });

    return updated.count === 1;
  }

  async markFailed(input: {
    attemptId: string;
    ownerLeaseToken: string;
    reviewReason: HumanReviewReason | null;
    failureCode: string;
    failureMessage: string;
    candidateOutput?: unknown;
  }): Promise<boolean> {
    const updated = await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        status: input.reviewReason
          ? StageExecutionAttemptStatus.NeedsHumanReview
          : StageExecutionAttemptStatus.Failed,
        reviewReason: input.reviewReason,
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        candidateOutput: toOptionalInputJson(
          input.candidateOutput as Prisma.InputJsonValue | undefined
        ),
        finishedAt: new Date(),
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });

    return updated.count === 1;
  }

  async markResolvedByHuman(attemptId: string): Promise<void> {
    await this.prisma.stageExecutionAttempt.update({
      where: { id: attemptId },
      data: {
        status: StageExecutionAttemptStatus.ResolvedByHuman,
        finishedAt: new Date(),
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });
  }

  async renewLease(input: {
    attemptId: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<boolean> {
    const updated = await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken,
        leaseExpiresAt: { gte: input.now }
      },
      data: {
        leaseExpiresAt: input.leaseExpiresAt
      }
    });

    return updated.count === 1;
  }

  async releaseLease(input: {
    attemptId: string;
    ownerLeaseToken: string;
  }): Promise<boolean> {
    const updated = await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });

    return updated.count === 1;
  }

}
