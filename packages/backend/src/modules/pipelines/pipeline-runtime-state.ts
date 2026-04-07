import {
  DEFAULT_PIPELINE_CONFIG,
  pipelineRuntimeStateSchema,
  type PipelineConfig,
  type PipelineRuntimeStageKey,
  type PipelineRuntimeState as SharedPipelineRuntimeState
} from '@agent-workbench/shared';

export const PIPELINE_RUNTIME_STEPS = [
  'breakdown',
  'evaluation',
  'spec',
  'estimate',
  'human_review',
  'complete'
] as const;

export type PipelineRuntimeStep = (typeof PIPELINE_RUNTIME_STEPS)[number];
export type PipelineRuntimeState = SharedPipelineRuntimeState;

export function createInitialPipelineRuntimeState(
  config: PipelineConfig
): PipelineRuntimeState {
  const initialRemaining = config.maxRetry + 1;

  return {
    currentStageKey: 'breakdown',
    config,
    retryBudget: {
      breakdown: {
        remaining: initialRemaining,
        agentFailureCount: 0,
        evaluationRejectCount: 0
      },
      spec: {
        remaining: initialRemaining
      },
      estimate: {
        remaining: initialRemaining
      }
    },
    artifacts: {
      prd: null,
      acSpec: null,
      planReport: null
    },
    feedback: {
      breakdownRejectionHistory: [],
      humanReview: null
    },
    lastError: null
  };
}

export function parsePipelineRuntimeState(value: unknown): PipelineRuntimeState {
  const parseResult = pipelineRuntimeStateSchema.safeParse(value);
  if (parseResult.success) {
    return parseResult.data;
  }

  return createInitialPipelineRuntimeState(DEFAULT_PIPELINE_CONFIG);
}

export function getNextPipelineStageKey(
  currentStageKey: PipelineRuntimeStageKey
): PipelineRuntimeStageKey {
  switch (currentStageKey) {
    case 'breakdown':
      return 'evaluation';
    case 'evaluation':
      return 'spec';
    case 'spec':
      return 'estimate';
    case 'estimate':
      return 'human_review';
    case 'human_review':
      return 'complete';
    case 'complete':
      return 'complete';
    default: {
      const neverStageKey: never = currentStageKey;
      return neverStageKey;
    }
  }
}
