import type { PlanStateType, PlanStateUpdate } from '../plan-graph.state';

/**
 * Estimate Agent (mock) — generates a plan report with effort estimates.
 * Will be replaced with real LLM invocation in a future iteration.
 */
export async function estimateAgent(
  state: PlanStateType
): Promise<PlanStateUpdate> {
  const tasks = state.prd?.tasks ?? [];
  const totalAC = state.acSpec.reduce((sum, s) => sum + s.ac.length, 0);

  const lines: string[] = [
    `# Plan Report: ${state.prd?.feature ?? 'Feature'}`,
    '',
    '## Summary',
    '',
    `- Total tasks: ${tasks.length}`,
    `- Total acceptance criteria: ${totalAC}`,
    `- Estimated complexity: ${tasks.length <= 3 ? 'Low' : tasks.length <= 6 ? 'Medium' : 'High'}`,
    '',
    '## Task Breakdown',
    ''
  ];

  for (const task of tasks) {
    const spec = state.acSpec.find((s) => s.taskId === task.id);
    lines.push(`### ${task.id}: ${task.title}`);
    lines.push(`- Type: ${task.type}`);
    lines.push(`- Dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'none'}`);
    lines.push(`- Acceptance criteria: ${spec?.ac.length ?? 0}`);
    lines.push('');
  }

  lines.push('## Risks and Ambiguities', '');
  for (const ambiguity of state.prd?.ambiguities ?? []) {
    lines.push(`- ${ambiguity}`);
  }

  const planReport = lines.join('\n');
  return { planReport };
}
