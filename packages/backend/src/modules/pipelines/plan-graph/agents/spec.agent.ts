import type { TaskACSpec } from '@agent-workbench/shared';

import type { PlanStateType, PlanStateUpdate } from '../plan-graph.state';

/**
 * Spec Agent (mock) — generates Acceptance Criteria specs for each PRD task.
 * Will be replaced with real LLM invocation in a future iteration.
 */
export async function specAgent(
  state: PlanStateType
): Promise<PlanStateUpdate> {
  const tasks = state.prd?.tasks ?? [];

  const acSpec: TaskACSpec[] = tasks.map((task) => ({
    taskId: task.id,
    ac: Array.from({ length: Math.max(1, task.estimatedAC) }, (_, i) => ({
      id: `${task.id}-ac-${i + 1}`,
      given: `Given the system is in a valid state for ${task.title}`,
      when: `When the user performs action ${i + 1}`,
      then: `Then the expected outcome ${i + 1} is achieved and persisted`
    }))
  }));

  return { acSpec };
}
