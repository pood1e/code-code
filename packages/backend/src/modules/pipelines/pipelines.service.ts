import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';

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

import {
  ARTIFACT_STORAGE,
  type ArtifactStorage
} from './artifact-storage/artifact-storage.interface';
import { ArtifactContentRepository } from './artifact-content.repository';
import {
  toPipelineArtifactSummary,
  toPipelineDetail,
  toPipelineSummary
} from './pipeline-mapper';
import { PipelineArtifactRepository } from './pipeline-artifact.repository';
import { PipelineRepository } from './pipeline.repository';
import { PipelineRuntimeCommandService } from './pipeline-runtime-command.service';
import {
  createInitialPipelineRuntimeState,
  parsePipelineRuntimeState,
  type PipelineRuntimeState
} from './pipeline-runtime-state';
import { PLAN_STAGE_DEFINITIONS } from './pipeline-stage.constants';

@Injectable()
export class PipelinesService {
  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly pipelineArtifactRepository: PipelineArtifactRepository,
    private readonly pipelineRuntimeCommandService: PipelineRuntimeCommandService,
    private readonly artifactContentRepository: ArtifactContentRepository,
    @Inject(ARTIFACT_STORAGE)
    private readonly artifactStorage: ArtifactStorage
  ) {}

  async create(input: CreatePipelineInput) {
    const projectExists = await this.pipelineRepository.projectExists(
      input.scopeId
    );
    if (!projectExists) {
      throw new NotFoundException(`Project not found: ${input.scopeId}`);
    }

    const pipeline = await this.pipelineRepository.createPipeline(input);
    return toPipelineSummary(pipeline);
  }

  async update(id: string, input: UpdatePipelineInput) {
    const existing = await this.pipelineRepository.findPipelineById(id);
    if (!existing) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    if (Object.keys(input).length === 0) {
      throw new BadRequestException(
        'At least one pipeline field must be provided'
      );
    }

    const updated = await this.pipelineRepository.updatePipeline(id, input);
    return toPipelineSummary(updated);
  }

  async delete(id: string) {
    const existing = await this.pipelineRepository.findPipelineById(id);
    if (!existing) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    const storageRefs =
      await this.pipelineArtifactRepository.listArtifactStorageRefsByPipelineId(
        id
      );
    await Promise.allSettled(
      storageRefs.map((storageRef) => this.artifactStorage.delete(storageRef))
    );

    await this.pipelineRepository.deletePipeline(id);
  }

  async cancel(id: string) {
    const existing = await this.pipelineRepository.findPipelineById(id);
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

    return this.pipelineRuntimeCommandService.cancelPipeline(id).then(
      toPipelineSummary
    );
  }

  async getDetail(id: string) {
    const pipeline = await this.pipelineRepository.getPipelineDetail(id);
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
    const pipeline = await this.pipelineRepository.findPipelineById(pipelineId);
    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${pipelineId}`);
    }

    const artifact = await this.pipelineArtifactRepository.createArtifactIntent({
      pipelineId,
      stageId: input.stageId,
      name: input.name,
      contentType: input.contentType,
      content: input.content,
      metadata: input.metadata
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
    const pipeline = await this.pipelineRepository.findPipelineById(pipelineId);
    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${pipelineId}`);
    }

    const artifact =
      await this.pipelineArtifactRepository.createManagedArtifactIntent({
        pipelineId,
        stageId: input.stageId,
        artifactKey: input.artifactKey,
        attempt: input.attempt,
        name: input.name,
        contentType: input.contentType,
        content: input.content
      });

    return toPipelineArtifactSummary(artifact);
  }

  async readArtifactContent(artifactId: string): Promise<Buffer> {
    const artifact = await this.pipelineArtifactRepository.findArtifactById(
      artifactId
    );
    if (!artifact) {
      throw new NotFoundException(`Artifact not found: ${artifactId}`);
    }

    return this.artifactContentRepository.readArtifactContent(artifact);
  }

  async getArtifactById(artifactId: string) {
    return this.pipelineArtifactRepository.findArtifactById(artifactId);
  }

  async start(id: string, input: StartPipelineInput) {
    const pipeline = await this.pipelineRepository.findPipelineById(id);
    if (!pipeline) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    if (pipeline.status !== PipelineStatus.Draft) {
      throw new ConflictException(
        `Pipeline can only be started from 'draft' status, current: ${pipeline.status}`
      );
    }

    const runnerExists = await this.pipelineRepository.runnerExists(
      input.runnerId
    );
    if (!runnerExists) {
      throw new NotFoundException(`AgentRunner not found: ${input.runnerId}`);
    }

    const config: PipelineConfig = {
      maxRetry: input.config?.maxRetry ?? DEFAULT_PIPELINE_CONFIG.maxRetry
    };
    const runtimeState = createInitialPipelineRuntimeState(config);

    const result = await this.pipelineRuntimeCommandService.startDraftPipeline({
      pipelineId: id,
      runnerId: input.runnerId,
      config,
      runtimeState,
      stageDefinitions: PLAN_STAGE_DEFINITIONS.map(({ stageType, name, order }) => ({
        stageType,
        name,
        order,
        status: PipelineStageStatus.Pending
      }))
    });

    if (!result) {
      throw new ConflictException(
        `Pipeline can only be started from 'draft' status, current: ${
          (await this.pipelineRepository.findPipelineById(id))?.status ?? 'missing'
        }`
      );
    }

    return toPipelineSummary(result);
  }

  async submitDecision(id: string, decision: HumanDecision) {
    const context = await this.pipelineRuntimeCommandService.getDecisionContext(id);
    if (!context) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    if (context.pipeline.status !== PipelineStatus.Paused) {
      throw new BadRequestException(
        `Pipeline must be in 'paused' status to submit a decision, current: ${context.pipeline.status}`
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

    const runtimeState = parsePipelineRuntimeState(context.pipeline.state);
    if (runtimeState.currentStep !== 'human_review') {
      throw new ConflictException(
        `Pipeline is not awaiting a human review decision, current step: ${runtimeState.currentStep}`
      );
    }

    const nextState = this.applyDecisionToRuntimeState(runtimeState, {
      ...decision,
      feedback
    });
    const humanReviewStage = context.stages.find(
      (stage) => stage.stageType === PipelineStageType.HumanReview
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
            reason:
              decision.feedback ?? 'Human review requested a full re-breakdown',
            suggestion: decision.feedback ?? undefined
          }
        };
      default: {
        const neverAction: never = decision.action;
        return neverAction;
      }
    }
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
