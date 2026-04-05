import type { TaskACSpec } from '@agent-workbench/shared';

import type { PipelineRuntimeState } from '../../pipeline-runtime-state';

/**
 * Spec Agent (mock) — generates Acceptance Criteria specs for each PRD task.
 * Will be replaced with real LLM invocation in a future iteration.
 */
export function specAgent(
  state: Pick<PipelineRuntimeState, 'prd' | 'humanFeedback'>
): Pick<PipelineRuntimeState, 'acSpec'> {
  const tasks = state.prd?.tasks ?? [];
  const feedbackSuffix = state.humanFeedback
    ? ` (${state.humanFeedback})`
    : '';

  const acSpec: TaskACSpec[] = tasks.map((task) => ({
    taskId: task.id,
    ac: Array.from({ length: Math.max(1, task.estimatedAC) }, (_, i) => ({
      id: `${task.id}-ac-${i + 1}`,
      given: `Given the system is in a valid state for ${task.title}`,
      when: `When the user performs action ${i + 1}`,
      then: `Then the expected outcome ${i + 1} is achieved and persisted${feedbackSuffix}`
    }))
  }));

  return { acSpec };
}
