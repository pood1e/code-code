import { Injectable } from '@nestjs/common';

import type {
  PipelineRuntimeState,
  PipelineStageType
} from '@agent-workbench/shared';

type StagePromptInput = {
  stageType: PipelineStageType;
  featureRequest: string | null;
  runtimeState: PipelineRuntimeState;
  attemptNo: number;
  reviewerComment?: string | null;
};

@Injectable()
export class PipelineStagePromptService {
  buildStagePrompt(input: StagePromptInput): {
    prompt: string;
    inputSnapshot: Record<string, unknown>;
  } {
    const inputSnapshot = this.buildInputSnapshot(input);
    const prompt = [
      `You are executing the pipeline stage "${input.stageType}".`,
      'Return a single fenced code block using the info string `json pipeline-output`.',
      'Do not wrap the JSON in prose before or after the fence.',
      `STAGE:${input.stageType}`,
      'PIPELINE_INPUT_JSON_START',
      JSON.stringify(inputSnapshot, null, 2),
      'PIPELINE_INPUT_JSON_END',
      '',
      'Output requirements:',
      this.getStageOutputContract(input.stageType)
    ].join('\n');

    return {
      prompt,
      inputSnapshot
    };
  }

  buildRepairPrompt(stageType: PipelineStageType, errorMessage: string): string {
    return [
      `The previous ${stageType} output could not be parsed.`,
      `Parser error: ${errorMessage}`,
      'Please resend only a single fenced code block using `json pipeline-output` with valid JSON that matches the requested schema.',
      `STAGE:${stageType}`
    ].join('\n');
  }

  private buildInputSnapshot(input: StagePromptInput): Record<string, unknown> {
    switch (input.stageType) {
      case 'breakdown':
        return {
          featureRequest: input.featureRequest ?? '',
          breakdownRejectionHistory:
            input.runtimeState.feedback.breakdownRejectionHistory,
          reviewerComment: input.reviewerComment ?? null,
          attemptNo: input.attemptNo
        };
      case 'spec':
        return {
          prd: input.runtimeState.artifacts.prd,
          reviewerComment: input.reviewerComment ?? null,
          attemptNo: input.attemptNo
        };
      case 'estimate':
        return {
          prd: input.runtimeState.artifacts.prd,
          acSpec: input.runtimeState.artifacts.acSpec,
          reviewerComment: input.reviewerComment ?? null,
          attemptNo: input.attemptNo
        };
      default:
        return {
          attemptNo: input.attemptNo
        };
    }
  }

  private getStageOutputContract(stageType: PipelineStageType): string {
    switch (stageType) {
      case 'breakdown':
        return 'Return a PRD JSON object with feature, userStories, systemBoundary, ambiguities, and tasks.';
      case 'spec':
        return 'Return a JSON array of TaskACSpec items keyed by taskId.';
      case 'estimate':
        return 'Return a PlanReport JSON object with totalEstimateDays, confidence, taskEstimates, overallRisks, assumptions, and optional notes.';
      default:
        return 'Return valid JSON.';
    }
  }
}
