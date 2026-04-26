import {
  ProviderStatusEventKind,
  ProviderWorkflowPhase,
  type ProviderStatusEvent,
} from "@code-code/agent-contract/platform/management/v1";

type WorkflowStatusColor = "green" | "red" | "amber" | "gray";

export type ProviderWorkflowStatusView = {
  color: WorkflowStatusColor;
  label: string;
  reason: string;
};

export function providerWorkflowStatusFromEvent(event: ProviderStatusEvent): ProviderWorkflowStatusView | null {
  if (event.kind !== ProviderStatusEventKind.WORKFLOW || !event.workflow) {
    return null;
  }
  switch (event.workflow.phase) {
    case ProviderWorkflowPhase.PENDING:
      return workflowStatus("amber", event, "Pending");
    case ProviderWorkflowPhase.RUNNING:
      return workflowStatus("amber", event, "Running");
    case ProviderWorkflowPhase.FAILED:
    case ProviderWorkflowPhase.ERROR:
      return workflowStatus("red", event, "Failed");
    case ProviderWorkflowPhase.CANCELED:
      return workflowStatus("gray", event, "Canceled");
    default:
      return null;
  }
}

function workflowStatus(
  color: WorkflowStatusColor,
  event: ProviderStatusEvent,
  phaseLabel: string,
): ProviderWorkflowStatusView {
  return {
    color,
    label: `${workflowKindLabel(event.workflow?.workflowKind)} ${phaseLabel}`,
    reason: event.workflow?.message?.trim() || "",
  };
}

function workflowKindLabel(value?: string) {
  const normalized = value?.trim() || "Workflow";
  return normalized
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
