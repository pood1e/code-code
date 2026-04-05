import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import type { Prisma } from '@prisma/client';

import {
  DEFAULT_PIPELINE_CONFIG,
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
import {
  toPipelineArtifactSummary,
  toPipelineDetail,
  toPipelineSummary
} from './pipeline-mapper';

@Injectable()
export class PipelinesService {
  constructor(
    private readonly prisma: PrismaService,
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

    // Clean up artifacts from storage before deleting DB records
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

    const terminal = [
      PipelineStatus.Completed,
      PipelineStatus.Failed,
      PipelineStatus.Cancelled
    ] as string[];

    if (terminal.includes(existing.status)) {
      throw new BadRequestException(
        `Pipeline is already in terminal state: ${existing.status}`
      );
    }

    const updated = await this.prisma.pipeline.update({
      where: { id },
      data: { status: PipelineStatus.Cancelled }
    });

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

    if (pipeline.status !== PipelineStatus.Draft) {
      throw new ConflictException(
        `Pipeline can only be started from 'draft' status, current: ${pipeline.status}`
      );
    }

    const config: PipelineConfig = {
      maxRetry: input.config?.maxRetry ?? DEFAULT_PIPELINE_CONFIG.maxRetry
    };

    // Inline stage definitions — keeps PipelinesService free of circular Worker dependency
    const planStages: Array<{ stageType: PipelineStageType; name: string }> = [
      { stageType: PipelineStageType.Breakdown, name: 'Breakdown' },
      { stageType: PipelineStageType.Evaluation, name: 'Evaluation' },
      { stageType: PipelineStageType.Spec, name: 'Spec' },
      { stageType: PipelineStageType.Estimate, name: 'Estimate' },
      { stageType: PipelineStageType.HumanReview, name: 'Human Review' }
    ];

    await this.prisma.pipelineStage.createMany({
      data: planStages.map(({ stageType, name }, index) => ({
        pipelineId: id,
        name,
        stageType,
        order: index,
        status: PipelineStageStatus.Pending
      }))
    });

    const updated = await this.prisma.pipeline.update({
      where: { id },
      data: {
        status: PipelineStatus.Pending,
        state: toInputJson(config as unknown as Prisma.InputJsonValue)
      }
    });

    return toPipelineSummary(updated);
  }

  async submitDecision(id: string, decision: HumanDecision) {
    const pipeline = await this.prisma.pipeline.findUnique({ where: { id } });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    if (pipeline.status !== PipelineStatus.Paused) {
      throw new BadRequestException(
        `Pipeline must be in 'paused' status to submit a decision, current: ${pipeline.status}`
      );
    }

    // Write resumePayload and flip to Pending — Worker's pollLoop will pick it up
    await this.prisma.pipeline.update({
      where: { id },
      data: {
        status: PipelineStatus.Pending,
        resumePayload: JSON.stringify(decision)
      }
    });
  }
}
