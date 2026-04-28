import {
  ProviderHostTelemetryAvailability,
  type ProviderHostTelemetry,
} from "@code-code/agent-contract/platform/management/v1";

type HostTelemetryColor = "green" | "red" | "amber" | "gray";

export function providerHostTelemetryStatus(item?: ProviderHostTelemetry): { color: HostTelemetryColor; label: string } {
  switch (item?.availability) {
    case ProviderHostTelemetryAvailability.REACHABLE:
      return { color: "green", label: "Reachable" };
    case ProviderHostTelemetryAvailability.UNREACHABLE:
      return { color: "red", label: "Unreachable" };
    case ProviderHostTelemetryAvailability.UNKNOWN:
      return { color: "gray", label: "Unknown" };
    default:
      return { color: "gray", label: "Unknown" };
  }
}

export function providerHostTelemetryLatencyLabel(item?: ProviderHostTelemetry) {
  const seconds = item?.latencySeconds ?? 0;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }
  if (seconds < 1) {
    return `${Math.max(1, Math.round(seconds * 1000))} ms`;
  }
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
}
