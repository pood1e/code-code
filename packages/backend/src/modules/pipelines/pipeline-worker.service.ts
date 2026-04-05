import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  PipelineArtifactKey,
  PipelineStageType,
  PipelineStatus
} from '@agent-workbench/shared';

import { LeaseHeartbeatRunner } from './lease-heartbeat-runner.service';
import { PipelineArtifactVersionRepository } from './pipeline-artifact-version.repository';
import { PipelineRepository } from './pipeline.repository';
import type { ManagedArtifactIntent } from './pipeline-runtime.repository';
import { PipelineRuntimeCommandService } from './pipeline-runtime-command.service';
import { getStageTypeForStep } from './pipeline-stage.constants';
import {
  parsePipelineRuntimeState,
  type PipelineRuntimeState
} from './pipeline-runtime-state';
import { estimateAgent } from './plan-graph/agents/estimate.agent';
import { breakdownAgent } from './plan-graph/agents/breakdown.agent';
import { specAgent } from './plan-graph/agents/spec.agent';
import { evaluationNode } from './plan-graph/nodes/evaluation.node';

@Injectable()
export class PipelineWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private static readonly LEASE_MS = 30_000;
  private static readonly LEASE_RENEW_INTERVAL_MS = 10_000;

  private readonly logger = new Logger(PipelineWorkerService.name);
  private readonly ownerId = `pipeline-worker:${randomUUID()}`;
  private isRunning = false;

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly pipelineArtifactVersionRepository: PipelineArtifactVersionRepository,
    private readonly pipelineRuntimeCommandService: PipelineRuntimeCommandService,
    private readonly leaseHeartbeatRunner: LeaseHeartbeatRunner
  ) {}

  onApplicationBootstrap(): void {
    this.isRunning = true;
    void this.pollLoop();
  }

  onApplicationShutdown(): void {
    this.isRunning = false;
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      const pipeline = await this.pipelineRuntimeCommandService.claimNextPendingPipeline(
        {
          ownerId: this.ownerId,
          ...this.createLeaseWindow()
        }
      );
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

  private async processClaimedPipeline(
    claimedPipeline: { id: string }
  ): Promise<void> {
    const heartbeat = this.leaseHeartbeatRunner.start({
      intervalMs: PipelineWorkerService.LEASE_RENEW_INTERVAL_MS,
      renew: () =>
        this.pipelineRuntimeCommandService.renewPipelineExecutionLease({
          pipelineId: claimedPipeline.id,
          ownerId: this.ownerId,
          ...this.createLeaseWindow()
        })
    });

    try {
      while (this.isRunning && heartbeat.hasLease()) {
        const pipeline = await this.pipelineRepository.findPipelineById(
          claimedPipeline.id
        );
        if (!pipeline) {
          return;
        }

        if (
          pipeline.status === PipelineStatus.Cancelled ||
          pipeline.status === PipelineStatus.Completed ||
          pipeline.status === PipelineStatus.Failed ||
          pipeline.status === PipelineStatus.Paused
        ) {
          return;
        }

        if (!heartbeat.hasLease()) {
          return;
        }

        const runtimeState = parsePipelineRuntimeState(pipeline.state);
        if (runtimeState.currentStep === 'complete') {
          await this.pipelineRuntimeCommandService.completeExecution(
            pipeline.id,
            this.ownerId
          );
          return;
        }

        if (runtimeState.currentStep === 'human_review') {
          await this.pipelineRuntimeCommandService.pauseForHumanReview(
            pipeline.id,
            this.ownerId,
            runtimeState
          );
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

        const stage = await this.pipelineRuntimeCommandService.startStage(
          pipeline.id,
          this.ownerId,
          stageType
        );
        if (!stage) {
          return;
        }

        try {
          await waitForConfiguredTestDelay();
          if (!heartbeat.hasLease()) {
            return;
          }

          switch (runtimeState.currentStep) {
            case 'breakdown':
              await this.runBreakdownStep(
                pipeline.id,
                pipeline.featureRequest,
                runtimeState,
                stage
              );
              break;
            case 'evaluation':
              if (
                await this.runEvaluationStep(pipeline.id, runtimeState, stage)
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
          if (!heartbeat.hasLease() || (await this.isPipelineCancelled(pipeline.id))) {
            return;
          }

          await this.pipelineRuntimeCommandService.failStage({
            pipelineId: pipeline.id,
            ownerId: this.ownerId,
            stageId: stage.id,
            stageType: stage.stageType,
            reason: error instanceof Error ? error.message : String(error)
          });
          await this.failPipeline(
            pipeline.id,
            error instanceof Error ? error.message : String(error)
          );
          return;
        }
      }
    } finally {
      await heartbeat.stop();
    }
  }

  private async runBreakdownStep(
    pipelineId: string,
    featureRequest: string | null,
    runtimeState: PipelineRuntimeState,
    stage: { id: string; stageType: PipelineStageType }
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

    await this.pipelineRuntimeCommandService.completeStage({
      pipelineId,
      ownerId: this.ownerId,
      stageId: stage.id,
      stageType: stage.stageType,
      nextState,
      retryCount: nextState.retryCount,
      artifactIntents: nextState.prd
        ? [
            await this.createManagedArtifactIntent({
              pipelineId,
              stageId: stage.id,
              artifactKey: PipelineArtifactKey.Prd,
              attempt: nextState.attempt,
              name: 'prd.json',
              contentType: 'application/json',
              content: JSON.stringify(nextState.prd, null, 2)
            })
          ]
        : []
    });
  }

  private async runEvaluationStep(
    pipelineId: string,
    runtimeState: PipelineRuntimeState,
    stage: { id: string; stageType: PipelineStageType }
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

      const failed = await this.pipelineRuntimeCommandService.failStage({
        pipelineId,
        ownerId: this.ownerId,
        stageId: stage.id,
        stageType: stage.stageType,
        reason: update.breakdownFeedback.reason,
        retryCount: nextRetryCount,
        nextState: exceeded
          ? undefined
          : {
              ...runtimeState,
              breakdownFeedback: update.breakdownFeedback,
              retryCount: nextRetryCount,
              currentStep: 'breakdown'
            }
      });
      if (!failed) {
        return false;
      }

      if (exceeded) {
        await this.failPipeline(
          pipelineId,
          `Max retry count (${runtimeState.config.maxRetry}) exceeded`
        );
        return false;
      }

      return true;
    }

    const nextState: PipelineRuntimeState = {
      ...runtimeState,
      breakdownFeedback: null,
      currentStep: 'spec'
    };

    return this.pipelineRuntimeCommandService.completeStage({
      pipelineId,
      ownerId: this.ownerId,
      stageId: stage.id,
      stageType: stage.stageType,
      nextState,
      retryCount: nextState.retryCount
    });
  }

  private async runSpecStep(
    pipelineId: string,
    runtimeState: PipelineRuntimeState,
    stage: { id: string; stageType: PipelineStageType }
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

    await this.pipelineRuntimeCommandService.completeStage({
      pipelineId,
      ownerId: this.ownerId,
      stageId: stage.id,
      stageType: stage.stageType,
      nextState,
      artifactIntents:
        nextState.acSpec.length > 0
          ? [
              await this.createManagedArtifactIntent({
                pipelineId,
                stageId: stage.id,
                artifactKey: PipelineArtifactKey.AcSpec,
                attempt: nextState.attempt,
                name: 'ac-spec.json',
                contentType: 'application/json',
                content: JSON.stringify(nextState.acSpec, null, 2)
              })
            ]
          : []
    });
  }

  private async runEstimateStep(
    pipelineId: string,
    runtimeState: PipelineRuntimeState,
    stage: { id: string; stageType: PipelineStageType }
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

    const completed = await this.pipelineRuntimeCommandService.completeStage({
      pipelineId,
      ownerId: this.ownerId,
      stageId: stage.id,
      stageType: stage.stageType,
      nextState,
      artifactIntents: nextState.planReport
        ? [
            await this.createManagedArtifactIntent({
              pipelineId,
              stageId: stage.id,
              artifactKey: PipelineArtifactKey.PlanReport,
              attempt: nextState.attempt,
              name: 'plan-report.md',
              contentType: 'text/markdown',
              content: nextState.planReport
            })
          ]
        : []
    });
    if (!completed) {
      return;
    }

    if (await this.isPipelineCancelled(pipelineId)) {
      return;
    }

    await this.pipelineRuntimeCommandService.pauseForHumanReview(
      pipelineId,
      this.ownerId,
      nextState
    );
  }

  private async failPipeline(pipelineId: string, reason: string) {
    this.logger.warn(`Pipeline ${pipelineId} failed: ${reason}`);
    await this.pipelineRuntimeCommandService.failExecution(
      pipelineId,
      this.ownerId,
      reason
    );
  }

  private async isPipelineCancelled(pipelineId: string): Promise<boolean> {
    const pipeline = await this.pipelineRepository.findPipelineById(pipelineId);
    return pipeline?.status === PipelineStatus.Cancelled;
  }

  private createLeaseWindow() {
    const now = new Date();
    return {
      now,
      leaseExpiresAt: new Date(now.getTime() + PipelineWorkerService.LEASE_MS)
    };
  }

  private async createManagedArtifactIntent(input: {
    pipelineId: string;
    stageId: string;
    artifactKey: PipelineArtifactKey;
    attempt: number;
    name: string;
    contentType: string;
    content: string;
  }): Promise<ManagedArtifactIntent> {
    const version =
      await this.pipelineArtifactVersionRepository.reserveNextVersion(
        input.pipelineId,
        input.artifactKey
      );

    return {
      stageId: input.stageId,
      artifactKey: input.artifactKey,
      attempt: input.attempt,
      name: input.name,
      contentType: input.contentType,
      content: input.content,
      version
    };
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
