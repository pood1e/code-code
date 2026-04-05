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

    const updated = await this.prisma.pipeline.update({
      where: { id },
      data: { status: PipelineStatus.Cancelled }
    });

    const eventId = await this.pipelineEventStore.nextEventId(id);
    await this.pipelineEventStore.append({
      kind: 'pipeline_cancelled',
      pipelineId: id,
      eventId,
      timestamp: new Date().toISOString()
    });
    this.pipelineEventStore.complete(id);

    return toPipelineSummary(updated);
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
      name: string;
      contentType: ArtifactContentType;
      content: string;
      metadata?: Record<string, unknown> | null;
    }
  ) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId }
    });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${pipelineId}`);
    }

    const storageRef = await this.artifactStorage.write(
      pipelineId,
      input.name,
      input.content,
      input.contentType
    );

    const artifact = await this.prisma.pipelineArtifact.create({
      data: {
        pipelineId,
        stageId: input.stageId ?? null,
        name: input.name,
        contentType: input.contentType,
        storageRef,
        metadata: toOptionalInputJson(
          input.metadata as Prisma.InputJsonValue | undefined
        )
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
          currentStep: 'spec',
          humanFeedback: decision.feedback ?? null
        };
      case HumanDecisionAction.Reject:
        return {
          ...runtimeState,
          currentStep: 'breakdown',
          humanFeedback: decision.feedback ?? null,
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
