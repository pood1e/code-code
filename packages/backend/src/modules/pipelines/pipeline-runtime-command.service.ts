import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  PipelineStageStatus,
  PipelineStageType,
  PipelineStatus,
  type PipelineEventKind
} from '@agent-workbench/shared';

import { toInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { toPipelineSummary } from './pipeline-mapper';
import { PipelineEventStore } from './pipeline-event.store';
import type { PipelineRuntimeState } from './pipeline-runtime-state';

type ClaimedPipelineRow = {
  id: string;
  featureRequest: string | null;
  state: unknown;
};

type PipelineStageRow = Prisma.PipelineStageGetPayload<object>;

@Injectable()
export class PipelineRuntimeCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineEventStore: PipelineEventStore
  ) {}

  async claimNextPendingPipeline(): Promise<ClaimedPipelineRow | null> {
    const pending = await this.prisma.pipeline.findFirst({
      where: { status: PipelineStatus.Pending },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        featureRequest: true,
        state: true
      }
    });

    if (!pending) {
      return null;
    }

    const claimed = await this.prisma.pipeline.updateMany({
      where: {
        id: pending.id,
        status: PipelineStatus.Pending
      },
      data: {
        status: PipelineStatus.Running
      }
    });

    return claimed.count === 1 ? pending : null;
  }

  async startStage(
    pipelineId: string,
    stageType: PipelineStageType
  ): Promise<PipelineStageRow | null> {
    const stage = await this.findStage(pipelineId, stageType);
    const timestamp = new Date().toISOString();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await this.markPipelineRunningStage(tx, pipelineId, stage.id);
      if (!updated) {
        return null;
      }

      const updatedStage = await tx.pipelineStage.update({
        where: { id: stage.id },
        data: {
          status: PipelineStageStatus.Running
        }
      });

      const event = await this.pipelineEventStore.appendInTransaction(tx, {
        kind: 'stage_started',
        pipelineId,
        stageId: stage.id,
        stageType,
        timestamp
      });

      return {
        updatedStage,
        events: [event]
      };
    });

    if (!result) {
      return null;
    }

    this.pipelineEventStore.publishAll(result.events);
    return result.updatedStage;
  }

  async completeStage(
    pipelineId: string,
    stage: PipelineStageRow,
    nextState: PipelineRuntimeState,
    options?: {
      retryCount?: number;
    }
  ): Promise<boolean> {
    const timestamp = new Date().toISOString();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await this.updateRunningPipelineState(
        tx,
        pipelineId,
        nextState,
        stage.id
      );
      if (!updated) {
        return null;
      }

      await tx.pipelineStage.update({
        where: { id: stage.id },
        data: {
          status: PipelineStageStatus.Completed,
          ...(options?.retryCount !== undefined
            ? { retryCount: options.retryCount }
            : {})
        }
      });

      const event = await this.pipelineEventStore.appendInTransaction(tx, {
        kind: 'stage_completed',
        pipelineId,
        stageId: stage.id,
        stageType: stage.stageType as PipelineStageType,
        timestamp
      });

      return [event];
    });

    if (!result) {
      return false;
    }

    this.pipelineEventStore.publishAll(result);
    return true;
  }

  async failStage(
    pipelineId: string,
    stage: PipelineStageRow,
    reason: string,
    options?: {
      retryCount?: number;
      nextState?: PipelineRuntimeState;
    }
  ): Promise<boolean> {
    const timestamp = new Date().toISOString();

    const result = await this.prisma.$transaction(async (tx) => {
      const guarded = await this.markPipelineRunningStage(tx, pipelineId, stage.id);
      if (!guarded) {
        return null;
      }

      if (options?.nextState) {
        await tx.pipeline.update({
          where: { id: pipelineId },
          data: {
            state: toInputJson(options.nextState as unknown as Prisma.InputJsonValue),
            currentStageId: stage.id
          }
        });
      }

      await tx.pipelineStage.update({
        where: { id: stage.id },
        data: {
          status: PipelineStageStatus.Failed,
          ...(options?.retryCount !== undefined
            ? { retryCount: options.retryCount }
            : {})
        }
      });

      const event = await this.pipelineEventStore.appendInTransaction(tx, {
        kind: 'stage_failed',
        pipelineId,
        stageId: stage.id,
        stageType: stage.stageType as PipelineStageType,
        timestamp,
        data: { reason }
      });

      return [event];
    });

    if (!result) {
      return false;
    }

    this.pipelineEventStore.publishAll(result);
    return true;
  }

  async pauseForHumanReview(
    pipelineId: string,
    runtimeState: PipelineRuntimeState
  ): Promise<boolean> {
    const stage = await this.findStage(pipelineId, PipelineStageType.HumanReview);
    const timestamp = new Date().toISOString();

    const events = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: pipelineId,
          status: PipelineStatus.Running
        },
        data: {
          status: PipelineStatus.Paused,
          currentStageId: stage.id,
          state: toInputJson(runtimeState as unknown as Prisma.InputJsonValue)
        }
      });
      if (updated.count !== 1) {
        return null;
      }

      await tx.pipelineStage.update({
        where: { id: stage.id },
        data: {
          status: PipelineStageStatus.AwaitingReview
        }
      });

      const started = await this.pipelineEventStore.appendInTransaction(tx, {
        kind: 'stage_started',
        pipelineId,
        stageId: stage.id,
        stageType: PipelineStageType.HumanReview,
        timestamp
      });
      const paused = await this.pipelineEventStore.appendInTransaction(tx, {
        kind: 'pipeline_paused',
        pipelineId,
        stageId: stage.id,
        stageType: PipelineStageType.HumanReview,
        timestamp
      });

      return [started, paused];
    });

    if (!events) {
      return false;
    }

    this.pipelineEventStore.publishAll(events);
    return true;
  }

  async completeExecution(pipelineId: string): Promise<boolean> {
    return (await this.transitionToTerminalState(pipelineId, {
      allowedFrom: [PipelineStatus.Running],
      targetStatus: PipelineStatus.Completed,
      activeStageStatus: PipelineStageStatus.Completed,
      eventKind: 'pipeline_completed'
    })) !== null;
  }

  async failExecution(pipelineId: string, reason: string): Promise<boolean> {
    return (await this.transitionToTerminalState(pipelineId, {
      allowedFrom: [PipelineStatus.Running],
      targetStatus: PipelineStatus.Failed,
      activeStageStatus: PipelineStageStatus.Failed,
      eventKind: 'pipeline_failed',
      data: { reason }
    })) !== null;
  }

  async cancelPipeline(pipelineId: string) {
    const updated = await this.transitionToTerminalState(pipelineId, {
      allowedFrom: [
        PipelineStatus.Pending,
        PipelineStatus.Running,
        PipelineStatus.Paused
      ],
      targetStatus: PipelineStatus.Cancelled,
      activeStageStatus: PipelineStageStatus.Cancelled,
      eventKind: 'pipeline_cancelled'
    });

    if (!updated) {
      const current = await this.prisma.pipeline.findUnique({
        where: { id: pipelineId }
      });

      throw new ConflictException(
        current
          ? `Pipeline state changed during cancel, current: ${current.status}`
          : `Pipeline not found: ${pipelineId}`
      );
    }

    return updated;
  }

  async resumeFromHumanReview(
    pipelineId: string,
    nextState: PipelineRuntimeState,
    humanReviewStageId: string | null,
    resetStageTypes: readonly PipelineStageType[]
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: pipelineId,
          status: PipelineStatus.Paused
        },
        data: {
          status: PipelineStatus.Pending,
          currentStageId: null,
          state: toInputJson(nextState as unknown as Prisma.InputJsonValue)
        }
      });

      if (updated.count !== 1) {
        const current = await tx.pipeline.findUnique({
          where: { id: pipelineId },
          select: { status: true }
        });
        throw new ConflictException(
          `Pipeline state changed during decision submission, current: ${
            current?.status ?? 'missing'
          }`
        );
      }

      if (humanReviewStageId) {
        await tx.pipelineStage.update({
          where: { id: humanReviewStageId },
          data: {
            status:
              nextState.currentStep === 'complete'
                ? PipelineStageStatus.Completed
                : PipelineStageStatus.Pending
          }
        });
      }

      if (resetStageTypes.length > 0) {
        await tx.pipelineStage.updateMany({
          where: {
            pipelineId,
            stageType: { in: [...resetStageTypes] }
          },
          data: {
            status: PipelineStageStatus.Pending
          }
        });
      }
    });
  }

  private async transitionToTerminalState(
    pipelineId: string,
    options: {
      allowedFrom: readonly PipelineStatus[];
      targetStatus: PipelineStatus.Completed | PipelineStatus.Failed | PipelineStatus.Cancelled;
      activeStageStatus:
        | PipelineStageStatus.Completed
        | PipelineStageStatus.Failed
        | PipelineStageStatus.Cancelled;
      eventKind: Extract<
        PipelineEventKind,
        'pipeline_completed' | 'pipeline_failed' | 'pipeline_cancelled'
      >;
      data?: Record<string, unknown>;
    }
  ): Promise<ReturnType<typeof toPipelineSummary> | null> {
    const timestamp = new Date().toISOString();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: pipelineId,
          status: {
            in: [...options.allowedFrom]
          }
        },
        data: {
          status: options.targetStatus,
          currentStageId: null
        }
      });

      if (updated.count !== 1) {
        return null;
      }

      await tx.pipelineStage.updateMany({
        where: {
          pipelineId,
          status: {
            in: [
              PipelineStageStatus.Running,
              PipelineStageStatus.AwaitingReview
            ]
          }
        },
        data: {
          status: options.activeStageStatus
        }
      });

      const pipeline = await tx.pipeline.findUniqueOrThrow({
        where: { id: pipelineId }
      });
      const event = await this.pipelineEventStore.appendInTransaction(tx, {
        kind: options.eventKind,
        pipelineId,
        timestamp,
        data: options.data
      });

      return {
        summary: toPipelineSummary(pipeline),
        event
      };
    });

    if (!result) {
      return null;
    }

    this.pipelineEventStore.publish(result.event);
    this.pipelineEventStore.complete(pipelineId);
    return result.summary;
  }

  private async findStage(
    pipelineId: string,
    stageType: PipelineStageType
  ): Promise<PipelineStageRow> {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId, stageType }
    });

    if (!stage) {
      throw new Error(`Pipeline stage not found: ${pipelineId}/${stageType}`);
    }

    return stage;
  }

  private async markPipelineRunningStage(
    tx: Prisma.TransactionClient,
    pipelineId: string,
    stageId: string
  ): Promise<boolean> {
    const updated = await tx.pipeline.updateMany({
      where: {
        id: pipelineId,
        status: PipelineStatus.Running
      },
      data: {
        currentStageId: stageId
      }
    });

    return updated.count === 1;
  }

  private async updateRunningPipelineState(
    tx: Prisma.TransactionClient,
    pipelineId: string,
    runtimeState: PipelineRuntimeState,
    currentStageId: string
  ): Promise<boolean> {
    const updated = await tx.pipeline.updateMany({
      where: {
        id: pipelineId,
        status: PipelineStatus.Running
      },
      data: {
        state: toInputJson(runtimeState as unknown as Prisma.InputJsonValue),
        currentStageId
      }
    });

    return updated.count === 1;
  }
}
