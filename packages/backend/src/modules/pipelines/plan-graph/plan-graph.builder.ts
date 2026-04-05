import { MemorySaver, StateGraph, END } from '@langchain/langgraph';
import { HumanDecisionAction } from '@agent-workbench/shared';

import { PlanState } from './plan-graph.state';
import { breakdownAgent } from './agents/breakdown.agent';
import { specAgent } from './agents/spec.agent';
import { estimateAgent } from './agents/estimate.agent';
import { evaluationNode } from './nodes/evaluation.node';
import { humanReviewNode } from './nodes/human-review.node';
import type { PlanStateType } from './plan-graph.state';

/** Route after evaluation: if violations exist → breakdown, else → spec */
function evaluationRouter(
  state: PlanStateType
): 'breakdown' | 'spec' {
  return state.breakdownFeedback !== null ? 'breakdown' : 'spec';
}

/** Route after human review decision */
function reviewRouter(
  state: PlanStateType
): 'breakdown' | 'spec' | typeof END {
  const decision = state.humanDecision;
  if (!decision) return END;

  switch (decision.action) {
    case HumanDecisionAction.Approve:
      return END;
    case HumanDecisionAction.Modify:
      // Modify: redo spec phase only (keep PRD, regenerate AC + report)
      return 'spec';
    case HumanDecisionAction.Reject:
      // Reject: restart from breakdown
      return 'breakdown';
    default: {
      const _exhaustive: never = decision.action;
      return _exhaustive;
    }
  }
}

/**
 * Build and compile the Plan Pipeline LangGraph.
 * Uses MemorySaver as checkpointer (MVP).
 * For production, replace with SqliteSaver or PostgresSaver.
 */
export function buildPlanGraph() {
  const checkpointer = new MemorySaver();

  const graph = new StateGraph(PlanState)
    .addNode('breakdown', breakdownAgent)
    .addNode('evaluation', evaluationNode)
    .addNode('spec', specAgent)
    .addNode('estimate', estimateAgent)
    .addNode('humanReview', humanReviewNode)
    .addEdge('__start__', 'breakdown')
    .addEdge('breakdown', 'evaluation')
    .addConditionalEdges('evaluation', evaluationRouter, {
      breakdown: 'breakdown',
      spec: 'spec'
    })
    .addEdge('spec', 'estimate')
    .addEdge('estimate', 'humanReview')
    .addConditionalEdges('humanReview', reviewRouter, {
      breakdown: 'breakdown',
      spec: 'spec',
      [END]: END
    });

  return graph.compile({ checkpointer });
}

export type PlanGraph = ReturnType<typeof buildPlanGraph>;
