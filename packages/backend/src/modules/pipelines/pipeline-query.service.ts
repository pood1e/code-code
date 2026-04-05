import { Injectable, NotFoundException } from '@nestjs/common';

import type { PipelineStatus } from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import {
  toPipelineArtifactSummary,
  toPipelineDetail,
  toPipelineStageSummary,
  toPipelineSummary
} from './pipeline-mapper';

@Injectable()
export class PipelineQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scopeId?: string, status?: PipelineStatus) {
    const pipelines = await this.prisma.pipeline.findMany({
      where: {
        ...(scopeId ? { scopeId } : {}),
        ...(status ? { status } : {})
      },
      orderBy: { createdAt: 'desc' }
    });

    return pipelines.map(toPipelineSummary);
  }

  async getById(id: string) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: true,
        artifacts: true
      }
    });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    return toPipelineDetail(pipeline);
  }

  async getStagesByPipelineId(pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId }
    });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${pipelineId}`);
    }

    const stages = await this.prisma.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { order: 'asc' }
    });

    return stages.map(toPipelineStageSummary);
  }

  async getArtifactsByPipelineId(pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId }
    });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${pipelineId}`);
    }

    const artifacts = await this.prisma.pipelineArtifact.findMany({
      where: { pipelineId },
      orderBy: { createdAt: 'desc' }
    });

    return artifacts.map(toPipelineArtifactSummary);
  }
}
