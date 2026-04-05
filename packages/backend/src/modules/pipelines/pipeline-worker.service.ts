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
            this.ownerId
          );
          return;
        }

        if (runtimeState.currentStageKey === 'human_review') {
          await this.pipelineRuntimeCommandService.pauseForHumanReview(
            pipeline.id,
            this.ownerId,
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
          stageType
        );
        if (!startedStage) {
          return;
        }

        const shouldContinue =
          runtimeState.currentStageKey === 'evaluation'
            ? await this.runEvaluationStage(pipeline, stage, runtimeState)
            : await this.runAgentStage(pipeline, stage, runtimeState);

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

    let attempt = await this.pipelineStageAttemptService.getLatestAttempt(stage.id);
    if (!attempt || isTerminalAttemptStatus(attempt.status)) {
      const prompt = this.pipelineStagePromptService.buildStagePrompt({
        stageType: stage.stageType,
        featureRequest: pipeline.featureRequest,
        runtimeState,
        attemptNo: (attempt?.attemptNo ?? 0) + 1,
        reviewerComment: runtimeState.feedback.humanReview?.reviewerComment ?? null
      });
      attempt = await this.pipelineStageAttemptService.createAttempt({
        stageId: stage.id,
        resolvedAgentConfig: agentConfig,
        inputSnapshot: prompt.inputSnapshot,
        ownerLeaseToken: this.ownerId,
        leaseExpiresAt: this.createLeaseWindow().leaseExpiresAt
      });
    }

    await this.pipelineStageAttemptService.markRunning({
      attemptId: attempt.id,
      ownerLeaseToken: this.ownerId,
      leaseExpiresAt: this.createLeaseWindow().leaseExpiresAt
    });

    const prompt = this.pipelineStagePromptService.buildStagePrompt({
      stageType: stage.stageType,
      featureRequest: pipeline.featureRequest,
      runtimeState,
      attemptNo: attempt.attemptNo,
      reviewerComment: runtimeState.feedback.humanReview?.reviewerComment ?? null
    });

    let sessionId = attempt.sessionId;
    let activeRequestMessageId = attempt.activeRequestMessageId;

    if (!sessionId) {
      const created = await this.pipelineSessionBridgeService.createSessionAndSendPrompt({
        pipeline,
        agentConfig,
        prompt: prompt.prompt
      });
      sessionId = created.sessionId;
      activeRequestMessageId = created.messageId;
      await this.pipelineStageAttemptService.attachSession({
        attemptId: attempt.id,
        sessionId,
        activeRequestMessageId
      });
    }

    const firstResult = await this.pipelineSessionBridgeService.waitForResult(
      sessionId,
      activeRequestMessageId
    );
    if (firstResult.status !== 'completed') {
      return this.handleAgentFailure({
        pipeline,
        stage,
        attemptId: attempt.id,
        runtimeState,
        reason:
          firstResult.status === 'timeout'
            ? HumanReviewReason.AgentTimeout
            : HumanReviewReason.AgentRuntimeError,
        errorCode:
          firstResult.status === 'timeout' ? 'AGENT_TIMEOUT' : firstResult.code,
        errorMessage:
          firstResult.status === 'timeout'
            ? `Stage ${stage.stageType} timed out`
            : firstResult.message,
        candidateOutput: firstResult.status === 'error' ? firstResult.outputText : null
      });
    }

    try {
      const parsedOutput = this.structuredOutputParser.parse(
        stage.stageType,
        firstResult.outputText
      );
      await this.pipelineStageAttemptService.markSucceeded({
        attemptId: attempt.id,
        activeRequestMessageId: firstResult.messageId,
        candidateOutput: firstResult.outputText,
        parsedOutput
      });
      return this.completeAgentStage({
        pipeline,
        stage,
        attemptNo: attempt.attemptNo,
        runtimeState,
        parsedOutput
      });
    } catch (error) {
      const repairPrompt = this.pipelineStagePromptService.buildRepairPrompt(
        stage.stageType,
        error instanceof Error ? error.message : String(error)
      );
      const repairMessageId =
        await this.pipelineSessionBridgeService.sendFollowUpPrompt({
          sessionId,
          prompt: repairPrompt,
          agentConfig
        });

      await this.pipelineStageAttemptService.markWaitingRepair({
        attemptId: attempt.id,
        activeRequestMessageId: repairMessageId,
        failureCode: 'PARSE_FAILED',
        failureMessage: error instanceof Error ? error.message : String(error),
        candidateOutput: firstResult.outputText
      });

      const repairedResult = await this.pipelineSessionBridgeService.waitForResult(
        sessionId,
        repairMessageId
      );
      if (repairedResult.status !== 'completed') {
        return this.handleAgentFailure({
          pipeline,
          stage,
          attemptId: attempt.id,
          runtimeState,
          reason:
            repairedResult.status === 'timeout'
              ? HumanReviewReason.AgentTimeout
              : HumanReviewReason.AgentRuntimeError,
          errorCode:
            repairedResult.status === 'timeout'
              ? 'AGENT_TIMEOUT'
              : repairedResult.code,
          errorMessage:
            repairedResult.status === 'timeout'
              ? `Stage ${stage.stageType} timed out after repair request`
              : repairedResult.message,
          candidateOutput:
            repairedResult.status === 'error' ? repairedResult.outputText : null
        });
      }

      try {
        const parsedOutput = this.structuredOutputParser.parse(
          stage.stageType,
          repairedResult.outputText
        );
        await this.pipelineStageAttemptService.markSucceeded({
          attemptId: attempt.id,
          activeRequestMessageId: repairedResult.messageId,
          candidateOutput: repairedResult.outputText,
          parsedOutput
        });
        return this.completeAgentStage({
          pipeline,
          stage,
          attemptNo: attempt.attemptNo,
          runtimeState,
          parsedOutput
        });
      } catch (repairError) {
        return this.handleAgentFailure({
          pipeline,
          stage,
          attemptId: attempt.id,
          runtimeState,
          reason: HumanReviewReason.ParseFailed,
          errorCode: 'PARSE_FAILED',
          errorMessage:
            repairError instanceof Error
              ? repairError.message
              : String(repairError),
          candidateOutput: repairedResult.outputText
        });
      }
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

      await this.pipelineRuntimeCommandService.completeStage({
        pipelineId: pipeline.id,
        ownerId: this.ownerId,
        stageId: stage.id,
        stageType: stage.stageType,
        nextState,
        retryCount: stage.retryCount
      });
      return true;
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
                runtimeState,
                reason: HumanReviewReason.EvaluationRejected,
                sourceStageKey: 'breakdown',
                sourceAttempt: stage.attempts[0] ?? null,
                summary: violation,
                candidateOutput: prd,
                stages: pipeline.stages,
                artifacts: pipeline.artifacts
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

    await this.pipelineRuntimeCommandService.failStage({
      pipelineId: pipeline.id,
      ownerId: this.ownerId,
      stageId: stage.id,
      stageType: stage.stageType,
      reason: violation,
      retryCount: stage.retryCount + 1,
      nextState
    });

    if (remaining > 0) {
      return true;
    }

    await this.pipelineRuntimeCommandService.pauseForHumanReview(
      pipeline.id,
      this.ownerId,
      nextState
    );
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

    await this.pipelineRuntimeCommandService.completeStage({
      pipelineId: input.pipeline.id,
      ownerId: this.ownerId,
      stageId: input.stage.id,
      stageType: input.stage.stageType,
      nextState,
      retryCount: input.stage.retryCount,
      artifactIntents
    });

    if (
      input.stage.stageType === PipelineStageType.Estimate &&
      nextState.currentStageKey === 'human_review'
    ) {
      const sourceAttempt =
        await this.pipelineStageAttemptService.getLatestAttempt(input.stage.id);
      const reviewState = this.humanReviewAssembler.build({
        runtimeState: nextState,
        reason: HumanReviewReason.ManualEscalation,
        sourceStageKey: 'estimate',
        sourceAttempt,
        summary: 'Estimate completed successfully and now requires manual review.',
        candidateOutput: input.parsedOutput,
        stages: input.pipeline.stages,
        artifacts: input.pipeline.artifacts
      });
      const pausedState: PipelineRuntimeState = {
        ...nextState,
        feedback: {
          ...nextState.feedback,
          humanReview: reviewState
        }
      };

      await this.pipelineRuntimeCommandService.pauseForHumanReview(
        input.pipeline.id,
        this.ownerId,
        pausedState
      );
      return false;
    }

    return true;
  }

  private async handleAgentFailure(input: {
    pipeline: PipelineDetailRecord;
    stage: PipelineStageRecord;
    attemptId: string;
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

    await this.pipelineStageAttemptService.markFailed({
      attemptId: input.attemptId,
      reviewReason: remainingBudget > 0 ? null : input.reason,
      failureCode: input.errorCode,
      failureMessage: input.errorMessage,
      candidateOutput: input.candidateOutput
    });

    if (remainingBudget > 0) {
      await this.pipelineRuntimeCommandService.failStage({
        pipelineId: input.pipeline.id,
        ownerId: this.ownerId,
        stageId: input.stage.id,
        stageType: input.stage.stageType,
        reason: input.errorMessage,
        retryCount: input.stage.retryCount + 1,
        nextState
      });
      return true;
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
          runtimeState: input.runtimeState,
          reason: input.reason,
          sourceStageKey: input.sourceStageKey,
          sourceAttempt: input.sourceAttempt,
          summary: input.summary,
          candidateOutput: input.candidateOutput,
          stages: input.pipeline.stages,
          artifacts: input.pipeline.artifacts
        })
      }
    };

    await this.pipelineRuntimeCommandService.failStage({
      pipelineId: input.pipeline.id,
      ownerId: this.ownerId,
      stageId: input.stage.id,
      stageType: input.stage.stageType,
      reason: input.summary,
      retryCount: input.stage.retryCount + 1,
      nextState
    });
    await this.pipelineRuntimeCommandService.pauseForHumanReview(
      input.pipeline.id,
      this.ownerId,
      nextState
    );
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
    await this.pipelineRuntimeCommandService.failExecution(
      pipelineId,
      this.ownerId,
      reason
    );
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
