import type { BreakdownFeedback } from '@agent-workbench/shared';

import type { EvaluationResult, GranularityViolation } from '../plan-graph.types';
import type { PlanStateType, PlanStateUpdate } from '../plan-graph.state';

const MIN_TASKS = 1;
const MAX_TASKS = 8;
const MIN_DESCRIPTION_LENGTH = 20;
const MAX_DEPENDENCY_DEPTH = 3;

/**
 * Evaluation Node — pure code node, no LLM calls.
 * Checks granularity constraints on the PRD:
 * - Task count in acceptable range
 * - Task descriptions are sufficiently detailed
 * - Dependency depth is not too deep
 */
export function evaluationNode(state: PlanStateType): PlanStateUpdate {
  const result = evaluatePrd(state);

  if (result.pass) {
    return { breakdownFeedback: null };
  }

  const violationSummary = result.violations
    .map((v) => `${v.taskId}: ${v.reason}`)
    .join('; ');

  const feedback: BreakdownFeedback = {
    mode: 'partial',
    targetTaskIds: result.violations.map((v) => v.taskId),
    reason: `Granularity check failed: ${violationSummary}`,
    suggestion: buildSuggestion(result.violations)
  };

  return { breakdownFeedback: feedback };
}

function evaluatePrd(state: PlanStateType): EvaluationResult {
  const tasks = state.prd?.tasks ?? [];
  const violations: GranularityViolation[] = [];

  if (tasks.length < MIN_TASKS || tasks.length > MAX_TASKS) {
    violations.push({
      taskId: '__root__',
      reason: `Task count ${tasks.length} is outside the acceptable range [${MIN_TASKS}, ${MAX_TASKS}]`
    });
  }

  for (const task of tasks) {
    if (task.description.length < MIN_DESCRIPTION_LENGTH) {
      violations.push({
        taskId: task.id,
        reason: `Description too short (${task.description.length} chars, min ${MIN_DESCRIPTION_LENGTH})`
      });
    }
  }

  const depthViolations = checkDependencyDepth(tasks);
  violations.push(...depthViolations);

  return { pass: violations.length === 0, violations };
}

function checkDependencyDepth(
  tasks: Array<{ id: string; dependencies: string[] }>
): GranularityViolation[] {
  const violations: GranularityViolation[] = [];
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const getDepth = (taskId: string, visited = new Set<string>()): number => {
    if (visited.has(taskId)) return 0; // cycle protection
    visited.add(taskId);
    const task = taskMap.get(taskId);
    if (!task || task.dependencies.length === 0) return 0;
    return 1 + Math.max(...task.dependencies.map((dep) => getDepth(dep, new Set(visited))));
  };

  for (const task of tasks) {
    const depth = getDepth(task.id);
    if (depth > MAX_DEPENDENCY_DEPTH) {
      violations.push({
        taskId: task.id,
        reason: `Dependency chain depth ${depth} exceeds maximum ${MAX_DEPENDENCY_DEPTH}`
      });
    }
  }

  return violations;
}

function buildSuggestion(violations: GranularityViolation[]): string {
  const hasTaskCount = violations.some((v) => v.taskId === '__root__');
  const hasShortDesc = violations.some((v) => v.reason.includes('short'));
  const hasDeps = violations.some((v) => v.reason.includes('depth'));

  const parts: string[] = [];
  if (hasTaskCount) parts.push('adjust the number of tasks');
  if (hasShortDesc) parts.push('provide more detailed task descriptions (at least 20 chars)');
  if (hasDeps) parts.push('flatten the dependency hierarchy');

  return parts.length > 0 ? `Please ${parts.join(' and ')}.` : 'Please revise the breakdown.';
}
