import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

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
import { PipelineRuntimeCommandService } from './pipeline-runtime-command.service';
import { createInitialPipelineRuntimeState, parsePipelineRuntimeState, type PipelineRuntimeState } from './pipeline-runtime-state';
import { PLAN_STAGE_DEFINITIONS } from './pipeline-stage.constants';

@Injectable()
export class PipelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineRuntimeCommandService: PipelineRuntimeCommandService,
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

    return this.pipelineRuntimeCommandService.cancelPipeline(id);
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
        ...(input.stageId ? { stageId: input.stageId } : {}),
        name: input.name,
        contentType: input.contentType,
        storageRef,
        ...(input.metadata
          ? {
              metadata: toOptionalInputJson(
                input.metadata as Prisma.InputJsonValue | undefined
              )
            }
          : {})
      }
    });

    return toPipelineArtifactSummary(artifact);
  }

  async createManagedArtifact(
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

    const storageName = this.toManagedArtifactStorageName(
      input.name,
      input.artifactKey
    );
    const storageRef = await this.artifactStorage.write(
      pipelineId,
      storageName,
      input.content,
      input.contentType
    );

    try {
      const artifact = await this.prisma.$transaction(async (tx) => {
        const version = await this.reserveManagedArtifactVersion(
          tx,
          pipelineId,
          input.artifactKey
        );

        return tx.pipelineArtifact.create({
          data: {
            pipelineId,
            ...(input.stageId ? { stageId: input.stageId } : {}),
            artifactKey: input.artifactKey,
            attempt: input.attempt,
            version,
            name: input.name,
            contentType: input.contentType,
            storageRef
          }
        });
      });

      return toPipelineArtifactSummary(artifact);
    } catch (error) {
      await this.artifactStorage.delete(storageRef).catch(() => undefined);
      throw error;
    }
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

    await this.pipelineRuntimeCommandService.resumeFromHumanReview(
      id,
      nextState,
      humanReviewStage?.id ?? null,
      getResetStageTypes(nextState.currentStep)
    );
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

  private async reserveManagedArtifactVersion(
    tx: Prisma.TransactionClient,
    pipelineId: string,
    artifactKey: PipelineArtifactKey
  ) {
    const rows = await tx.$queryRaw<Array<{ version: number }>>`
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
      throw new ConflictException(
        `Failed to allocate artifact version for ${pipelineId}/${artifactKey}`
      );
    }

    return version;
  }

  private toManagedArtifactStorageName(
    name: string,
    artifactKey: PipelineArtifactKey
  ) {
    return `${artifactKey}_${randomUUID()}_${name}`;
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
