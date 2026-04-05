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

  async markRunning(input: {
    attemptId: string;
    ownerLeaseToken: string;
    leaseExpiresAt: Date;
  }): Promise<void> {
    await this.prisma.stageExecutionAttempt.update({
      where: { id: input.attemptId },
      data: {
        status: StageExecutionAttemptStatus.Running,
        ownerLeaseToken: input.ownerLeaseToken,
        leaseExpiresAt: input.leaseExpiresAt,
        startedAt: new Date()
      }
    });
  }

  async attachSession(input: {
    attemptId: string;
    sessionId: string;
    activeRequestMessageId: string | null;
  }): Promise<void> {
    await this.prisma.stageExecutionAttempt.update({
      where: { id: input.attemptId },
      data: {
        sessionId: input.sessionId,
        activeRequestMessageId: input.activeRequestMessageId
      }
    });
  }

  async markWaitingRepair(input: {
    attemptId: string;
    activeRequestMessageId: string | null;
    failureCode: string;
    failureMessage: string;
    candidateOutput?: unknown;
  }): Promise<void> {
    await this.prisma.stageExecutionAttempt.update({
      where: { id: input.attemptId },
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
  }

  async markSucceeded(input: {
    attemptId: string;
    activeRequestMessageId: string | null;
    candidateOutput?: unknown;
    parsedOutput: unknown;
  }): Promise<void> {
    await this.prisma.stageExecutionAttempt.update({
      where: { id: input.attemptId },
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
  }

  async markFailed(input: {
    attemptId: string;
    reviewReason: HumanReviewReason | null;
    failureCode: string;
    failureMessage: string;
    candidateOutput?: unknown;
  }): Promise<void> {
    await this.prisma.stageExecutionAttempt.update({
      where: { id: input.attemptId },
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
    leaseExpiresAt: Date;
  }): Promise<void> {
    await this.prisma.stageExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        leaseExpiresAt: input.leaseExpiresAt
      }
    });
  }
}
