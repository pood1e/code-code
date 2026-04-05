import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  DEFAULT_PIPELINE_CONFIG,
  HumanDecisionAction,
  PipelineArtifactKey,
  PipelineStageStatus,
  PipelineStageType,
  PipelineStatus,
  type ArtifactContentType,
  type CreatePipelineInput,
  type HumanDecision,
  type PipelineConfig,
  type StartPipelineInput,
  type UpdatePipelineInput
} from '@agent-workbench/shared';

import { toInputJson, toOptionalInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ARTIFACT_STORAGE,
  type ArtifactStorage
} from './artifact-storage/artifact-storage.interface';
import { toPipelineArtifactSummary, toPipelineDetail, toPipelineSummary } from './pipeline-mapper';
import { PipelineEventStore } from './pipeline-event.store';
import { createInitialPipelineRuntimeState, parsePipelineRuntimeState, type PipelineRuntimeState } from './pipeline-runtime-state';
import { PLAN_STAGE_DEFINITIONS } from './pipeline-stage.constants';

@Injectable()
export class PipelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineEventStore: PipelineEventStore,
    @Inject(ARTIFACT_STORAGE)
    private readonly artifactStorage: ArtifactStorage
  ) {}

  async create(input: CreatePipelineInput) {
    const projectExists = await this.prisma.project.findUnique({
      where: { id: input.scopeId },
      select: { id: true }
    });

    if (!projectExists) {
      throw new NotFoundException(`Project not found: ${input.scopeId}`);
    }

    const pipeline = await this.prisma.pipeline.create({
      data: {
        scopeId: input.scopeId,
        name: input.name,
        description: input.description ?? null,
        featureRequest: input.featureRequest ?? null,
        status: PipelineStatus.Draft
      }
    });

    return toPipelineSummary(pipeline);
  }

  async update(id: string, input: UpdatePipelineInput) {
    const existing = await this.prisma.pipeline.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    if (Object.keys(input).length === 0) {
      throw new BadRequestException(
        'At least one pipeline field must be provided'
      );
    }

    const updated = await this.prisma.pipeline.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.featureRequest !== undefined
          ? { featureRequest: input.featureRequest }
          : {})
      }
    });

    return toPipelineSummary(updated);
  }

  async delete(id: string) {
    const existing = await this.prisma.pipeline.findUnique({
      where: { id },
      include: { artifacts: true }
    });

    if (!existing) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    await Promise.allSettled(
      existing.artifacts.map((artifact) =>
        this.artifactStorage.delete(artifact.storageRef)
      )
    );

    await this.prisma.pipeline.delete({ where: { id } });
  }

  async cancel(id: string) {
    const existing = await this.prisma.pipeline.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    const terminal = new Set<string>([
      PipelineStatus.Completed,
      PipelineStatus.Failed,
      PipelineStatus.Cancelled
    ]);

    if (terminal.has(existing.status)) {
      throw new BadRequestException(
        `Pipeline is already in terminal state: ${existing.status}`
      );
    }

    return this.transitionPipelineToTerminalState(id, {
      status: PipelineStatus.Cancelled,
      activeStageStatus: PipelineStageStatus.Cancelled,
      eventKind: 'pipeline_cancelled'
    });
  }

  async getDetail(id: string) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      include: { stages: true, artifacts: true }
    });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    return toPipelineDetail(pipeline);
  }

  async createArtifact(
    pipelineId: string,
    input: {
      stageId?: string | null;
      artifactKey: PipelineArtifactKey;
      attempt: number;
      name: string;
      contentType: ArtifactContentType;
      content: string;
    }
  ) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId }
    });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${pipelineId}`);
    }

    const version = await this.getNextArtifactVersion(pipelineId, input.artifactKey);
    const metadata = {
      artifactKey: input.artifactKey,
      attempt: input.attempt,
      version
    };
    const storageRef = await this.artifactStorage.write(
      pipelineId,
      this.toArtifactStorageName(input.name, input.attempt, version),
      input.content,
      input.contentType
    );

    const artifact = await this.prisma.pipelineArtifact.create({
      data: {
        pipelineId,
        stageId: input.stageId ?? null,
        artifactKey: input.artifactKey,
        attempt: input.attempt,
        version,
        name: input.name,
        contentType: input.contentType,
        storageRef,
        metadata: toOptionalInputJson(metadata as Prisma.InputJsonValue)
      }
    });

    return toPipelineArtifactSummary(artifact);
  }

  async readArtifactContent(artifactId: string): Promise<Buffer> {
    const artifact = await this.prisma.pipelineArtifact.findUnique({
      where: { id: artifactId }
    });

    if (!artifact) {
      throw new NotFoundException(`Artifact not found: ${artifactId}`);
    }

    return this.artifactStorage.read(artifact.storageRef);
  }

  async start(id: string, input: StartPipelineInput) {
    const pipeline = await this.prisma.pipeline.findUnique({ where: { id } });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    const pipelineStatus = pipeline.status as PipelineStatus;
    if (pipelineStatus !== PipelineStatus.Draft) {
      throw new ConflictException(
        `Pipeline can only be started from 'draft' status, current: ${pipeline.status}`
      );
    }

    await this.assertRunnerExists(input.runnerId);

    const config: PipelineConfig = {
      maxRetry: input.config?.maxRetry ?? DEFAULT_PIPELINE_CONFIG.maxRetry
    };
    const runtimeState = createInitialPipelineRuntimeState(config);

    const [, updated] = await this.prisma.$transaction([
      this.prisma.pipelineStage.createMany({
        data: PLAN_STAGE_DEFINITIONS.map(({ stageType, name, order }) => ({
          pipelineId: id,
          name,
          stageType,
          order,
          status: PipelineStageStatus.Pending
        }))
      }),
      this.prisma.pipeline.update({
        where: { id },
        data: {
          runnerId: input.runnerId,
          status: PipelineStatus.Pending,
          currentStageId: null,
          state: this.toRuntimeStateJson(runtimeState)
        }
      })
    ]);

    return toPipelineSummary(updated);
  }

  async submitDecision(id: string, decision: HumanDecision) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      include: { stages: true }
    });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    const pipelineStatus = pipeline.status as PipelineStatus;
    if (pipelineStatus !== PipelineStatus.Paused) {
      throw new BadRequestException(
        `Pipeline must be in 'paused' status to submit a decision, current: ${pipeline.status}`
      );
    }

    const feedback = decision.feedback?.trim();
    if (
      (decision.action === HumanDecisionAction.Modify ||
        decision.action === HumanDecisionAction.Reject) &&
      !feedback
    ) {
      throw new BadRequestException(
        'Decision feedback is required for modify/reject actions'
      );
    }

    const runtimeState = parsePipelineRuntimeState(pipeline.state);
    if (runtimeState.currentStep !== 'human_review') {
      throw new ConflictException(
        `Pipeline is not awaiting a human review decision, current step: ${runtimeState.currentStep}`
      );
    }

    const nextState = this.applyDecisionToRuntimeState(runtimeState, {
      ...decision,
      feedback
    });
    const humanReviewStage = pipeline.stages.find(
      (stage) =>
        (stage.stageType as PipelineStageType) === PipelineStageType.HumanReview
    );

    await this.prisma.$transaction(async (tx) => {
      if (humanReviewStage) {
        await tx.pipelineStage.update({
          where: { id: humanReviewStage.id },
          data: {
            status:
              nextState.currentStep === 'complete'
                ? PipelineStageStatus.Completed
                : PipelineStageStatus.Pending
          }
        });
      }

      await this.resetStagesForNextStep(tx, id, nextState.currentStep);

      await tx.pipeline.update({
        where: { id },
        data: {
          status: PipelineStatus.Pending,
          currentStageId: null,
          state: this.toRuntimeStateJson(nextState)
        }
      });
    });
  }

  private applyDecisionToRuntimeState(
    runtimeState: PipelineRuntimeState,
    decision: HumanDecision
  ): PipelineRuntimeState {
    switch (decision.action) {
      case HumanDecisionAction.Approve:
        return {
          ...runtimeState,
          currentStep: 'complete',
          humanFeedback: decision.feedback ?? null
        };
      case HumanDecisionAction.Modify:
        return {
          ...runtimeState,
          attempt: runtimeState.attempt + 1,
          currentStep: 'spec',
          humanFeedback: decision.feedback ?? null,
          retryCount: 0
        };
      case HumanDecisionAction.Reject:
        return {
          ...runtimeState,
          attempt: runtimeState.attempt + 1,
          currentStep: 'breakdown',
          humanFeedback: decision.feedback ?? null,
          retryCount: 0,
          breakdownFeedback: {
            mode: 'full',
            reason: decision.feedback ?? 'Human review requested a full re-breakdown',
            suggestion: decision.feedback ?? undefined
          }
        };
      default: {
        const neverAction: never = decision.action;
        return neverAction;
      }
    }
  }

  private async resetStagesForNextStep(
    tx: Prisma.TransactionClient,
    pipelineId: string,
    nextStep: PipelineRuntimeState['currentStep']
  ) {
    const stageTypes = getResetStageTypes(nextStep);
    if (stageTypes.length === 0) {
      return;
    }

    await tx.pipelineStage.updateMany({
      where: {
        pipelineId,
        stageType: { in: stageTypes }
      },
      data: {
        status: PipelineStageStatus.Pending
      }
    });
  }

  private async assertRunnerExists(runnerId: string) {
    const runner = await this.prisma.agentRunner.findUnique({
      where: { id: runnerId },
      select: { id: true }
    });

    if (!runner) {
      throw new NotFoundException(`AgentRunner not found: ${runnerId}`);
    }
  }

  private toRuntimeStateJson(runtimeState: PipelineRuntimeState) {
    return toInputJson(runtimeState as unknown as Prisma.InputJsonValue);
  }

  async completeExecution(id: string) {
    await this.transitionPipelineToTerminalState(id, {
      status: PipelineStatus.Completed,
      activeStageStatus: PipelineStageStatus.Completed,
      eventKind: 'pipeline_completed'
    });
  }

  async failExecution(id: string, reason: string) {
    await this.transitionPipelineToTerminalState(id, {
      status: PipelineStatus.Failed,
      activeStageStatus: PipelineStageStatus.Failed,
      eventKind: 'pipeline_failed',
      data: { reason }
    });
  }

  private async transitionPipelineToTerminalState(
    pipelineId: string,
    options: {
      status: PipelineStatus.Completed | PipelineStatus.Failed | PipelineStatus.Cancelled;
      activeStageStatus:
        | PipelineStageStatus.Completed
        | PipelineStageStatus.Failed
        | PipelineStageStatus.Cancelled;
      eventKind: 'pipeline_completed' | 'pipeline_failed' | 'pipeline_cancelled';
      data?: Record<string, unknown>;
    }
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
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

      return tx.pipeline.update({
        where: { id: pipelineId },
        data: {
          status: options.status,
          currentStageId: null
        }
      });
    });

    const eventId = await this.pipelineEventStore.nextEventId(pipelineId);
    await this.pipelineEventStore.append({
      kind: options.eventKind,
      pipelineId,
      eventId,
      timestamp: new Date().toISOString(),
      data: options.data
    });
    this.pipelineEventStore.complete(pipelineId);

    return toPipelineSummary(updated);
  }

  private async getNextArtifactVersion(
    pipelineId: string,
    artifactKey: PipelineArtifactKey
  ) {
    const existing = await this.prisma.pipelineArtifact.findFirst({
      where: {
        pipelineId,
        artifactKey
      },
      orderBy: {
        version: 'desc'
      },
      select: {
        version: true
      }
    });

    return (existing?.version ?? 0) + 1;
  }

  private toArtifactStorageName(name: string, attempt: number, version: number) {
    return `attempt-${attempt}_v${version}_${name}`;
  }
}

function getResetStageTypes(nextStep: PipelineRuntimeState['currentStep']) {
  switch (nextStep) {
    case 'breakdown':
      return PLAN_STAGE_DEFINITIONS.map((stage) => stage.stageType);
    case 'spec':
      return [
        PipelineStageType.Spec,
        PipelineStageType.Estimate,
        PipelineStageType.HumanReview
      ];
    case 'complete':
    case 'evaluation':
    case 'estimate':
    case 'human_review':
      return [];
    default: {
      const neverStep: never = nextStep;
      return neverStep;
    }
  }
}
