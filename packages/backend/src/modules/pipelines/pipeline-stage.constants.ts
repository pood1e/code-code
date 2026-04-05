import { PipelineStageType } from '@agent-workbench/shared';

import type { PipelineRuntimeStep } from './pipeline-runtime-state';

export const PLAN_STAGE_DEFINITIONS: ReadonlyArray<{
  stageType: PipelineStageType;
  name: string;
  order: number;
}> = [
  {
    stageType: PipelineStageType.Breakdown,
    name: 'Breakdown',
    order: 0
  },
  {
    stageType: PipelineStageType.Evaluation,
    name: 'Evaluation',
    order: 1
  },
  {
    stageType: PipelineStageType.Spec,
    name: 'Spec',
    order: 2
  },
  {
    stageType: PipelineStageType.Estimate,
    name: 'Estimate',
    order: 3
  },
  {
    stageType: PipelineStageType.HumanReview,
    name: 'Human Review',
    order: 4
  }
] as const;

export function getStageTypeForStep(
  step: PipelineRuntimeStep
): PipelineStageType | null {
  switch (step) {
    case 'breakdown':
      return PipelineStageType.Breakdown;
    case 'evaluation':
      return PipelineStageType.Evaluation;
    case 'spec':
      return PipelineStageType.Spec;
    case 'estimate':
      return PipelineStageType.Estimate;
    case 'human_review':
      return PipelineStageType.HumanReview;
    case 'complete':
      return null;
    default: {
      const neverStep: never = step;
      return neverStep;
    }
  }
}
