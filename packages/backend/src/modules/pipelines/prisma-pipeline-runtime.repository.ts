import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  type PipelineEvent,
  PipelineStageStatus,
  PipelineStageType,
  PipelineStatus
} from '@agent-workbench/shared';

import {
  sanitizeJson,
  toInputJson,
  toOptionalInputJson
} from '../../common/json.utils';
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
import {
  toPipelineArtifactRecord,
  toPipelineRecord,
  toPipelineStageRecord
} from './prisma-pipeline.repository';

type PipelineRow = Prisma.PipelineGetPayload<object>;
type PipelineStageRow = Prisma.PipelineStageGetPayload<object>;
type PipelineEventRow = Prisma.PipelineEventGetPayload<object>;

@Injectable()
export class PrismaPipelineRuntimeRepository extends PipelineRuntimeRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async claimNextPendingPipeline(): Promise<ClaimedPipelineRecord | null> {
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

  async recoverInterruptedPipelines(): Promise<number> {
    const result = await this.prisma.pipeline.updateMany({
      where: { status: PipelineStatus.Running },
      data: { status: PipelineStatus.Pending }
    });

    return result.count;
  }

  async startDraftPipeline(input: {
    pipelineId: string;
    runnerId: string;
    config: { maxRetry: number };
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

      const pipeline = await tx.pipeline.findUniqueOrThrow({
        where: { id: input.pipelineId }
      });

      return toPipelineRecord(pipeline);
    });
  }

  async getDecisionContext(id: string): Promise<PipelineDecisionContext | null> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: true
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
    stageType: PipelineStageType
  ): Promise<PipelineRuntimeMutationResult<ReturnType<typeof toPipelineStageRecord>> | null> {
    const stage = await this.findStage(this.prisma, pipelineId, stageType);
    const timestamp = new Date().toISOString();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: pipelineId,
          status: PipelineStatus.Running
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
    stageId: string;
    stageType: PipelineStageType;
    nextState: PipelineRuntimeState;
    retryCount?: number;
    artifactIntents?: ManagedArtifactIntent[];
  }): Promise<PipelineRuntimeMutationResult<boolean> | null> {
    const timestamp = new Date().toISOString();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: input.pipelineId,
          status: PipelineStatus.Running
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
          const version = await this.reserveManagedArtifactVersion(
            tx,
            input.pipelineId,
            artifactIntent.artifactKey
          );

          await tx.pipelineArtifact.create({
            data: {
              pipelineId: input.pipelineId,
              ...(artifactIntent.stageId ? { stageId: artifactIntent.stageId } : {}),
              artifactKey: artifactIntent.artifactKey,
              attempt: artifactIntent.attempt,
              version,
              status: PIPELINE_ARTIFACT_STATUS.Pending,
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
    stageId: string;
    stageType: PipelineStageType;
    reason: string;
    retryCount?: number;
    nextState?: PipelineRuntimeState;
  }): Promise<PipelineRuntimeMutationResult<boolean> | null> {
    const timestamp = new Date().toISOString();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.updateMany({
        where: {
          id: input.pipelineId,
          status: PipelineStatus.Running
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
    runtimeState: PipelineRuntimeState
  ): Promise<PipelineRuntimeMutationResult<boolean> | null> {
    const stage = await this.findStage(
      this.prisma,
      pipelineId,
      PipelineStageType.HumanReview
    );
    const timestamp = new Date().toISOString();

    return this.prisma.$transaction(async (tx) => {
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
    pipelineId: string
  ): Promise<PipelineRuntimeMutationResult<ReturnType<typeof toPipelineRecord>> | null> {
    return this.transitionToTerminalState(pipelineId, {
      allowedFrom: [PipelineStatus.Running],
      targetStatus: PipelineStatus.Completed,
      activeStageStatus: PipelineStageStatus.Completed,
      eventKind: 'pipeline_completed'
    });
  }

  async failExecution(
    pipelineId: string,
    reason: string
  ): Promise<PipelineRuntimeMutationResult<ReturnType<typeof toPipelineRecord>> | null> {
    return this.transitionToTerminalState(pipelineId, {
      allowedFrom: [PipelineStatus.Running],
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
    humanReviewStageId: string | null;
    resetStageTypes: readonly PipelineStageType[];
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
          state: toInputJson(input.nextState as unknown as Prisma.InputJsonValue)
        }
      });

      if (updated.count !== 1) {
        return null;
      }

      if (input.humanReviewStageId) {
        await tx.pipelineStage.update({
          where: { id: input.humanReviewStageId },
          data: {
            status:
              input.nextState.currentStep === 'complete'
                ? PipelineStageStatus.Completed
                : PipelineStageStatus.Pending
          }
        });
      }

      if (input.resetStageTypes.length > 0) {
        await tx.pipelineStage.updateMany({
          where: {
            pipelineId: input.pipelineId,
            stageType: { in: [...input.resetStageTypes] }
          },
          data: {
            status: PipelineStageStatus.Pending
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

  async listEventsAfterEventId(
    pipelineId: string,
    afterEventId: number
  ): Promise<PipelineEvent[]> {
    const rows = await this.prisma.pipelineEvent.findMany({
      where: {
        pipelineId,
        eventId: {
          gt: afterEventId
        }
      },
      orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
    });

    return rows.map((row) => this.toEvent(row));
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
        PipelineEvent['kind'],
        'pipeline_completed' | 'pipeline_failed' | 'pipeline_cancelled'
      >;
      data?: Record<string, unknown>;
    }
  ): Promise<PipelineRuntimeMutationResult<ReturnType<typeof toPipelineRecord>> | null> {
    const timestamp = new Date().toISOString();

    return this.prisma.$transaction(async (tx) => {
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

  private async findStage(
    client: PrismaService | Prisma.TransactionClient,
    pipelineId: string,
    stageType: PipelineStageType
  ): Promise<PipelineStageRow> {
    const stage = await client.pipelineStage.findFirst({
      where: { pipelineId, stageType }
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

  private toEvent(row: PipelineEventRow): PipelineEvent {
    return {
      kind: row.kind as PipelineEvent['kind'],
      pipelineId: row.pipelineId,
      eventId: row.eventId,
      stageId: row.stageId ?? undefined,
      stageType: row.stageType
        ? (row.stageType as PipelineEvent['stageType'])
        : undefined,
      timestamp: new Date(Number(row.timestampMs)).toISOString(),
      data: row.data
        ? (sanitizeJson(row.data) as Record<string, unknown>)
        : undefined
    };
  }
}
