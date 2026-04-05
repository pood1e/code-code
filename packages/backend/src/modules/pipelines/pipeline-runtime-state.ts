import {
  DEFAULT_PIPELINE_CONFIG,
  type BreakdownFeedback,
  type PipelineConfig,
  type PRD,
  type TaskACSpec
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

export type PipelineRuntimeState = {
  currentStep: PipelineRuntimeStep;
  config: PipelineConfig;
  prd: PRD | null;
  breakdownFeedback: BreakdownFeedback | null;
  acSpec: TaskACSpec[];
  planReport: string | null;
  humanFeedback: string | null;
  retryCount: number;
};

export function createInitialPipelineRuntimeState(
  config: PipelineConfig
): PipelineRuntimeState {
  return {
    currentStep: 'breakdown',
    config,
    prd: null,
    breakdownFeedback: null,
    acSpec: [],
    planReport: null,
    humanFeedback: null,
    retryCount: 0
  };
}

export function parsePipelineRuntimeState(
  value: unknown
): PipelineRuntimeState {
  const raw = toRecord(value);
  const configRecord = toRecord(raw.config);
  const currentStep = isPipelineRuntimeStep(raw.currentStep)
    ? raw.currentStep
    : 'breakdown';

  return {
    currentStep,
    config: {
      maxRetry:
        typeof configRecord.maxRetry === 'number' &&
        Number.isInteger(configRecord.maxRetry) &&
        configRecord.maxRetry >= 1
          ? configRecord.maxRetry
          : DEFAULT_PIPELINE_CONFIG.maxRetry
    },
    prd: raw.prd && typeof raw.prd === 'object' ? (raw.prd as PRD) : null,
    breakdownFeedback:
      raw.breakdownFeedback && typeof raw.breakdownFeedback === 'object'
        ? (raw.breakdownFeedback as BreakdownFeedback)
        : null,
    acSpec: Array.isArray(raw.acSpec) ? (raw.acSpec as TaskACSpec[]) : [],
    planReport: typeof raw.planReport === 'string' ? raw.planReport : null,
    humanFeedback:
      typeof raw.humanFeedback === 'string' ? raw.humanFeedback : null,
    retryCount:
      typeof raw.retryCount === 'number' &&
      Number.isInteger(raw.retryCount) &&
      raw.retryCount >= 0
        ? raw.retryCount
        : 0
  };
}

function isPipelineRuntimeStep(value: unknown): value is PipelineRuntimeStep {
  return (
    typeof value === 'string' &&
    (PIPELINE_RUNTIME_STEPS as readonly string[]).includes(value)
  );
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
