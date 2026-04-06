import { Injectable, NotFoundException } from '@nestjs/common';

import type { PipelineStatus } from '@agent-workbench/shared';

import {
  toPipelineArtifactSummary,
  toPipelineDetail,
  toPipelineStageSummary,
  toPipelineSummary
} from './pipeline-mapper';
import { PipelineRepository } from './pipeline.repository';

@Injectable()
export class PipelineQueryService {
  constructor(private readonly pipelineRepository: PipelineRepository) {}

  async list(scopeId?: string, status?: PipelineStatus) {
    const pipelines = await this.pipelineRepository.listPipelines(scopeId, status);
    return pipelines.map(toPipelineSummary);
  }

  async getById(id: string) {
    const pipeline = await this.pipelineRepository.getPipelineDetail(id);
    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    return toPipelineDetail(pipeline);
  }

  async getStagesByPipelineId(pipelineId: string) {
    const pipeline = await this.pipelineRepository.findPipelineById(pipelineId);
    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${pipelineId}`);
    }

    const stages = await this.pipelineRepository.getPipelineStages(pipelineId);
    return stages.map(toPipelineStageSummary);
  }

  async getArtifactsByPipelineId(pipelineId: string) {
    const pipeline = await this.pipelineRepository.findPipelineById(pipelineId);
    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${pipelineId}`);
    }

    const artifacts =
      await this.pipelineRepository.getReadyArtifactsByPipelineId(pipelineId);
    return artifacts.map(toPipelineArtifactSummary);
  }
}
