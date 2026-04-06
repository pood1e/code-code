import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  HumanReviewReason,
  PipelineArtifactKey,
  PipelineStageType,
  PipelineStatus,
  StageExecutionAttemptStatus,
  type ArtifactRef,
  type PipelineRuntimeState,
  type PRD,
  type TaskACSpec,
  type ReviewableStageKey
} from '@agent-workbench/shared';

import { LeaseHeartbeatRunner } from './lease-heartbeat-runner.service';
import { PipelineAgentConfigResolverService } from './pipeline-agent-config-resolver.service';
import { PipelineArtifactVersionRepository } from './pipeline-artifact-version.repository';
import { HumanReviewAssemblerService } from './human-review-assembler.service';
import {
  PipelineRepository,
  type PipelineDetailRecord,
  type PipelineStageRecord
} from './pipeline.repository';
import type { ManagedArtifactIntent } from './pipeline-runtime.repository';
import { PipelineRuntimeCommandService } from './pipeline-runtime-command.service';
import { PipelineSessionBridgeService } from './pipeline-session-bridge.service';
import { PipelineStageAttemptService } from './pipeline-stage-attempt.service';
import { PipelineStagePromptService } from './pipeline-stage-prompt.service';
import { getStageTypeForStep } from './pipeline-stage.constants';
import { parsePipelineRuntimeState } from './pipeline-runtime-state';
import { StructuredOutputParser } from './structured-output.parser';

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
    private readonly leaseHeartbeatRunner: LeaseHeartbeatRunner,
    private readonly pipelineAgentConfigResolver: PipelineAgentConfigResolverService,
    private readonly pipelineStagePromptService: PipelineStagePromptService,
    private readonly pipelineSessionBridgeService: PipelineSessionBridgeService,
    private readonly pipelineStageAttemptService: PipelineStageAttemptService,
    private readonly structuredOutputParser: StructuredOutputParser,
    private readonly humanReviewAssembler: HumanReviewAssemblerService
  ) {}

  onApplicationBootstrap(): void {
    this.isRunning = true;
    void this.bootstrapAndPoll();
  }

  onApplicationShutdown(): void {
    this.isRunning = false;
  }

  private async bootstrapAndPoll(): Promise<void> {
    await this.pipelineRuntimeCommandService.recoverInterruptedPipelinesOnBoot();
    await this.pollLoop();
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
        await this.processClaimedPipeline(pipeline.id).catch((error) => {
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

  private async processClaimedPipeline(pipelineId: string): Promise<void> {
    const heartbeat = this.leaseHeartbeatRunner.start({
      intervalMs: PipelineWorkerService.LEASE_RENEW_INTERVAL_MS,
      renew: () =>
        this.pipelineRuntimeCommandService.renewPipelineExecutionLease({
          pipelineId,
          ownerId: this.ownerId,
          ...this.createLeaseWindow()
        })
    });

    try {
      while (this.isRunning && heartbeat.hasLease()) {
        const pipeline = await this.pipelineRepository.getPipelineDetail(pipelineId);
        if (!pipeline) {
          return;
        }

        if (isTerminalPipelineStatus(pipeline.status)) {
          return;
        }

        const runtimeState = parsePipelineRuntimeState(pipeline.state);
        if (runtimeState.currentStageKey === 'complete') {
          await this.pipelineRuntimeCommandService.completeExecution(
            pipeline.id,
            this.ownerId,
            pipeline.version
          );
          return;
        }

        if (runtimeState.currentStageKey === 'human_review') {
          await this.pipelineRuntimeCommandService.pauseForHumanReview(
            pipeline.id,
            this.ownerId,
            pipeline.version,
            runtimeState
          );
          return;
        }

        const stageType = getStageTypeForStep(runtimeState.currentStageKey);
        if (!stageType) {
          await this.failPipeline(
            pipeline.id,
            `Unsupported pipeline stage key: ${runtimeState.currentStageKey}`
          );
          return;
        }

        const stage = pipeline.stages.find((item) => item.stageType === stageType);
        if (!stage) {
          await this.failPipeline(
            pipeline.id,
            `Pipeline stage not found for ${stageType}`
          );
          return;
        }

        const startedStage = await this.pipelineRuntimeCommandService.startStage(
          pipeline.id,
          this.ownerId,
          pipeline.version,
          stageType
        );
        if (!startedStage) {
          return;
        }

        const activePipeline = await this.pipelineRepository.getPipelineDetail(pipeline.id);
        if (!activePipeline) {
          return;
        }

        const activeRuntimeState = parsePipelineRuntimeState(activePipeline.state);
        const activeStage = activePipeline.stages.find(
          (item) => item.stageType === stageType
        );
        if (!activeStage) {
          return;
        }

        const shouldContinue =
          activeRuntimeState.currentStageKey === 'evaluation'
            ? await this.runEvaluationStage(
                activePipeline,
                activeStage,
                activeRuntimeState
              )
            : await this.runAgentStage(
                activePipeline,
                activeStage,
                activeRuntimeState
              );

        if (!shouldContinue) {
          return;
        }
      }
    } finally {
      await heartbeat.stop();
    }
  }

  private async runAgentStage(
    pipeline: PipelineDetailRecord,
    stage: PipelineStageRecord,
    runtimeState: PipelineRuntimeState
  ): Promise<boolean> {
    const agentConfig = this.pipelineAgentConfigResolver.resolve({
      stageType: stage.stageType,
      stageState: null
    });

    const attempt = await this.claimOrCreateAttempt(
      pipeline,
      stage,
      runtimeState,
      agentConfig
    );
    if (!attempt) {
      return false;
    }

    const attemptHeartbeat = this.leaseHeartbeatRunner.start({
      intervalMs: PipelineWorkerService.LEASE_RENEW_INTERVAL_MS,
      renew: () =>
        this.pipelineStageAttemptService.renewLease({
          attemptId: attempt.id,
          ownerLeaseToken: this.ownerId,
          ...this.createLeaseWindow()
        })
    });

    try {
      if (attempt.status === StageExecutionAttemptStatus.Pending) {
        const markedRunning = await this.pipelineStageAttemptService.markRunning({
          attemptId: attempt.id,
          ownerLeaseToken: this.ownerId,
          leaseExpiresAt: this.createLeaseWindow().leaseExpiresAt
        });
        if (!markedRunning) {
          return false;
        }
      }

      let sessionId = attempt.sessionId;
      let activeRequestMessageId = attempt.activeRequestMessageId;

      if (!sessionId) {
        const prompt = this.pipelineStagePromptService.buildStagePrompt({
          stageType: stage.stageType,
          featureRequest: pipeline.featureRequest,
          runtimeState,
          attemptNo: attempt.attemptNo,
          reviewerComment: runtimeState.feedback.humanReview?.reviewerComment ?? null
        });
        const created =
          await this.pipelineSessionBridgeService.createSessionAndSendPrompt({
            pipeline,
            agentConfig,
            prompt: prompt.prompt
          });
        sessionId = created.sessionId;
        activeRequestMessageId = created.messageId;
        const attached = await this.pipelineStageAttemptService.attachSession({
          attemptId: attempt.id,
          ownerLeaseToken: this.ownerId,
          sessionId,
          activeRequestMessageId
        });
        if (!attached) {
          return false;
        }
      }

      if (!sessionId) {
        return false;
      }

      if (attempt.status === StageExecutionAttemptStatus.WaitingRepair) {
        return await this.resumeWaitingRepairAttempt({
          pipeline,
          stage,
          attempt,
          runtimeState,
          agentConfig,
          sessionId
        });
      }

      const firstResult = await this.pipelineSessionBridgeService.waitForResult(
        sessionId,
        activeRequestMessageId
      );
      if (!attemptHeartbeat.hasLease()) {
        return false;
      }

      return await this.handleCompletedAgentResponse({
        pipeline,
        stage,
        attempt,
        runtimeState,
        agentConfig,
        sessionId,
        result: firstResult,
        timeoutMessage: `Stage ${stage.stageType} timed out`
      });
    } finally {
      await attemptHeartbeat.stop();
      await this.pipelineStageAttemptService.releaseLease({
        attemptId: attempt.id,
        ownerLeaseToken: this.ownerId
      });
    }
  }

  private async runEvaluationStage(
    pipeline: PipelineDetailRecord,
    stage: PipelineStageRecord,
    runtimeState: PipelineRuntimeState
  ): Promise<boolean> {
    const prd = runtimeState.artifacts.prd;
    if (!prd || isArtifactRef(prd)) {
      return this.routeToHumanReview({
        pipeline,
        stage,
        runtimeState,
        sourceStageKey: 'breakdown',
        sourceAttempt: stage.attempts[0] ?? null,
        reason: HumanReviewReason.EvaluationRejected,
        summary: 'Evaluation requires an inline PRD output but none is available.',
        candidateOutput: prd
      });
    }

    const violation = evaluatePrd(prd);
    if (!violation) {
      const nextState: PipelineRuntimeState = {
        ...runtimeState,
        currentStageKey: 'spec',
        feedback: {
          ...runtimeState.feedback,
          humanReview: null
        },
        lastError: null
      };

      const completed = await this.pipelineRuntimeCommandService.completeStage({
        pipelineId: pipeline.id,
        ownerId: this.ownerId,
        expectedVersion: pipeline.version,
        stageId: stage.id,
        stageType: stage.stageType,
        nextState,
        retryCount: stage.retryCount
      });
      return completed;
    }

    const remaining = runtimeState.retryBudget.breakdown.remaining - 1;
    const nextState: PipelineRuntimeState = {
      ...runtimeState,
      currentStageKey: remaining > 0 ? 'breakdown' : 'human_review',
      retryBudget: {
        ...runtimeState.retryBudget,
        breakdown: {
          ...runtimeState.retryBudget.breakdown,
          remaining: Math.max(remaining, 0),
          evaluationRejectCount:
            runtimeState.retryBudget.breakdown.evaluationRejectCount + 1
        }
      },
      feedback: {
        breakdownRejectionHistory: [
          ...runtimeState.feedback.breakdownRejectionHistory,
          violation
        ],
        humanReview:
          remaining > 0
            ? null
            : this.humanReviewAssembler.build({
                reason: HumanReviewReason.EvaluationRejected,
                sourceStageKey: 'breakdown',
                sourceAttempt: stage.attempts[0] ?? null,
                summary: violation,
                candidateOutput: prd
              })
      },
      lastError: {
        stageKey: 'evaluation',
        attemptId: stage.attempts[0]?.id ?? null,
        code: 'EVALUATION_REJECTED',
        message: violation,
        at: new Date().toISOString()
      }
    };

    const failedStage = await this.pipelineRuntimeCommandService.failStage({
      pipelineId: pipeline.id,
      ownerId: this.ownerId,
      expectedVersion: pipeline.version,
      stageId: stage.id,
      stageType: stage.stageType,
      reason: violation,
      retryCount: stage.retryCount + 1,
      nextState
    });
    if (!failedStage) {
      return false;
    }

    if (remaining > 0) {
      return true;
    }

    const refreshedPipeline = await this.pipelineRepository.getPipelineDetail(
      pipeline.id
    );
    if (!refreshedPipeline) {
      return false;
    }

    if (
      !(await this.pipelineRuntimeCommandService.pauseForHumanReview(
        refreshedPipeline.id,
        this.ownerId,
        refreshedPipeline.version,
        nextState
      ))
    ) {
      return false;
    }
    return false;
  }

  private async completeAgentStage(input: {
    pipeline: PipelineDetailRecord;
    stage: PipelineStageRecord;
    attemptNo: number;
    runtimeState: PipelineRuntimeState;
    parsedOutput: unknown;
  }): Promise<boolean> {
    const nextState = buildNextRuntimeStateAfterSuccess(
      input.runtimeState,
      input.stage.stageType,
      input.parsedOutput
    );

    const artifactIntents = await this.createArtifactIntents({
      pipelineId: input.pipeline.id,
      stageId: input.stage.id,
      stageType: input.stage.stageType,
      parsedOutput: input.parsedOutput,
      attemptNo: input.attemptNo
    });

    const completed = await this.pipelineRuntimeCommandService.completeStage({
      pipelineId: input.pipeline.id,
      ownerId: this.ownerId,
      expectedVersion: input.pipeline.version,
      stageId: input.stage.id,
      stageType: input.stage.stageType,
      nextState,
      retryCount: input.stage.retryCount,
      artifactIntents
    });
    if (!completed) {
      return false;
    }

    if (
      input.stage.stageType === PipelineStageType.Estimate &&
      nextState.currentStageKey === 'human_review'
    ) {
      const sourceAttempt =
        await this.pipelineStageAttemptService.getLatestAttempt(input.stage.id);
      const reviewState = this.humanReviewAssembler.build({
        reason: HumanReviewReason.ManualEscalation,
        sourceStageKey: 'estimate',
        sourceAttempt,
        summary: 'Estimate completed successfully and now requires manual review.',
        candidateOutput: input.parsedOutput
      });
      const pausedState: PipelineRuntimeState = {
        ...nextState,
        feedback: {
          ...nextState.feedback,
          humanReview: reviewState
        }
      };

      const refreshedPipeline = await this.pipelineRepository.getPipelineDetail(
        input.pipeline.id
      );
      if (!refreshedPipeline) {
        return false;
      }

      if (
        !(await this.pipelineRuntimeCommandService.pauseForHumanReview(
          refreshedPipeline.id,
          this.ownerId,
          refreshedPipeline.version,
          pausedState
        ))
      ) {
        return false;
      }
      return false;
    }

    return true;
  }

  private async handleAgentFailure(input: {
    pipeline: PipelineDetailRecord;
    stage: PipelineStageRecord;
    attemptId: string;
    ownerLeaseToken: string;
    runtimeState: PipelineRuntimeState;
    reason: HumanReviewReason;
    errorCode: string;
    errorMessage: string;
    candidateOutput?: unknown;
  }): Promise<boolean> {
    const nextState = decrementBudgetForStage(
      input.runtimeState,
      input.stage.stageType,
      input.reason,
      input.attemptId,
      input.errorCode,
      input.errorMessage
    );
    const remainingBudget = getRemainingBudget(nextState, input.stage.stageType);

    const markedFailed = await this.pipelineStageAttemptService.markFailed({
      attemptId: input.attemptId,
      ownerLeaseToken: input.ownerLeaseToken,
      reviewReason: remainingBudget > 0 ? null : input.reason,
      failureCode: input.errorCode,
      failureMessage: input.errorMessage,
      candidateOutput: input.candidateOutput
    });
    if (!markedFailed) {
      return false;
    }

    if (remainingBudget > 0) {
      const failedStage = await this.pipelineRuntimeCommandService.failStage({
        pipelineId: input.pipeline.id,
        ownerId: this.ownerId,
        expectedVersion: input.pipeline.version,
        stageId: input.stage.id,
        stageType: input.stage.stageType,
        reason: input.errorMessage,
        retryCount: input.stage.retryCount + 1,
        nextState
      });
      return failedStage;
    }

    return this.routeToHumanReview({
      pipeline: input.pipeline,
      stage: input.stage,
      runtimeState: nextState,
      sourceStageKey: toReviewableStageKey(input.stage.stageType),
      sourceAttempt:
        await this.pipelineStageAttemptService.getLatestAttempt(input.stage.id),
      reason: input.reason,
      summary: input.errorMessage,
      candidateOutput: input.candidateOutput
    });
  }

  private async routeToHumanReview(input: {
    pipeline: PipelineDetailRecord;
    stage: PipelineStageRecord;
    runtimeState: PipelineRuntimeState;
    sourceStageKey: ReviewableStageKey | null;
    sourceAttempt: PipelineStageRecord['attempts'][number] | null;
    reason: HumanReviewReason;
    summary: string;
    candidateOutput?: unknown;
  }): Promise<boolean> {
    const nextState: PipelineRuntimeState = {
      ...input.runtimeState,
      currentStageKey: 'human_review',
      feedback: {
        ...input.runtimeState.feedback,
        humanReview: this.humanReviewAssembler.build({
          reason: input.reason,
          sourceStageKey: input.sourceStageKey,
          sourceAttempt: input.sourceAttempt,
          summary: input.summary,
          candidateOutput: input.candidateOutput
        })
      }
    };

    const failedStage = await this.pipelineRuntimeCommandService.failStage({
      pipelineId: input.pipeline.id,
      ownerId: this.ownerId,
      expectedVersion: input.pipeline.version,
      stageId: input.stage.id,
      stageType: input.stage.stageType,
      reason: input.summary,
      retryCount: input.stage.retryCount + 1,
      nextState
    });
    if (!failedStage) {
      return false;
    }
    const refreshedPipeline = await this.pipelineRepository.getPipelineDetail(
      input.pipeline.id
    );
    if (!refreshedPipeline) {
      return false;
    }

    if (
      !(await this.pipelineRuntimeCommandService.pauseForHumanReview(
        refreshedPipeline.id,
        this.ownerId,
        refreshedPipeline.version,
        nextState
      ))
    ) {
      return false;
    }
    return false;
  }

  private async createArtifactIntents(input: {
    pipelineId: string;
    stageId: string;
    stageType: PipelineStageType;
    parsedOutput: unknown;
    attemptNo: number;
  }): Promise<ManagedArtifactIntent[]> {
    switch (input.stageType) {
      case PipelineStageType.Breakdown:
        return [
          await this.createManagedArtifactIntent({
            pipelineId: input.pipelineId,
            stageId: input.stageId,
            artifactKey: PipelineArtifactKey.Prd,
            attempt: input.attemptNo,
            name: 'prd.json',
            contentType: 'application/json',
            content: JSON.stringify(input.parsedOutput, null, 2)
          })
        ];
      case PipelineStageType.Spec:
        return [
          await this.createManagedArtifactIntent({
            pipelineId: input.pipelineId,
            stageId: input.stageId,
            artifactKey: PipelineArtifactKey.AcSpec,
            attempt: input.attemptNo,
            name: 'ac-spec.json',
            contentType: 'application/json',
            content: JSON.stringify(input.parsedOutput, null, 2)
          })
        ];
      case PipelineStageType.Estimate:
        return [
          await this.createManagedArtifactIntent({
            pipelineId: input.pipelineId,
            stageId: input.stageId,
            artifactKey: PipelineArtifactKey.PlanReport,
            attempt: input.attemptNo,
            name: 'plan-report.json',
            contentType: 'application/json',
            content: JSON.stringify(input.parsedOutput, null, 2)
          })
        ];
      default:
        return [];
    }
  }

  private async failPipeline(pipelineId: string, reason: string) {
    this.logger.warn(`Pipeline ${pipelineId} failed: ${reason}`);
    const pipeline = await this.pipelineRepository.findPipelineById(pipelineId);
    if (!pipeline) {
      return;
    }
    await this.pipelineRuntimeCommandService.failExecution(
      pipelineId,
      this.ownerId,
      reason,
      pipeline.version
    );
  }

  private async claimOrCreateAttempt(
    pipeline: PipelineDetailRecord,
    stage: PipelineStageRecord,
    runtimeState: PipelineRuntimeState,
    agentConfig: ReturnType<PipelineAgentConfigResolverService['resolve']>
  ) {
    let attempt = await this.pipelineStageAttemptService.getLatestAttempt(stage.id);
    if (!attempt || isTerminalAttemptStatus(attempt.status)) {
      const prompt = this.pipelineStagePromptService.buildStagePrompt({
        stageType: stage.stageType,
        featureRequest: pipeline.featureRequest,
        runtimeState,
        attemptNo: (attempt?.attemptNo ?? 0) + 1,
        reviewerComment: runtimeState.feedback.humanReview?.reviewerComment ?? null
      });
      return this.pipelineStageAttemptService.createAttempt({
        stageId: stage.id,
        resolvedAgentConfig: agentConfig,
        inputSnapshot: prompt.inputSnapshot,
        ownerLeaseToken: this.ownerId,
        leaseExpiresAt: this.createLeaseWindow().leaseExpiresAt
      });
    }

    return this.pipelineStageAttemptService.claimAttempt({
      attemptId: attempt.id,
      ownerLeaseToken: this.ownerId,
      ...this.createLeaseWindow()
    });
  }

  private async handleCompletedAgentResponse(input: {
    pipeline: PipelineDetailRecord;
    stage: PipelineStageRecord;
    attempt: PipelineStageRecord['attempts'][number];
    runtimeState: PipelineRuntimeState;
    agentConfig: ReturnType<PipelineAgentConfigResolverService['resolve']>;
    sessionId: string;
    result: Awaited<ReturnType<PipelineSessionBridgeService['waitForResult']>>;
    timeoutMessage: string;
  }): Promise<boolean> {
    if (input.result.status !== 'completed') {
      return this.handleAgentFailure({
        pipeline: input.pipeline,
        stage: input.stage,
        attemptId: input.attempt.id,
        ownerLeaseToken: this.ownerId,
        runtimeState: input.runtimeState,
        reason:
          input.result.status === 'timeout'
            ? HumanReviewReason.AgentTimeout
            : HumanReviewReason.AgentRuntimeError,
        errorCode:
          input.result.status === 'timeout'
            ? 'AGENT_TIMEOUT'
            : input.result.code,
        errorMessage:
          input.result.status === 'timeout'
            ? input.timeoutMessage
            : input.result.message,
        candidateOutput:
          input.result.status === 'error' ? input.result.outputText : null
      });
    }

    try {
      const parsedOutput = this.structuredOutputParser.parse(
        input.stage.stageType,
        input.result.outputText
      );
      const markedSucceeded = await this.pipelineStageAttemptService.markSucceeded({
        attemptId: input.attempt.id,
        ownerLeaseToken: this.ownerId,
        activeRequestMessageId: input.result.messageId,
        candidateOutput: input.result.outputText,
        parsedOutput
      });
      if (!markedSucceeded) {
        return false;
      }

      return this.completeAgentStage({
        pipeline: input.pipeline,
        stage: input.stage,
        attemptNo: input.attempt.attemptNo,
        runtimeState: input.runtimeState,
        parsedOutput
      });
    } catch (error) {
      return this.sendRepairPromptAndHandle({
        pipeline: input.pipeline,
        stage: input.stage,
        attempt: input.attempt,
        runtimeState: input.runtimeState,
        agentConfig: input.agentConfig,
        sessionId: input.sessionId,
        parseError: error instanceof Error ? error.message : String(error),
        candidateOutput: input.result.outputText
      });
    }
  }

  private async sendRepairPromptAndHandle(input: {
    pipeline: PipelineDetailRecord;
    stage: PipelineStageRecord;
    attempt: PipelineStageRecord['attempts'][number];
    runtimeState: PipelineRuntimeState;
    agentConfig: ReturnType<PipelineAgentConfigResolverService['resolve']>;
    sessionId: string;
    parseError: string;
    candidateOutput: string;
  }): Promise<boolean> {
    const repairPrompt = this.pipelineStagePromptService.buildRepairPrompt(
      input.stage.stageType,
      input.parseError
    );
    const repairMessageId =
      await this.pipelineSessionBridgeService.sendFollowUpPrompt({
        sessionId: input.sessionId,
        prompt: repairPrompt,
        agentConfig: input.agentConfig
      });

    const markedWaitingRepair =
      await this.pipelineStageAttemptService.markWaitingRepair({
        attemptId: input.attempt.id,
        ownerLeaseToken: this.ownerId,
        activeRequestMessageId: repairMessageId,
        failureCode: 'PARSE_FAILED',
        failureMessage: input.parseError,
        candidateOutput: input.candidateOutput
      });
    if (!markedWaitingRepair) {
      return false;
    }

    return this.waitForRepairResult({
      pipeline: input.pipeline,
      stage: input.stage,
      attempt: input.attempt,
      runtimeState: input.runtimeState,
      sessionId: input.sessionId,
      repairMessageId,
      timeoutMessage: `Stage ${input.stage.stageType} timed out after repair request`
    });
  }

  private async resumeWaitingRepairAttempt(input: {
    pipeline: PipelineDetailRecord;
    stage: PipelineStageRecord;
    attempt: PipelineStageRecord['attempts'][number];
    runtimeState: PipelineRuntimeState;
    agentConfig: ReturnType<PipelineAgentConfigResolverService['resolve']>;
    sessionId: string;
  }): Promise<boolean> {
    let repairMessageId = input.attempt.activeRequestMessageId;
    if (repairMessageId) {
      const trackedMessage =
        await this.pipelineSessionBridgeService.getAssistantMessageSnapshot(
          input.sessionId,
          repairMessageId
        );
      if (!trackedMessage) {
        const latestMessage =
          await this.pipelineSessionBridgeService.getLatestAssistantMessageSnapshot(
            input.sessionId
          );
        if (latestMessage && latestMessage.id !== repairMessageId) {
          repairMessageId = latestMessage.id;
          const updated =
            await this.pipelineStageAttemptService.updateActiveRequestMessage({
              attemptId: input.attempt.id,
              ownerLeaseToken: this.ownerId,
              activeRequestMessageId: repairMessageId
            });
          if (!updated) {
            return false;
          }
        }
      }
    } else {
      const latestMessage =
        await this.pipelineSessionBridgeService.getLatestAssistantMessageSnapshot(
          input.sessionId
        );
      if (latestMessage) {
        repairMessageId = latestMessage.id;
        const updated =
          await this.pipelineStageAttemptService.updateActiveRequestMessage({
            attemptId: input.attempt.id,
            ownerLeaseToken: this.ownerId,
            activeRequestMessageId: repairMessageId
          });
        if (!updated) {
          return false;
        }
      }
    }

    if (!repairMessageId) {
      return this.sendRepairPromptAndHandle({
        pipeline: input.pipeline,
        stage: input.stage,
        attempt: input.attempt,
        runtimeState: input.runtimeState,
        agentConfig: input.agentConfig,
        sessionId: input.sessionId,
        parseError:
          input.attempt.failureMessage ?? 'Previous repair request is missing.',
        candidateOutput:
          typeof input.attempt.candidateOutput === 'string'
            ? input.attempt.candidateOutput
            : JSON.stringify(input.attempt.candidateOutput ?? null)
      });
    }

    return this.waitForRepairResult({
      pipeline: input.pipeline,
      stage: input.stage,
      attempt: input.attempt,
      runtimeState: input.runtimeState,
      sessionId: input.sessionId,
      repairMessageId,
      timeoutMessage: `Stage ${input.stage.stageType} timed out after repair request`
    });
  }

  private async waitForRepairResult(input: {
    pipeline: PipelineDetailRecord;
    stage: PipelineStageRecord;
    attempt: PipelineStageRecord['attempts'][number];
    runtimeState: PipelineRuntimeState;
    sessionId: string;
    repairMessageId: string | null;
    timeoutMessage: string;
  }): Promise<boolean> {
    const repairedResult = await this.pipelineSessionBridgeService.waitForResult(
      input.sessionId,
      input.repairMessageId
    );
    return this.handleCompletedAgentResponse({
      pipeline: input.pipeline,
      stage: input.stage,
      attempt: input.attempt,
      runtimeState: input.runtimeState,
      agentConfig: this.pipelineAgentConfigResolver.resolve({
        stageType: input.stage.stageType,
        stageState: null
      }),
      sessionId: input.sessionId,
      result: repairedResult,
      timeoutMessage: input.timeoutMessage
    });
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

function buildNextRuntimeStateAfterSuccess(
  runtimeState: PipelineRuntimeState,
  stageType: PipelineStageType,
  parsedOutput: unknown
): PipelineRuntimeState {
  switch (stageType) {
    case PipelineStageType.Breakdown:
      return {
        ...runtimeState,
        currentStageKey: 'evaluation',
        artifacts: {
          ...runtimeState.artifacts,
          prd: parsedOutput as PRD
        },
        feedback: {
          ...runtimeState.feedback,
          humanReview: null
        },
        lastError: null
      };
    case PipelineStageType.Spec:
      return {
        ...runtimeState,
        currentStageKey: 'estimate',
        artifacts: {
          ...runtimeState.artifacts,
          acSpec: parsedOutput as TaskACSpec[]
        },
        feedback: {
          ...runtimeState.feedback,
          humanReview: null
        },
        lastError: null
      };
    case PipelineStageType.Estimate:
      return {
        ...runtimeState,
        currentStageKey: runtimeState.config.requireHumanReviewOnSuccess
          ? 'human_review'
          : 'complete',
        artifacts: {
          ...runtimeState.artifacts,
          planReport: parsedOutput as PipelineRuntimeState['artifacts']['planReport']
        },
        feedback: {
          ...runtimeState.feedback,
          humanReview: null
        },
        lastError: null
      };
    default:
      return runtimeState;
  }
}

function decrementBudgetForStage(
  runtimeState: PipelineRuntimeState,
  stageType: PipelineStageType,
  reason: HumanReviewReason,
  attemptId: string,
  errorCode: string,
  errorMessage: string
): PipelineRuntimeState {
  const lastError = {
    stageKey: stageType,
    attemptId,
    code: errorCode,
    message: errorMessage,
    at: new Date().toISOString()
  };

  switch (stageType) {
    case PipelineStageType.Breakdown:
      return {
        ...runtimeState,
        currentStageKey:
          runtimeState.retryBudget.breakdown.remaining > 1
            ? 'breakdown'
            : 'human_review',
        retryBudget: {
          ...runtimeState.retryBudget,
          breakdown: {
            ...runtimeState.retryBudget.breakdown,
            remaining: Math.max(runtimeState.retryBudget.breakdown.remaining - 1, 0),
            agentFailureCount:
              reason === HumanReviewReason.EvaluationRejected
                ? runtimeState.retryBudget.breakdown.agentFailureCount
                : runtimeState.retryBudget.breakdown.agentFailureCount + 1
          }
        },
        lastError
      };
    case PipelineStageType.Spec:
      return {
        ...runtimeState,
        currentStageKey:
          runtimeState.retryBudget.spec.remaining > 1 ? 'spec' : 'human_review',
        retryBudget: {
          ...runtimeState.retryBudget,
          spec: {
            remaining: Math.max(runtimeState.retryBudget.spec.remaining - 1, 0)
          }
        },
        lastError
      };
    case PipelineStageType.Estimate:
      return {
        ...runtimeState,
        currentStageKey:
          runtimeState.retryBudget.estimate.remaining > 1
            ? 'estimate'
            : 'human_review',
        retryBudget: {
          ...runtimeState.retryBudget,
          estimate: {
            remaining: Math.max(
              runtimeState.retryBudget.estimate.remaining - 1,
              0
            )
          }
        },
        lastError
      };
    default:
      return {
        ...runtimeState,
        lastError
      };
  }
}

function getRemainingBudget(
  runtimeState: PipelineRuntimeState,
  stageType: PipelineStageType
) {
  switch (stageType) {
    case PipelineStageType.Breakdown:
      return runtimeState.retryBudget.breakdown.remaining;
    case PipelineStageType.Spec:
      return runtimeState.retryBudget.spec.remaining;
    case PipelineStageType.Estimate:
      return runtimeState.retryBudget.estimate.remaining;
    default:
      return 0;
  }
}

function evaluatePrd(prd: PRD): string | null {
  if (prd.tasks.length === 0) {
    return 'PRD must contain at least one task.';
  }

  const oversizedTask = prd.tasks.find((task) => task.estimatedAC > 6);
  if (oversizedTask) {
    return `Task ${oversizedTask.id} is still too coarse and should be split further.`;
  }

  return null;
}

function isArtifactRef(value: PRD | ArtifactRef): value is ArtifactRef {
  return 'filePath' in value;
}

function isTerminalPipelineStatus(status: PipelineStatus) {
  return (
    status === PipelineStatus.Completed ||
    status === PipelineStatus.Cancelled ||
    status === PipelineStatus.Failed ||
    status === PipelineStatus.Paused
  );
}

function isTerminalAttemptStatus(status: string) {
  return [
    'succeeded',
    'failed',
    'needs_human_review',
    'resolved_by_human',
    'cancelled'
  ].includes(status);
}

function toReviewableStageKey(
  stageType: PipelineStageType
): ReviewableStageKey | null {
  switch (stageType) {
    case PipelineStageType.Breakdown:
      return 'breakdown';
    case PipelineStageType.Spec:
      return 'spec';
    case PipelineStageType.Estimate:
      return 'estimate';
    default:
      return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
