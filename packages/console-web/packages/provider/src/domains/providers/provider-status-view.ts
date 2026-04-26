import { ProviderSurfaceBindingPhase } from "@code-code/agent-contract/platform/management/v1";

export function providerStatusColor(phase: ProviderSurfaceBindingPhase | undefined): "green" | "red" | "amber" | "gray" {
  switch (phase) {
    case ProviderSurfaceBindingPhase.READY:
      return "green";
    case ProviderSurfaceBindingPhase.REFRESHING:
    case ProviderSurfaceBindingPhase.STALE:
      return "amber";
    case ProviderSurfaceBindingPhase.INVALID_CONFIG:
    case ProviderSurfaceBindingPhase.ERROR:
      return "red";
    default:
      return "gray";
  }
}

export function providerStatusLabel(phase: ProviderSurfaceBindingPhase | undefined) {
  switch (phase) {
    case ProviderSurfaceBindingPhase.READY:
      return "Ready";
    case ProviderSurfaceBindingPhase.INVALID_CONFIG:
      return "Invalid Config";
    case ProviderSurfaceBindingPhase.REFRESHING:
      return "Refreshing";
    case ProviderSurfaceBindingPhase.STALE:
      return "Stale";
    case ProviderSurfaceBindingPhase.ERROR:
      return "Error";
    default:
      return "Unknown";
  }
}

export function providerStatusReason(
  phase: ProviderSurfaceBindingPhase | undefined,
  reason: string | undefined,
) {
  const normalizedReason = reason?.trim() ?? "";
  if (!normalizedReason) {
    return "";
  }
  if (phase === ProviderSurfaceBindingPhase.READY) {
    return "";
  }
  return normalizedReason;
}
