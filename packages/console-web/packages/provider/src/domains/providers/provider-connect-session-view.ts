import { ProviderConnectSessionPhase } from "@code-code/agent-contract/platform/management/v1";

export function providerConnectPhaseColor(phase: ProviderConnectSessionPhase | undefined): "green" | "red" | "amber" | "gray" {
  switch (phase) {
    case ProviderConnectSessionPhase.SUCCEEDED:
      return "green";
    case ProviderConnectSessionPhase.FAILED:
    case ProviderConnectSessionPhase.EXPIRED:
    case ProviderConnectSessionPhase.CANCELED:
      return "red";
    case ProviderConnectSessionPhase.AWAITING_USER:
    case ProviderConnectSessionPhase.PROCESSING:
      return "amber";
    default:
      return "gray";
  }
}

export function providerConnectPhaseLabel(phase: ProviderConnectSessionPhase | undefined) {
  switch (phase) {
    case ProviderConnectSessionPhase.PENDING:
      return "Preparing";
    case ProviderConnectSessionPhase.AWAITING_USER:
      return "Awaiting Authorization";
    case ProviderConnectSessionPhase.PROCESSING:
      return "Finishing Setup";
    case ProviderConnectSessionPhase.SUCCEEDED:
      return "Connected";
    case ProviderConnectSessionPhase.FAILED:
      return "Failed";
    case ProviderConnectSessionPhase.EXPIRED:
      return "Expired";
    case ProviderConnectSessionPhase.CANCELED:
      return "Canceled";
    default:
      return "Pending";
  }
}

export function isTerminalProviderConnectPhase(phase: ProviderConnectSessionPhase | undefined) {
  return phase === ProviderConnectSessionPhase.SUCCEEDED
    || phase === ProviderConnectSessionPhase.FAILED
    || phase === ProviderConnectSessionPhase.EXPIRED
    || phase === ProviderConnectSessionPhase.CANCELED;
}

export function isProviderConnectSessionPollingComplete(session: { phase?: ProviderConnectSessionPhase; provider?: unknown } | undefined) {
  if (!session) {
    return false;
  }
  if (session.phase === ProviderConnectSessionPhase.SUCCEEDED) {
    return Boolean(session.provider);
  }
  return isTerminalProviderConnectPhase(session.phase);
}
