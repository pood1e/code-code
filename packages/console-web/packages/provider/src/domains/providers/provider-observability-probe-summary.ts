import type { ProviderObservabilityProbeAllResponse } from "./api";

export function formatProviderObservabilityProbeSummary(response: ProviderObservabilityProbeAllResponse) {
  const results = response.results ?? [];
  const counts = results.reduce<Record<string, number>>((items, result) => {
    const key = normalizeProbeOutcome(result.outcome);
    items[key] = (items[key] || 0) + 1;
    return items;
  }, {});

  const executed = counts.EXECUTED || 0;
  const throttled = counts.THROTTLED || 0;
  const authBlocked = counts.AUTH_BLOCKED || 0;
  const failed = counts.FAILED || 0;
  const unsupported = counts.UNSUPPORTED || 0;
  const total = response.triggeredCount || results.length;
  if (isQueuedResponse(response.message, results)) {
    return `Quota refresh queued for ${total} provider${total === 1 ? "" : "s"}.`;
  }
  const details = [
    executed > 0 ? `${executed} refreshed` : "",
    throttled > 0 ? `${throttled} throttled` : "",
    authBlocked > 0 ? `${authBlocked} auth blocked` : "",
    failed > 0 ? `${failed} failed` : "",
    unsupported > 0 ? `${unsupported} unsupported` : "",
  ].filter(Boolean);

  if (details.length === 0) {
    return `Quota refresh finished for ${total} provider${total === 1 ? "" : "s"}.`;
  }
  return `Quota refresh finished for ${total} provider${total === 1 ? "" : "s"}: ${details.join(" · ")}.`;
}

function isQueuedResponse(message: string | undefined, results: ProviderObservabilityProbeAllResponse["results"]) {
  if (messageHasWorkflowSignal(message)) {
    return true;
  }
  return (results || []).some((result) => (
    normalizeProbeOutcome(result.outcome) === "UNSPECIFIED" && messageHasWorkflowSignal(result.message)
  ));
}

function messageHasWorkflowSignal(message?: string) {
  const normalized = (message || "").trim().toLowerCase();
  return normalized.includes("workflow submitted") || normalized.includes("queued");
}

function normalizeProbeOutcome(outcome?: string) {
  const normalized = (outcome || "").trim().toUpperCase();
  if (!normalized) {
    return "UNKNOWN";
  }
  const markers = [
    "PROVIDER_O_AUTH_OBSERVABILITY_PROBE_OUTCOME_",
    "PROVIDER_OBSERVABILITY_PROBE_OUTCOME_",
  ];
  for (const marker of markers) {
    if (normalized.includes(marker)) {
      return normalized.split(marker).pop() || "UNKNOWN";
    }
  }
  return normalized;
}
