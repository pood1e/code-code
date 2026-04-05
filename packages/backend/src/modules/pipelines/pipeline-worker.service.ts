import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import { Command } from '@langchain/langgraph';

import {
  DEFAULT_PIPELINE_CONFIG,
  HumanDecisionAction,
  PipelineStageStatus,
  PipelineStageType,
  PipelineStatus,
  type HumanDecision,
  type PipelineConfig
} from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { PipelineEventStore } from './pipeline-event.store';
import { buildPlanGraph, type PlanGraph } from './plan-graph/plan-graph.builder';
import { PipelinesService } from './pipelines.service';
import type { PlanStateType } from './plan-graph/plan-graph.state';

type PipelineRow = {
  id: string;
  featureRequest: string | null;
  state: unknown;
  resumePayload: string | null;
};

/** Stage type to display name mapping */
const STAGE_NAME_MAP: Record<PipelineStageType, string> = {
  [PipelineStageType.Breakdown]: 'Breakdown',
  [PipelineStageType.Evaluation]: 'Evaluation',
  [PipelineStageType.Spec]: 'Spec',
  [PipelineStageType.Estimate]: 'Estimate',
  [PipelineStageType.HumanReview]: 'Human Review',
  [PipelineStageType.TestDesign]: 'Test Design',
  [PipelineStageType.TestImpl]: 'Test Impl',
  [PipelineStageType.RedGate]: 'Red Gate',
  [PipelineStageType.Impl]: 'Impl',
  [PipelineStageType.GreenGate]: 'Green Gate',
  [PipelineStageType.Refactor]: 'Refactor',
  [PipelineStageType.QualityGate]: 'Quality Gate',
  [PipelineStageType.Review]: 'Review',
  [PipelineStageType.Release]: 'Release',
  [PipelineStageType.SmokeTestGate]: 'Smoke Test Gate'
};

const PLAN_STAGE_TYPES: PipelineStageType[] = [
  PipelineStageType.Breakdown,
  PipelineStageType.Evaluation,
  PipelineStageType.Spec,
  PipelineStageType.Estimate,
  PipelineStageType.HumanReview
];

/**
 * PipelineWorkerService — DB-backed background worker.
 * Runs in the same NestJS process, started via OnApplicationBootstrap lifecycle hook.
 * Polls for 'pending' pipelines, drives the LangGraph Plan Graph, handles interrupts and resumes.
 *
 * Architecture note: for multi-process scaling, extract this into a separate NestJS app
 * and replace the DB poll with PostgreSQL FOR UPDATE SKIP LOCKED.
 */
@Injectable()
export class PipelineWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PipelineWorkerService.name);
  private readonly planGraph: PlanGraph;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineEventStore: PipelineEventStore,
    private readonly pipelinesService: PipelinesService
  ) {
    this.planGraph = buildPlanGraph();
  }

  onApplicationBootstrap(): void {
    this.isRunning = true;
    void this.recoverInterruptedPipelinesOnBoot();
    void this.pollLoop();
  }

  onApplicationShutdown(): void {
    this.isRunning = false;
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      const pipeline = await this.claimPendingPipeline();
      if (pipeline) {
        await this.processGraph(pipeline).catch((error) => {
          this.logger.error(
            `Unhandled error processing pipeline ${pipeline.id}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        });
      } else {
        await sleep(1000);
      }
    }
  }

  /**
   * Atomically claim a pending pipeline by updating its status to 'running'.
   * Safe for single-process; for multi-process use SELECT ... FOR UPDATE SKIP LOCKED.
   */
  private async claimPendingPipeline(): Promise<PipelineRow | null> {
    const pending = await this.prisma.pipeline.findFirst({
      where: { status: PipelineStatus.Pending },
      orderBy: { updatedAt: 'asc' },
      select: { id: true, featureRequest: true, state: true, resumePayload: true }
    });

    if (!pending) return null;

    await this.prisma.pipeline.update({
      where: { id: pending.id },
      data: { status: PipelineStatus.Running }
    });

    return pending;
  }

  private async processGraph(pipeline: PipelineRow): Promise<void> {
    const { id: pipelineId, resumePayload, featureRequest, state } = pipeline;
    const config = this.getPipelineConfig(state);
    const graphConfig = { configurable: { thread_id: pipelineId } };

    const isResume = !!resumePayload;

    // Clear resumePayload before running to avoid re-resume on crash recovery
    if (isResume) {
      await this.prisma.pipeline.update({
        where: { id: pipelineId },
        data: { resumePayload: null }
      });
    }

    // For resume: Command<resume> instructs LangGraph to resume from the interrupt point
    // For fresh start: provide featureRequest as initial state
    const input = isResume
      ? new Command({ resume: JSON.parse(resumePayload!) as unknown })
      : { featureRequest: featureRequest ?? '' };

    try {
      // stream() returns an AsyncIterableReadableStream — iterate directly
      const stream = this.planGraph.stream(
        input as Parameters<PlanGraph['stream']>[0],
        { ...graphConfig, streamMode: 'updates' }
      );

      for await (const event of await stream) {
        const entries = Object.entries(event as Record<string, unknown>);
        if (entries.length === 0) continue;

        const [nodeName, nodeState] = entries[0] as [string, Partial<PlanStateType>];

        if (nodeName === '__interrupt__') {
          await this.handleInterrupt(pipelineId);
          return;
        }

        await this.syncAfterNode(pipelineId, nodeName, nodeState, config);
      }

      await this.completePipeline(pipelineId);
    } catch (error) {
      await this.failPipeline(
        pipelineId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }


  /**
   * Sync PipelineStage records and write artifacts after a node completes.
   */
  private async syncAfterNode(
    pipelineId: string,
    nodeName: string,
    nodeState: Partial<PlanStateType>,
    config: PipelineConfig
  ): Promise<void> {
    const stageType = this.nodeNameToStageType(nodeName);
    if (!stageType) return;

    // Find stage record for this stageType
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId, stageType }
    });

    if (!stage) return;

    if (stageType === PipelineStageType.Evaluation && nodeState.breakdownFeedback) {
      // Evaluation failed — increment retryCount, check maxRetry
      const currentRetryCount = (await this.prisma.pipelineStage.findFirst({
        where: { pipelineId, stageType: PipelineStageType.Breakdown },
        select: { retryCount: true }
      }))?.retryCount ?? 0;

      if (currentRetryCount >= config.maxRetry) {
        await this.failPipeline(pipelineId, `Max retry count (${config.maxRetry}) exceeded`);
        return;
      }

      await this.prisma.pipelineStage.update({
        where: { id: stage.id },
        data: {
          status: PipelineStageStatus.Failed,
          retryCount: { increment: 1 }
        }
      });
    } else {
      await this.prisma.pipelineStage.update({
        where: { id: stage.id },
        data: { status: PipelineStageStatus.Completed }
      });
    }

    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: { currentStageId: stage.id }
    });

    // Emit stage_completed event
    const eventId = this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'stage_completed',
      pipelineId,
      eventId,
      stageId: stage.id,
      stageType,
      timestamp: new Date().toISOString()
    });

    // Write artifacts for agent nodes
    await this.writeArtifacts(pipelineId, stage.id, stageType, nodeState);
  }

  private async writeArtifacts(
    pipelineId: string,
    stageId: string,
    stageType: PipelineStageType,
    nodeState: Partial<PlanStateType>
  ): Promise<void> {
    if (stageType === PipelineStageType.Breakdown && nodeState.prd) {
      await this.pipelinesService.createArtifact(pipelineId, {
        stageId,
        name: 'prd.json',
        contentType: 'application/json',
        content: JSON.stringify(nodeState.prd, null, 2)
      });
    }

    if (stageType === PipelineStageType.Spec && nodeState.acSpec) {
      await this.pipelinesService.createArtifact(pipelineId, {
        stageId,
        name: 'ac-spec.json',
        contentType: 'application/json',
        content: JSON.stringify(nodeState.acSpec, null, 2)
      });
    }

    if (stageType === PipelineStageType.Estimate && nodeState.planReport) {
      await this.pipelinesService.createArtifact(pipelineId, {
        stageId,
        name: 'plan-report.md',
        contentType: 'text/markdown',
        content: nodeState.planReport
      });
    }
  }

  private async handleInterrupt(pipelineId: string): Promise<void> {
    // Find and update humanReview stage to awaiting_review
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId, stageType: PipelineStageType.HumanReview }
    });

    if (stage) {
      await this.prisma.pipelineStage.update({
        where: { id: stage.id },
        data: { status: PipelineStageStatus.AwaitingReview }
      });
    }

    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        status: PipelineStatus.Paused,
        currentStageId: stage?.id ?? null
      }
    });

    const eventId = this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'pipeline_paused',
      pipelineId,
      eventId,
      stageId: stage?.id,
      stageType: PipelineStageType.HumanReview,
      timestamp: new Date().toISOString()
    });
  }

  private async completePipeline(pipelineId: string): Promise<void> {
    // Update humanReview stage to completed
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId, stageType: PipelineStageType.HumanReview }
    });

    if (stage) {
      await this.prisma.pipelineStage.update({
        where: { id: stage.id },
        data: { status: PipelineStageStatus.Completed }
      });
    }

    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: { status: PipelineStatus.Completed }
    });

    const eventId = this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'pipeline_completed',
      pipelineId,
      eventId,
      timestamp: new Date().toISOString()
    });

    this.pipelineEventStore.complete(pipelineId);
  }

  private async failPipeline(pipelineId: string, reason: string): Promise<void> {
    this.logger.warn(`Pipeline ${pipelineId} failed: ${reason}`);

    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: { status: PipelineStatus.Failed }
    });

    const eventId = this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'pipeline_failed',
      pipelineId,
      eventId,
      timestamp: new Date().toISOString(),
      data: { reason }
    });

    this.pipelineEventStore.complete(pipelineId);
  }

  /**
   * On boot, recover any pipelines stuck in 'running' state (process crashed mid-execution).
   * Reset them to 'pending' so the Worker picks them up again.
   * LangGraph MemorySaver will restart from scratch; for production use SqliteSaver.
   */
  private async recoverInterruptedPipelinesOnBoot(): Promise<void> {
    const count = await this.prisma.pipeline.updateMany({
      where: { status: PipelineStatus.Running },
      data: { status: PipelineStatus.Pending }
    });

    if (count.count > 0) {
      this.logger.warn(
        `Recovered ${count.count} interrupted pipeline(s) from 'running' → 'pending'`
      );
    }
  }

  /**
   * Called by PipelinesService.submitDecision() to enqueue a resume.
   * The pipeline status is set to 'pending' and resumePayload is stored.
   * The pollLoop will pick it up and call Command(resume=decision).
   */
  async enqueueResume(pipelineId: string, decision: HumanDecision): Promise<void> {
    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        status: PipelineStatus.Pending,
        resumePayload: JSON.stringify(decision)
      }
    });
  }

  private getPipelineConfig(state: unknown): PipelineConfig {
    const raw = state as Record<string, unknown> | null | undefined;
    return {
      maxRetry:
        typeof raw?.maxRetry === 'number'
          ? raw.maxRetry
          : DEFAULT_PIPELINE_CONFIG.maxRetry
    };
  }

  private nodeNameToStageType(nodeName: string): PipelineStageType | null {
    const map: Record<string, PipelineStageType> = {
      breakdown: PipelineStageType.Breakdown,
      evaluation: PipelineStageType.Evaluation,
      spec: PipelineStageType.Spec,
      estimate: PipelineStageType.Estimate,
      humanReview: PipelineStageType.HumanReview
    };
    return map[nodeName] ?? null;
  }

  /** Exposed for use by PipelinesService.start() to create PipelineStage records */
  static get planStageTypes(): PipelineStageType[] {
    return PLAN_STAGE_TYPES;
  }

  /** Exposed for use by PipelinesService.start() to get stage display names */
  static stageName(stageType: PipelineStageType): string {
    return STAGE_NAME_MAP[stageType] ?? stageType;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
