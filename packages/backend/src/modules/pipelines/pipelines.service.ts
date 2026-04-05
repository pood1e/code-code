import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import {
  DEFAULT_PIPELINE_CONFIG,
  HumanReviewAction,
  PipelineArtifactKey,
  PipelineStageStatus,
  PipelineStageType,
  PipelineStatus,
  submitHumanDecisionInputSchema,
  type ArtifactContentType,
  type CreatePipelineInput,
  type PipelineConfig,
  type PipelineHumanReviewDecision,
  type StartPipelineInput,
  type UpdatePipelineInput
} from '@agent-workbench/shared';
import { ZodError } from 'zod';

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
import { PipelineStageAttemptService } from './pipeline-stage-attempt.service';
import {
  createInitialPipelineRuntimeState,
  parsePipelineRuntimeState,
  type PipelineRuntimeState
} from './pipeline-runtime-state';
import { PLAN_STAGE_DEFINITIONS } from './pipeline-stage.constants';
import { StructuredOutputParser } from './structured-output.parser';

@Injectable()
export class PipelinesService {
  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly pipelineArtifactRepository: PipelineArtifactRepository,
    private readonly pipelineRuntimeCommandService: PipelineRuntimeCommandService,
    private readonly artifactContentRepository: ArtifactContentRepository,
    private readonly pipelineStageAttemptService: PipelineStageAttemptService,
    private readonly structuredOutputParser: StructuredOutputParser,
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
      maxRetry: input.config?.maxRetry ?? DEFAULT_PIPELINE_CONFIG.maxRetry,
      requireHumanReviewOnSuccess:
        input.config?.requireHumanReviewOnSuccess ??
        DEFAULT_PIPELINE_CONFIG.requireHumanReviewOnSuccess
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

  async submitDecision(id: string, decision: PipelineHumanReviewDecision) {
    let parsedDecision: PipelineHumanReviewDecision;
    try {
      parsedDecision = submitHumanDecisionInputSchema.parse({
        decision
      }).decision;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(
          error.issues[0]?.message ?? 'Invalid human review decision'
        );
      }

      throw error;
    }
    const context = await this.pipelineRuntimeCommandService.getDecisionContext(id);
    if (!context) {
      throw new NotFoundException(`Pipeline not found: ${id}`);
    }

    if (context.pipeline.status !== PipelineStatus.Paused) {
      throw new BadRequestException(
        `Pipeline must be in 'paused' status to submit a decision, current: ${context.pipeline.status}`
      );
    }

    const runtimeState = parsePipelineRuntimeState(context.pipeline.state);
    if (runtimeState.currentStageKey !== 'human_review') {
      throw new ConflictException(
        `Pipeline is not awaiting a human review decision, current step: ${runtimeState.currentStageKey}`
      );
    }

    const humanReview = runtimeState.feedback.humanReview;
    if (!humanReview) {
      throw new ConflictException('Pipeline is paused without human review payload');
    }

    if (!humanReview.sourceStageKey) {
      throw new ConflictException('Human review payload is missing source stage');
    }

    if (parsedDecision.action === HumanReviewAction.Terminate) {
      await this.pipelineRuntimeCommandService.cancelPipeline(id);
      return;
    }

    if (parsedDecision.action === HumanReviewAction.EditAndContinue) {
      const sourceStageType = getStageTypeForReviewSource(humanReview.sourceStageKey);
      const editedOutput = this.structuredOutputParser.validateValue(
        sourceStageType,
        parsedDecision.editedOutput
      );

      if (humanReview.sourceAttemptId) {
        await this.pipelineStageAttemptService.markResolvedByHuman(
          humanReview.sourceAttemptId
        );
      }

      const nextState = applyEditAndContinueDecision(
        runtimeState,
        humanReview.sourceStageKey,
        editedOutput,
        parsedDecision.comment ?? null
      );

      await this.pipelineRuntimeCommandService.resumeFromHumanReview(
        id,
        nextState,
        getStageStatusOverridesForEditAndContinue(humanReview.sourceStageKey)
      );
      return;
    }

    if (parsedDecision.action === HumanReviewAction.Skip) {
      if (humanReview.sourceStageKey === 'breakdown') {
        throw new BadRequestException('Breakdown stage cannot be skipped');
      }

      const nextState = applySkipDecision(
        runtimeState,
        humanReview.sourceStageKey,
        parsedDecision.comment
      );

      await this.pipelineRuntimeCommandService.resumeFromHumanReview(
        id,
        nextState,
        getStageStatusOverridesForSkip(humanReview.sourceStageKey)
      );
      return;
    }

    const nextState = applyRetryDecision(
      runtimeState,
      humanReview.sourceStageKey,
      parsedDecision.comment ?? null
    );
    await this.pipelineRuntimeCommandService.resumeFromHumanReview(
      id,
      nextState,
      getStageStatusOverridesForRetry(humanReview.sourceStageKey)
    );
  }
}

function applyRetryDecision(
  runtimeState: PipelineRuntimeState,
  sourceStageKey: 'breakdown' | 'spec' | 'estimate',
  comment: string | null
): PipelineRuntimeState {
  return {
    ...runtimeState,
    currentStageKey: sourceStageKey,
    retryBudget: resetRetryBudget(runtimeState.retryBudget, sourceStageKey, runtimeState.config.maxRetry),
    feedback: {
      ...runtimeState.feedback,
      humanReview: null
    },
    lastError: null
  };
}

function applyEditAndContinueDecision(
  runtimeState: PipelineRuntimeState,
  sourceStageKey: 'breakdown' | 'spec' | 'estimate',
  editedOutput: unknown,
  comment: string | null
): PipelineRuntimeState {
  switch (sourceStageKey) {
    case 'breakdown':
      return {
        ...runtimeState,
        currentStageKey: 'evaluation',
        artifacts: {
          ...runtimeState.artifacts,
          prd: editedOutput as PipelineRuntimeState['artifacts']['prd']
        },
        feedback: {
          ...runtimeState.feedback,
          humanReview: null
        },
        lastError: null
      };
    case 'spec':
      return {
        ...runtimeState,
        currentStageKey: 'estimate',
        artifacts: {
          ...runtimeState.artifacts,
          acSpec: editedOutput as PipelineRuntimeState['artifacts']['acSpec']
        },
        feedback: {
          ...runtimeState.feedback,
          humanReview: null
        },
        lastError: null
      };
    case 'estimate':
      return {
        ...runtimeState,
        currentStageKey: 'complete',
        artifacts: {
          ...runtimeState.artifacts,
          planReport: editedOutput as PipelineRuntimeState['artifacts']['planReport']
        },
        feedback: {
          ...runtimeState.feedback,
          humanReview: null
        },
        lastError: null
      };
    default: {
      const neverStageKey: never = sourceStageKey;
      return neverStageKey;
    }
  }
}

function applySkipDecision(
  runtimeState: PipelineRuntimeState,
  sourceStageKey: 'spec' | 'estimate',
  comment: string
): PipelineRuntimeState {
  switch (sourceStageKey) {
    case 'spec':
      return {
        ...runtimeState,
        currentStageKey: 'estimate',
        feedback: {
          ...runtimeState.feedback,
          humanReview: null
        },
        lastError: null
      };
    case 'estimate':
      return {
        ...runtimeState,
        currentStageKey: 'complete',
        feedback: {
          ...runtimeState.feedback,
          humanReview: null
        },
        lastError: null
      };
    default: {
      const neverStageKey: never = sourceStageKey;
      return neverStageKey;
    }
  }
}

function resetRetryBudget(
  retryBudget: PipelineRuntimeState['retryBudget'],
  sourceStageKey: 'breakdown' | 'spec' | 'estimate',
  maxRetry: number
): PipelineRuntimeState['retryBudget'] {
  const initialRemaining = maxRetry + 1;

  switch (sourceStageKey) {
    case 'breakdown':
      return {
        ...retryBudget,
        breakdown: {
          remaining: initialRemaining,
          agentFailureCount: 0,
          evaluationRejectCount: 0
        }
      };
    case 'spec':
      return {
        ...retryBudget,
        spec: {
          remaining: initialRemaining
        }
      };
    case 'estimate':
      return {
        ...retryBudget,
        estimate: {
          remaining: initialRemaining
        }
      };
    default: {
      const neverStageKey: never = sourceStageKey;
      return neverStageKey;
    }
  }
}

function getStageTypeForReviewSource(
  sourceStageKey: 'breakdown' | 'spec' | 'estimate'
) {
  switch (sourceStageKey) {
    case 'breakdown':
      return PipelineStageType.Breakdown;
    case 'spec':
      return PipelineStageType.Spec;
    case 'estimate':
      return PipelineStageType.Estimate;
    default: {
      const neverStageKey: never = sourceStageKey;
      return neverStageKey;
    }
  }
}

function getStageStatusOverridesForRetry(
  sourceStageKey: 'breakdown' | 'spec' | 'estimate'
) {
  switch (sourceStageKey) {
    case 'breakdown':
      return [
        stageOverride(PipelineStageType.Breakdown, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.Evaluation, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.Spec, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.Estimate, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.HumanReview, PipelineStageStatus.Pending)
      ];
    case 'spec':
      return [
        stageOverride(PipelineStageType.Spec, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.Estimate, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.HumanReview, PipelineStageStatus.Pending)
      ];
    case 'estimate':
      return [
        stageOverride(PipelineStageType.Estimate, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.HumanReview, PipelineStageStatus.Pending)
      ];
    default: {
      const neverStageKey: never = sourceStageKey;
      return neverStageKey;
    }
  }
}

function getStageStatusOverridesForEditAndContinue(
  sourceStageKey: 'breakdown' | 'spec' | 'estimate'
) {
  switch (sourceStageKey) {
    case 'breakdown':
      return [
        stageOverride(PipelineStageType.Breakdown, PipelineStageStatus.Completed),
        stageOverride(PipelineStageType.Evaluation, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.Spec, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.Estimate, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.HumanReview, PipelineStageStatus.Completed)
      ];
    case 'spec':
      return [
        stageOverride(PipelineStageType.Spec, PipelineStageStatus.Completed),
        stageOverride(PipelineStageType.Estimate, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.HumanReview, PipelineStageStatus.Completed)
      ];
    case 'estimate':
      return [
        stageOverride(PipelineStageType.Estimate, PipelineStageStatus.Completed),
        stageOverride(PipelineStageType.HumanReview, PipelineStageStatus.Completed)
      ];
    default: {
      const neverStageKey: never = sourceStageKey;
      return neverStageKey;
    }
  }
}

function getStageStatusOverridesForSkip(
  sourceStageKey: 'spec' | 'estimate'
) {
  switch (sourceStageKey) {
    case 'spec':
      return [
        stageOverride(PipelineStageType.Spec, PipelineStageStatus.Skipped),
        stageOverride(PipelineStageType.Estimate, PipelineStageStatus.Pending),
        stageOverride(PipelineStageType.HumanReview, PipelineStageStatus.Completed)
      ];
    case 'estimate':
      return [
        stageOverride(PipelineStageType.Estimate, PipelineStageStatus.Skipped),
        stageOverride(PipelineStageType.HumanReview, PipelineStageStatus.Completed)
      ];
    default: {
      const neverStageKey: never = sourceStageKey;
      return neverStageKey;
    }
  }
}

function stageOverride(
  stageType: PipelineStageType,
  status: PipelineStageStatus
) {
  return {
    stageType,
    status
  };
}
