import type { PRD } from '@agent-workbench/shared';

import type { PlanStateType, PlanStateUpdate } from '../plan-graph.state';

/**
 * Breakdown Agent (mock) — converts featureRequest into a structured PRD.
 * Will be replaced with real LLM invocation in a future iteration.
 */
export async function breakdownAgent(
  state: PlanStateType
): Promise<PlanStateUpdate> {
  const feedback = state.breakdownFeedback;

  // Build a mock PRD — in real usage this calls an LLM
  const prd: PRD = {
    feature: state.featureRequest || 'Untitled Feature',
    userStories: [
      'As a user, I can perform the core action',
      'As a user, I receive feedback on my action'
    ],
    systemBoundary: {
      in: ['API endpoint', 'UI component'],
      out: ['Authentication', 'Billing'],
      outOfScope: ['Mobile app']
    },
    ambiguities: feedback?.suggestion
      ? [`Addressing feedback: ${feedback.suggestion}`]
      : ['Define exact error codes', 'Clarify pagination defaults'],
    tasks: [
      {
        id: 'task-1',
        title: 'Backend API endpoint',
        description:
          'Implement the REST API endpoint with validation, business logic, and persistence.',
        interface: 'POST /api/resource',
        dependencies: [],
        type: 'api',
        estimatedAC: 3
      },
      {
        id: 'task-2',
        title: 'Frontend UI component',
        description:
          'Build the React component with form, loading state, and error handling.',
        interface: 'ResourceForm component',
        dependencies: ['task-1'],
        type: 'ui',
        estimatedAC: 4
      }
    ]
  };

  return {
    prd,
    breakdownFeedback: null,
    retryCount: state.retryCount + (feedback ? 1 : 0)
  };
}
