import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  type PipelineEvent,
  PipelineStageStatus,
  PipelineStageType,
  PipelineStatus
} from '@agent-workbench/shared';

import { toInputJson, toOptionalInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { PIPELINE_ARTIFACT_STATUS } from './pipeline-artifact.constants';
import type {
  ClaimedPipelineRecord,
  ManagedArtifactIntent,
  PipelineDecisionContext,
  PipelineRuntimeMutationResult
} from './pipeline-runtime.repository';
import { PipelineRuntimeRepository } from './pipeline-runtime.repository';
import type { PipelineRuntimeState } from './pipeline-runtime-state';
import { toPipelineRecord, toPipelineStageRecord } from './prisma-pipeline.repository';

type PipelineRow = Prisma.PipelineGetPayload<object>;
type PipelineStageRow = Prisma.PipelineStageGetPayload<{
  include: {
    attempts: true;
  };
}>;

@Injectable()
export class PrismaPipelineRuntimeRepository extends PipelineRuntimeRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async recoverInterruptedPipelines(): Promise<number> {
    return 0;
  }

  async startDraftPipeline(input: {
    pipelineId: string;
    runnerId: string;
    config: {
      maxRetry: number;
      requireHumanReviewOnSuccess: boolean;
    };
    runtimeState: PipelineRuntimeState;
    stageDefinitions: Array<{
      stageType: PipelineStageType;
      name: string;
      order: number;
      status: PipelineStageStatus;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const started = await tx.pipeline.updateMany({
        where: {
          id: input.pipelineId,
          status: PipelineStatus.Draft
        },
        data: {
          runnerId: input.runnerId,
          status: PipelineStatus.Pending,
          currentStageId: null,
          state: toInputJson(
            input.runtimeState as unknown as Prisma.InputJsonValue
          )
        }
      });

      if (started.count !== 1) {
        return null;
      }

      await tx.pipelineStage.createMany({
        data: input.stageDefinitions.map((stage) => ({
          pipelineId: input.pipelineId,
          name: stage.name,
          stageType: stage.stageType,
          order: stage.order,
          status: stage.status
        }))
      });

      const event = await this.appendEvent(tx, {
        kind: 'pipeline_started',
        pipelineId: input.pipelineId,
        timestamp: new Date().toISOString()
      });

      const pipeline = await tx.pipeline.findUniqueOrThrow({
        where: { id: input.pipelineId }
      });

      return {
        value: toPipelineRecord(pipeline),
        events: [event]
      };
    });
  }

  async getDecisionContext(id: string): Promise<PipelineDecisionContext | null> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: {
          include: {
            attempts: {
              orderBy: [{ attemptNo: 'desc' }, { createdAt: 'desc' }]
            }
          }
        }
      }
    });

    if (!pipeline) {
      return null;
    }

    return {
      pipeline: toPipelineRecord(pipeline),
      stages: pipeline.stages.map(toPipelineStageRecord)
    };
  }

  async startStage(
    pipelineId: string,
    ownerId: string,
    stageType: PipelineStageType
  ): Promise<PipelineRuntimeMutationResult<ReturnType<typeof toPipelineStageRecord>> | null> {
    const stage = await this.findStage(this.prisma, pipelineId, stageType);
    const timestamp = new Date().toISOString();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: pipelineId,
          status: PipelineStatus.Running,
          ...this.executionOwnerWhere(ownerId, now)
        },
        data: {
          currentStageId: stage.id
        }
      });

      if (updated.count !== 1) {
        return null;
      }

      const updatedStage = await tx.pipelineStage.update({
        where: { id: stage.id },
        data: {
          status: PipelineStageStatus.Running
        },
        include: {
          attempts: {
            orderBy: [{ attemptNo: 'desc' }, { createdAt: 'desc' }]
          }
        }
      });

      const event = await this.appendEvent(tx, {
        kind: 'stage_started',
        pipelineId,
        stageId: stage.id,
        stageType,
        timestamp
      });

      return {
        value: toPipelineStageRecord(updatedStage),
        events: [event]
      };
    });
  }

  async completeStage(input: {
    pipelineId: string;
    ownerId: string;
    stageId: string;
    stageType: PipelineStageType;
    nextState: PipelineRuntimeState;
    retryCount?: number;
    artifactIntents?: ManagedArtifactIntent[];
  }): Promise<PipelineRuntimeMutationResult<boolean> | null> {
    const timestamp = new Date().toISOString();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: input.pipelineId,
          status: PipelineStatus.Running,
          ...this.executionOwnerWhere(input.ownerId, now)
        },
        data: {
          state: toInputJson(input.nextState as unknown as Prisma.InputJsonValue),
          currentStageId: input.stageId
        }
      });

      if (updated.count !== 1) {
        return null;
      }

      await tx.pipelineStage.update({
        where: { id: input.stageId },
        data: {
          status: PipelineStageStatus.Completed,
          ...(input.retryCount !== undefined
            ? { retryCount: input.retryCount }
            : {})
        }
      });

      if (input.artifactIntents) {
        for (const artifactIntent of input.artifactIntents) {
          await tx.pipelineArtifact.create({
            data: {
              pipelineId: input.pipelineId,
              ...(artifactIntent.stageId ? { stageId: artifactIntent.stageId } : {}),
              artifactKey: artifactIntent.artifactKey,
              attempt: artifactIntent.attempt,
              version: artifactIntent.version,
              status: PIPELINE_ARTIFACT_STATUS.Ready,
              name: artifactIntent.name,
              contentType: artifactIntent.contentType,
              content: artifactIntent.content
            }
          });
        }
      }

      const event = await this.appendEvent(tx, {
        kind: 'stage_completed',
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        stageType: input.stageType,
        timestamp
      });

      return {
        value: true,
        events: [event]
      };
    });
  }

  async failStage(input: {
    pipelineId: string;
    ownerId: string;
    stageId: string;
    stageType: PipelineStageType;
    reason: string;
    retryCount?: number;
    nextState?: PipelineRuntimeState;
  }): Promise<PipelineRuntimeMutationResult<boolean> | null> {
    const timestamp = new Date().toISOString();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: input.pipelineId,
          status: PipelineStatus.Running,
          ...this.executionOwnerWhere(input.ownerId, now)
        },
        data: {
          ...(input.nextState
            ? {
                state: toInputJson(
                  input.nextState as unknown as Prisma.InputJsonValue
                )
              }
            : {}),
          currentStageId: input.stageId
        }
      });

      if (updated.count !== 1) {
        return null;
      }

      await tx.pipelineStage.update({
        where: { id: input.stageId },
        data: {
          status: PipelineStageStatus.Failed,
          ...(input.retryCount !== undefined
            ? { retryCount: input.retryCount }
            : {})
        }
      });

      const event = await this.appendEvent(tx, {
        kind: 'stage_failed',
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        stageType: input.stageType,
        timestamp,
        data: { reason: input.reason }
      });

      return {
        value: true,
        events: [event]
      };
    });
  }

  async pauseForHumanReview(
    pipelineId: string,
    ownerId: string,
    runtimeState: PipelineRuntimeState
  ): Promise<PipelineRuntimeMutationResult<boolean> | null> {
    const stage = await this.findStage(
      this.prisma,
      pipelineId,
      PipelineStageType.HumanReview
    );
    const timestamp = new Date().toISOString();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: pipelineId,
          status: PipelineStatus.Running,
          ...this.executionOwnerWhere(ownerId, now)
        },
        data: {
          status: PipelineStatus.Paused,
          currentStageId: stage.id,
          executionOwnerId: null,
          executionLeaseExpiresAt: null,
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

      const started = await this.appendEvent(tx, {
        kind: 'stage_started',
        pipelineId,
        stageId: stage.id,
        stageType: PipelineStageType.HumanReview,
        timestamp
      });
      const paused = await this.appendEvent(tx, {
        kind: 'pipeline_paused',
        pipelineId,
        stageId: stage.id,
        stageType: PipelineStageType.HumanReview,
        timestamp
      });

      return {
        value: true,
        events: [started, paused]
      };
    });
  }

  async completeExecution(
    pipelineId: string,
    ownerId: string
  ): Promise<PipelineRuntimeMutationResult<ReturnType<typeof toPipelineRecord>> | null> {
    return this.transitionToTerminalState(pipelineId, {
      allowedFrom: [PipelineStatus.Running],
      ownerId,
      targetStatus: PipelineStatus.Completed,
      activeStageStatus: PipelineStageStatus.Completed,
      eventKind: 'pipeline_completed'
    });
  }

  async failExecution(
    pipelineId: string,
    ownerId: string,
    reason: string
  ): Promise<PipelineRuntimeMutationResult<ReturnType<typeof toPipelineRecord>> | null> {
    return this.transitionToTerminalState(pipelineId, {
      allowedFrom: [PipelineStatus.Running],
      ownerId,
      targetStatus: PipelineStatus.Failed,
      activeStageStatus: PipelineStageStatus.Failed,
      eventKind: 'pipeline_failed',
      data: { reason }
    });
  }

  async cancelPipeline(
    pipelineId: string
  ): Promise<PipelineRuntimeMutationResult<ReturnType<typeof toPipelineRecord>> | null> {
    return this.transitionToTerminalState(pipelineId, {
      allowedFrom: [
        PipelineStatus.Pending,
        PipelineStatus.Running,
        PipelineStatus.Paused
      ],
      targetStatus: PipelineStatus.Cancelled,
      activeStageStatus: PipelineStageStatus.Cancelled,
      eventKind: 'pipeline_cancelled'
    });
  }

  async resumeFromHumanReview(input: {
    pipelineId: string;
    nextState: PipelineRuntimeState;
    stageStatusOverrides: Array<{
      stageType: PipelineStageType;
      status: PipelineStageStatus;
    }>;
  }): Promise<PipelineRuntimeMutationResult<boolean> | null> {
    const timestamp = new Date().toISOString();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: input.pipelineId,
          status: PipelineStatus.Paused
        },
        data: {
          status: PipelineStatus.Pending,
          currentStageId: null,
          executionOwnerId: null,
          executionLeaseExpiresAt: null,
          state: toInputJson(input.nextState as unknown as Prisma.InputJsonValue)
        }
      });

      if (updated.count !== 1) {
        return null;
      }

      for (const override of input.stageStatusOverrides) {
        await tx.pipelineStage.updateMany({
          where: {
            pipelineId: input.pipelineId,
            stageType: override.stageType
          },
          data: {
            status: override.status
          }
        });
      }

      const event = await this.appendEvent(tx, {
        kind: 'pipeline_resumed',
        pipelineId: input.pipelineId,
        timestamp
      });

      return {
        value: true,
        events: [event]
      };
    });
  }

  private async transitionToTerminalState(
    pipelineId: string,
    options: {
      allowedFrom: readonly PipelineStatus[];
      ownerId?: string;
      targetStatus: PipelineStatus.Completed | PipelineStatus.Failed | PipelineStatus.Cancelled;
      activeStageStatus:
        | PipelineStageStatus.Completed
        | PipelineStageStatus.Failed
        | PipelineStageStatus.Cancelled;
      eventKind: Extract<
        PipelineEvent['kind'],
        'pipeline_completed' | 'pipeline_failed' | 'pipeline_cancelled'
      >;
      data?: Record<string, unknown>;
    }
  ): Promise<PipelineRuntimeMutationResult<ReturnType<typeof toPipelineRecord>> | null> {
    const timestamp = new Date().toISOString();

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.pipeline.updateMany({
        where: {
          id: pipelineId,
          status: {
            in: [...options.allowedFrom]
          },
          ...(options.ownerId ? this.executionOwnerWhere(options.ownerId, now) : {})
        },
        data: {
          status: options.targetStatus,
          currentStageId: null,
          executionOwnerId: null,
          executionLeaseExpiresAt: null
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

      const event = await this.appendEvent(tx, {
        kind: options.eventKind,
        pipelineId,
        timestamp,
        data: options.data
      });

      return {
        value: toPipelineRecord(pipeline),
        events: [event],
        shouldCloseStream: true
      };
    });
  }

  private executionOwnerWhere(ownerId: string, now: Date) {
    return {
      executionOwnerId: ownerId,
      executionLeaseExpiresAt: { gte: now }
    } satisfies Prisma.PipelineWhereInput;
  }

  private async findStage(
    client: PrismaService | Prisma.TransactionClient,
    pipelineId: string,
    stageType: PipelineStageType
  ): Promise<PipelineStageRow> {
    const stage = await client.pipelineStage.findFirst({
      where: { pipelineId, stageType },
      include: {
        attempts: {
          orderBy: [{ attemptNo: 'desc' }, { createdAt: 'desc' }]
        }
      }
    });

    if (!stage) {
      throw new Error(`Pipeline stage not found: ${pipelineId}/${stageType}`);
    }

    return stage;
  }

  private async appendEvent(
    tx: Prisma.TransactionClient,
    event: Omit<PipelineEvent, 'eventId'>
  ): Promise<PipelineEvent> {
    const pipeline = await tx.pipeline.update({
      where: { id: event.pipelineId },
      data: {
        lastEventId: {
          increment: 1
        }
      },
      select: {
        lastEventId: true
      }
    });

    const persistedEvent: PipelineEvent = {
      ...event,
      eventId: pipeline.lastEventId
    };

    await tx.pipelineEvent.create({
      data: {
        pipelineId: persistedEvent.pipelineId,
        eventId: persistedEvent.eventId,
        kind: persistedEvent.kind,
        stageId: persistedEvent.stageId ?? null,
        stageType: persistedEvent.stageType ?? null,
        timestampMs: BigInt(new Date(persistedEvent.timestamp).getTime()),
        data: toOptionalInputJson(
          persistedEvent.data as Prisma.InputJsonValue | undefined
        )
      }
    });

    return persistedEvent;
  }
}
