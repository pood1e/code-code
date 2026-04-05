import { ConflictException, Injectable } from '@nestjs/common';

import {
  type PipelineConfig,
  PipelineStageType,
  PipelineStatus
} from '@agent-workbench/shared';

import { PipelineEventBroker } from './pipeline-event-broker.service';
import { PipelineExecutionLeaseRepository } from './pipeline-execution-lease.repository';
import type {
  ManagedArtifactIntent
} from './pipeline-runtime.repository';
import { PipelineRuntimeRepository } from './pipeline-runtime.repository';
import type { PipelineRuntimeState } from './pipeline-runtime-state';

@Injectable()
export class PipelineRuntimeCommandService {
  constructor(
    private readonly pipelineRuntimeRepository: PipelineRuntimeRepository,
    private readonly pipelineExecutionLeaseRepository: PipelineExecutionLeaseRepository,
    private readonly pipelineEventBroker: PipelineEventBroker
  ) {}

  claimNextPendingPipeline(input: {
    ownerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }) {
    return this.pipelineExecutionLeaseRepository.claimPipelineExecution(input);
  }

  renewPipelineExecutionLease(input: {
    pipelineId: string;
    ownerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }) {
    return this.pipelineExecutionLeaseRepository.renewPipelineExecutionLease(input);
  }

  async recoverInterruptedPipelinesOnBoot(): Promise<number> {
    return this.pipelineRuntimeRepository.recoverInterruptedPipelines();
  }

  startDraftPipeline(input: {
    pipelineId: string;
    runnerId: string;
    config: PipelineConfig;
    runtimeState: PipelineRuntimeState;
    stageDefinitions: Array<{
      stageType: PipelineStageType;
      name: string;
      order: number;
      status: import('@agent-workbench/shared').PipelineStageStatus;
    }>;
  }) {
    return this.pipelineRuntimeRepository.startDraftPipeline(input).then((result) => {
      if (!result) {
        return null;
      }

      this.pipelineEventBroker.publishAll(result.events);
      return result.value;
    });
  }

  getDecisionContext(pipelineId: string) {
    return this.pipelineRuntimeRepository.getDecisionContext(pipelineId);
  }

  async startStage(
    pipelineId: string,
    ownerId: string,
    stageType: PipelineStageType
  ) {
    const result = await this.pipelineRuntimeRepository.startStage(
      pipelineId,
      ownerId,
      stageType
    );
    if (!result) {
      return null;
    }

    this.pipelineEventBroker.publishAll(result.events);
    return result.value;
  }

  async completeStage(input: {
    pipelineId: string;
    ownerId: string;
    stageId: string;
    stageType: PipelineStageType;
    nextState: PipelineRuntimeState;
    retryCount?: number;
    artifactIntents?: ManagedArtifactIntent[];
  }): Promise<boolean> {
    const result = await this.pipelineRuntimeRepository.completeStage(input);
    if (!result) {
      return false;
    }

    this.pipelineEventBroker.publishAll(result.events);
    return result.value;
  }

  async failStage(input: {
    pipelineId: string;
    ownerId: string;
    stageId: string;
    stageType: PipelineStageType;
    reason: string;
    retryCount?: number;
    nextState?: PipelineRuntimeState;
  }): Promise<boolean> {
    const result = await this.pipelineRuntimeRepository.failStage(input);
    if (!result) {
      return false;
    }

    this.pipelineEventBroker.publishAll(result.events);
    return result.value;
  }

  async pauseForHumanReview(
    pipelineId: string,
    ownerId: string,
    runtimeState: PipelineRuntimeState
  ): Promise<boolean> {
    const result = await this.pipelineRuntimeRepository.pauseForHumanReview(
      pipelineId,
      ownerId,
      runtimeState
    );
    if (!result) {
      return false;
    }

    this.pipelineEventBroker.publishAll(result.events);
    return result.value;
  }

  async completeExecution(pipelineId: string, ownerId: string): Promise<boolean> {
    const result = await this.pipelineRuntimeRepository.completeExecution(
      pipelineId,
      ownerId
    );
    if (!result) {
      return false;
    }

    this.publishAndCloseIfNeeded(pipelineId, result.events, result.shouldCloseStream);
    return true;
  }

  async failExecution(
    pipelineId: string,
    ownerId: string,
    reason: string
  ): Promise<boolean> {
    const result = await this.pipelineRuntimeRepository.failExecution(
      pipelineId,
      ownerId,
      reason
    );
    if (!result) {
      return false;
    }

    this.publishAndCloseIfNeeded(pipelineId, result.events, result.shouldCloseStream);
    return true;
  }

  async cancelPipeline(pipelineId: string) {
    const result = await this.pipelineRuntimeRepository.cancelPipeline(pipelineId);
    if (!result) {
      const current = await this.pipelineRuntimeRepository.getDecisionContext(
        pipelineId
      );

      throw new ConflictException(
        current
          ? `Pipeline state changed during cancel, current: ${current.pipeline.status}`
          : `Pipeline not found: ${pipelineId}`
      );
    }

    this.publishAndCloseIfNeeded(pipelineId, result.events, result.shouldCloseStream);
    return result.value;
  }

  async resumeFromHumanReview(
    pipelineId: string,
    nextState: PipelineRuntimeState,
    stageStatusOverrides: Array<{
      stageType: PipelineStageType;
      status: import('@agent-workbench/shared').PipelineStageStatus;
    }>
  ): Promise<void> {
    const result = await this.pipelineRuntimeRepository.resumeFromHumanReview({
      pipelineId,
      nextState,
      stageStatusOverrides
    });

    if (!result) {
      const current = await this.pipelineRuntimeRepository.getDecisionContext(
        pipelineId
      );
      throw new ConflictException(
        `Pipeline state changed during decision submission, current: ${
          current?.pipeline.status ?? 'missing'
        }`
      );
    }

    this.pipelineEventBroker.publishAll(result.events);
  }

  private publishAndCloseIfNeeded(
    pipelineId: string,
    events: readonly import('@agent-workbench/shared').PipelineEvent[],
    shouldCloseStream?: boolean
  ) {
    this.pipelineEventBroker.publishAll(events);
    if (shouldCloseStream) {
      this.pipelineEventBroker.complete(pipelineId);
    }
  }
}
