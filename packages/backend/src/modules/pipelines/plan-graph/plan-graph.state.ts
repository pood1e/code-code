import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

import type {
  BreakdownFeedback,
  HumanDecision,
  PRD,
  TaskACSpec
} from '@agent-workbench/shared';

/**
 * LangGraph state for the Plan Pipeline.
 * This is the single source of truth for Graph execution data.
 * PipelineStage records in DB are used only for frontend display.
 */
export const PlanState = Annotation.Root({
  featureRequest: Annotation<string>({
    default: () => '',
    reducer: (_prev, next) => next
  }),
  prd: Annotation<PRD | null>({
    default: () => null,
    reducer: (_prev, next) => next
  }),
  acSpec: Annotation<TaskACSpec[]>({
    default: () => [],
    reducer: (_prev, next) => next
  }),
  planReport: Annotation<string | null>({
    default: () => null,
    reducer: (_prev, next) => next
  }),
  humanDecision: Annotation<HumanDecision | null>({
    default: () => null,
    reducer: (_prev, next) => next
  }),
  breakdownFeedback: Annotation<BreakdownFeedback | null>({
    default: () => null,
    reducer: (_prev, next) => next
  }),
  retryCount: Annotation<number>({
    default: () => 0,
    reducer: (_prev, next) => next
  }),
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next]
  })
});

export type PlanStateType = typeof PlanState.State;
export type PlanStateUpdate = Partial<PlanStateType>;

// Suppress unused import warning — MessagesAnnotation may be needed later
void MessagesAnnotation;
