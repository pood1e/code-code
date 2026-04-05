import { interrupt } from '@langchain/langgraph';

import type { PlanStateType, PlanStateUpdate } from '../plan-graph.state';

/**
 * Human Review Node — pauses the Graph and waits for a human decision.
 * Uses LangGraph's `interrupt()` to surface the current artifacts to the caller.
 * The Worker detects the interrupt, marks Pipeline as 'paused', and emits an SSE event.
 * When the human submits a decision, the Worker calls Command(resume=decision).
 */
export async function humanReviewNode(
  state: PlanStateType
): Promise<PlanStateUpdate> {
  // interrupt() suspends the graph and returns the payload to the caller.
  // Execution resumes here when Command(resume=decision) is called.
  const decision = await interrupt({
    prd: state.prd,
    acSpec: state.acSpec,
    planReport: state.planReport
  });

  return { humanDecision: decision as PlanStateType['humanDecision'] };
}
