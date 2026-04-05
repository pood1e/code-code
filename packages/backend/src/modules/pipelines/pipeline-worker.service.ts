import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  PipelineStageStatus,
  PipelineStageType,
  PipelineStatus
} from '@agent-workbench/shared';

import { toInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelineEventStore } from './pipeline-event.store';
import { getStageTypeForStep } from './pipeline-stage.constants';
import {
  parsePipelineRuntimeState,
  type PipelineRuntimeState
} from './pipeline-runtime-state';
import { PipelinesService } from './pipelines.service';
import { estimateAgent } from './plan-graph/agents/estimate.agent';
import { breakdownAgent } from './plan-graph/agents/breakdown.agent';
import { specAgent } from './plan-graph/agents/spec.agent';
import { evaluationNode } from './plan-graph/nodes/evaluation.node';

type ClaimedPipelineRow = {
  id: string;
  featureRequest: string | null;
  state: unknown;
};

type PipelineStageRow = Prisma.PipelineStageGetPayload<object>;

@Injectable()
export class PipelineWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PipelineWorkerService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineEventStore: PipelineEventStore,
    private readonly pipelinesService: PipelinesService
  ) {}

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
        await this.processClaimedPipeline(pipeline).catch((error) => {
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

  private async claimPendingPipeline(): Promise<ClaimedPipelineRow | null> {
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
      data: { status: PipelineStatus.Running }
    });

    return claimed.count === 1 ? pending : null;
  }

  private async processClaimedPipeline(
    claimedPipeline: ClaimedPipelineRow
  ): Promise<void> {
    while (this.isRunning) {
      const pipeline = await this.prisma.pipeline.findUnique({
        where: { id: claimedPipeline.id },
        select: {
          id: true,
          featureRequest: true,
          state: true,
          status: true
        }
      });

      if (!pipeline) {
        return;
      }

      const pipelineStatus = pipeline.status as PipelineStatus;
      if (
        pipelineStatus === PipelineStatus.Cancelled ||
        pipelineStatus === PipelineStatus.Completed ||
        pipelineStatus === PipelineStatus.Failed ||
        pipelineStatus === PipelineStatus.Paused
      ) {
        return;
      }

      const runtimeState = parsePipelineRuntimeState(pipeline.state);
      if (runtimeState.currentStep === 'complete') {
        await this.completePipeline(pipeline.id);
        return;
      }

      if (runtimeState.currentStep === 'human_review') {
        await this.pauseForHumanReview(pipeline.id, runtimeState);
        return;
      }

      const stageType = getStageTypeForStep(runtimeState.currentStep);
      if (!stageType) {
        await this.failPipeline(
          pipeline.id,
          `Unsupported pipeline step: ${runtimeState.currentStep}`
        );
        return;
      }

      if (await this.isPipelineCancelled(pipeline.id)) {
        return;
      }

      const stage = await this.markStageStarted(pipeline.id, stageType);

      try {
        await waitForConfiguredTestDelay();

        switch (runtimeState.currentStep) {
          case 'breakdown':
            await this.runBreakdownStep(pipeline.id, pipeline.featureRequest, runtimeState, stage);
            break;
          case 'evaluation':
            if (
              await this.runEvaluationStep(
                pipeline.id,
                runtimeState,
                stage
              )
            ) {
              continue;
            }
            return;
          case 'spec':
            await this.runSpecStep(pipeline.id, runtimeState, stage);
            break;
          case 'estimate':
            await this.runEstimateStep(pipeline.id, runtimeState, stage);
            return;
        }
      } catch (error) {
        if (await this.isPipelineCancelled(pipeline.id)) {
          return;
        }

        await this.failStage(
          pipeline.id,
          stage,
          error instanceof Error ? error.message : String(error)
        );
        await this.failPipeline(
          pipeline.id,
          error instanceof Error ? error.message : String(error)
        );
        return;
      }
    }
  }

  private async runBreakdownStep(
    pipelineId: string,
    featureRequest: string | null,
    runtimeState: PipelineRuntimeState,
    stage: PipelineStageRow
  ) {
    const update = breakdownAgent({
      featureRequest: featureRequest ?? '',
      breakdownFeedback: runtimeState.breakdownFeedback,
      prd: runtimeState.prd,
      acSpec: runtimeState.acSpec,
      planReport: runtimeState.planReport
    });

    if (await this.isPipelineCancelled(pipelineId)) {
      return;
    }

    const nextState: PipelineRuntimeState = {
      ...runtimeState,
      ...update,
      currentStep: 'evaluation'
    };

    await this.completeStage(pipelineId, stage, nextState, {
      retryCount: nextState.retryCount
    });
    await this.writeArtifacts(
      pipelineId,
      stage.id,
      stage.stageType as PipelineStageType,
      nextState
    );
  }

  private async runEvaluationStep(
    pipelineId: string,
    runtimeState: PipelineRuntimeState,
    stage: PipelineStageRow
  ): Promise<boolean> {
    const update = evaluationNode({
      prd: runtimeState.prd,
      acSpec: runtimeState.acSpec,
      planReport: runtimeState.planReport,
      breakdownFeedback: runtimeState.breakdownFeedback,
      featureRequest: '',
      humanDecision: null,
      retryCount: runtimeState.retryCount,
      errors: []
    });

    if (await this.isPipelineCancelled(pipelineId)) {
      return false;
    }

    if (update.breakdownFeedback) {
      const nextRetryCount = runtimeState.retryCount + 1;
      const exceeded = nextRetryCount > runtimeState.config.maxRetry;

      await this.failStage(
        pipelineId,
        stage,
        update.breakdownFeedback.reason,
        nextRetryCount
      );

      if (exceeded) {
        await this.failPipeline(
          pipelineId,
          `Max retry count (${runtimeState.config.maxRetry}) exceeded`
        );
        return false;
      }

      await this.persistRuntimeState(pipelineId, {
        ...runtimeState,
        breakdownFeedback: update.breakdownFeedback,
        retryCount: nextRetryCount,
        currentStep: 'breakdown'
      });

      return true;
    }

    const nextState: PipelineRuntimeState = {
      ...runtimeState,
      breakdownFeedback: null,
      currentStep: 'spec'
    };

    await this.completeStage(pipelineId, stage, nextState, {
      retryCount: nextState.retryCount
    });
    return true;
  }

  private async runSpecStep(
    pipelineId: string,
    runtimeState: PipelineRuntimeState,
    stage: PipelineStageRow
  ) {
    const update = specAgent({
      prd: runtimeState.prd,
      humanFeedback: runtimeState.humanFeedback
    });

    if (await this.isPipelineCancelled(pipelineId)) {
      return;
    }

    const nextState: PipelineRuntimeState = {
      ...runtimeState,
      ...update,
      currentStep: 'estimate'
    };

    await this.completeStage(pipelineId, stage, nextState);
    await this.writeArtifacts(
      pipelineId,
      stage.id,
      stage.stageType as PipelineStageType,
      nextState
    );
  }

  private async runEstimateStep(
    pipelineId: string,
    runtimeState: PipelineRuntimeState,
    stage: PipelineStageRow
  ) {
    const update = estimateAgent({
      prd: runtimeState.prd,
      acSpec: runtimeState.acSpec
    });

    if (await this.isPipelineCancelled(pipelineId)) {
      return;
    }

    const nextState: PipelineRuntimeState = {
      ...runtimeState,
      ...update,
      currentStep: 'human_review'
    };

    await this.completeStage(pipelineId, stage, nextState);
    await this.writeArtifacts(
      pipelineId,
      stage.id,
      stage.stageType as PipelineStageType,
      nextState
    );

    if (await this.isPipelineCancelled(pipelineId)) {
      return;
    }

    await this.pauseForHumanReview(pipelineId, nextState);
  }

  private async markStageStarted(
    pipelineId: string,
    stageType: PipelineStageType
  ): Promise<PipelineStageRow> {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId, stageType }
    });

    if (!stage) {
      throw new Error(`Pipeline stage not found: ${pipelineId}/${stageType}`);
    }

    const updatedStage = await this.prisma.pipelineStage.update({
      where: { id: stage.id },
      data: {
        status: PipelineStageStatus.Running
      }
    });

    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: { currentStageId: stage.id }
    });

    const eventId = await this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'stage_started',
      pipelineId,
      eventId,
      stageId: stage.id,
      stageType,
      timestamp: new Date().toISOString()
    });

    return updatedStage;
  }

  private async completeStage(
    pipelineId: string,
    stage: PipelineStageRow,
    nextState: PipelineRuntimeState,
    options?: {
      retryCount?: number;
    }
  ) {
    await this.prisma.pipelineStage.update({
      where: { id: stage.id },
      data: {
        status: PipelineStageStatus.Completed,
        ...(options?.retryCount !== undefined
          ? { retryCount: options.retryCount }
          : {})
      }
    });

    await this.persistRuntimeState(pipelineId, nextState, stage.id);

    const eventId = await this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'stage_completed',
      pipelineId,
      eventId,
      stageId: stage.id,
      stageType: stage.stageType as PipelineStageType,
      timestamp: new Date().toISOString()
    });
  }

  private async failStage(
    pipelineId: string,
    stage: PipelineStageRow,
    reason: string,
    retryCount?: number
  ) {
    await this.prisma.pipelineStage.update({
      where: { id: stage.id },
      data: {
        status: PipelineStageStatus.Failed,
        ...(retryCount !== undefined ? { retryCount } : {})
      }
    });

    const eventId = await this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'stage_failed',
      pipelineId,
      eventId,
      stageId: stage.id,
      stageType: stage.stageType as PipelineStageType,
      timestamp: new Date().toISOString(),
      data: { reason }
    });
  }

  private async pauseForHumanReview(
    pipelineId: string,
    runtimeState: PipelineRuntimeState
  ) {
    const stage = await this.markStageStarted(
      pipelineId,
      PipelineStageType.HumanReview
    );

    await this.prisma.pipelineStage.update({
      where: { id: stage.id },
      data: {
        status: PipelineStageStatus.AwaitingReview
      }
    });

    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        status: PipelineStatus.Paused,
        currentStageId: stage.id,
        state: toInputJson(runtimeState as unknown as Prisma.InputJsonValue)
      }
    });

    const eventId = await this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'pipeline_paused',
      pipelineId,
      eventId,
      stageId: stage.id,
      stageType: PipelineStageType.HumanReview,
      timestamp: new Date().toISOString()
    });
  }

  private async completePipeline(pipelineId: string) {
    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        status: PipelineStatus.Completed
      }
    });

    const eventId = await this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'pipeline_completed',
      pipelineId,
      eventId,
      timestamp: new Date().toISOString()
    });

    this.pipelineEventStore.complete(pipelineId);
  }

  private async failPipeline(pipelineId: string, reason: string) {
    this.logger.warn(`Pipeline ${pipelineId} failed: ${reason}`);

    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        status: PipelineStatus.Failed
      }
    });

    const eventId = await this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: 'pipeline_failed',
      pipelineId,
      eventId,
      timestamp: new Date().toISOString(),
      data: { reason }
    });

    this.pipelineEventStore.complete(pipelineId);
  }

  private async persistRuntimeState(
    pipelineId: string,
    runtimeState: PipelineRuntimeState,
    currentStageId?: string | null
  ) {
    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        state: toInputJson(runtimeState as unknown as Prisma.InputJsonValue),
        ...(currentStageId !== undefined ? { currentStageId } : {})
      }
    });
  }

  private async writeArtifacts(
    pipelineId: string,
    stageId: string,
    stageType: PipelineStageType,
    runtimeState: PipelineRuntimeState
  ) {
    if (stageType === PipelineStageType.Breakdown && runtimeState.prd) {
      await this.pipelinesService.createArtifact(pipelineId, {
        stageId,
        name: 'prd.json',
        contentType: 'application/json',
        content: JSON.stringify(runtimeState.prd, null, 2)
      });
    }

    if (stageType === PipelineStageType.Spec && runtimeState.acSpec.length > 0) {
      await this.pipelinesService.createArtifact(pipelineId, {
        stageId,
        name: 'ac-spec.json',
        contentType: 'application/json',
        content: JSON.stringify(runtimeState.acSpec, null, 2)
      });
    }

    if (stageType === PipelineStageType.Estimate && runtimeState.planReport) {
      await this.pipelinesService.createArtifact(pipelineId, {
        stageId,
        name: 'plan-report.md',
        contentType: 'text/markdown',
        content: runtimeState.planReport
      });
    }
  }

  private async recoverInterruptedPipelinesOnBoot(): Promise<void> {
    const count = await this.prisma.pipeline.updateMany({
      where: { status: PipelineStatus.Running },
      data: { status: PipelineStatus.Pending }
    });

    if (count.count > 0) {
      this.logger.warn(
        `Recovered ${count.count} interrupted pipeline(s) from 'running' -> 'pending'`
      );
    }
  }

  private async isPipelineCancelled(pipelineId: string): Promise<boolean> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      select: { status: true }
    });

    return (
      (pipeline?.status as PipelineStatus | undefined) ===
      PipelineStatus.Cancelled
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForConfiguredTestDelay() {
  const rawValue = process.env.PIPELINE_STEP_DELAY_MS;
  if (!rawValue) {
    return;
  }

  const delayMs = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }

  await sleep(delayMs);
}
