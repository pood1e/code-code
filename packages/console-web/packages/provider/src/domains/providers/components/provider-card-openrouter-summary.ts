import type { ProviderOwnerObservabilityModel } from "../provider-owner-observability-model";
import {
  readQuotaSummaryWithObservedAt,
  resolveModelDescriptor,
} from "../provider-quota-metric-aggregation";

export type OpenRouterQuotaSummary = {
  updatedAtLabel: string | null;
  updatedAtTimestamp?: string | null;
  rows: readonly OpenRouterQuotaRow[];
};

export type OpenRouterQuotaRow = {
  modelId: string;
  label: string;
  costUsd: number | null;
  requestsCount: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

const openrouterRequestsMetric = "gen_ai.provider.usage.requests.count";
const openrouterCostMetric = "gen_ai.provider.usage.cost.usd";
const openrouterTokensMetric = "gen_ai.provider.usage.tokens.count";

export function readOpenRouterQuotaSummary(
  observability: ProviderOwnerObservabilityModel | null,
  now: Date = new Date(),
  timeZone?: string,
): OpenRouterQuotaSummary | null {
  if (!observability) {
    return null;
  }
  const rowsByModel = new Map<string, OpenRouterQuotaRow>();
  
  const ensureRow = (labels?: Record<string, string>) => {
    const descriptor = resolveModelDescriptor(labels, "Unknown");
    const id = descriptor.id.trim();
    if (!id) return null;
    let row = rowsByModel.get(id);
    if (!row) {
      row = {
        modelId: id,
        label: descriptor.label,
        costUsd: null,
        requestsCount: null,
        inputTokens: null,
        outputTokens: null,
      };
      rowsByModel.set(id, row);
    }
    return row;
  };

  for (const metricRow of observability.metricRows(openrouterCostMetric)) {
    if (typeof metricRow.value === "number") {
      const row = ensureRow(metricRow.labels);
      if (row) row.costUsd = metricRow.value;
    }
  }
  for (const metricRow of observability.metricRows(openrouterRequestsMetric)) {
    if (typeof metricRow.value === "number") {
      const row = ensureRow(metricRow.labels);
      if (row) row.requestsCount = metricRow.value;
    }
  }
  for (const metricRow of observability.metricRows(openrouterTokensMetric, { token_type: "input" })) {
    if (typeof metricRow.value === "number") {
      const row = ensureRow(metricRow.labels);
      if (row) row.inputTokens = metricRow.value;
    }
  }
  for (const metricRow of observability.metricRows(openrouterTokensMetric, { token_type: "output" })) {
    if (typeof metricRow.value === "number") {
      const row = ensureRow(metricRow.labels);
      if (row) row.outputTokens = metricRow.value;
    }
  }

  const rows = Array.from(rowsByModel.values())
    .filter((row) => row.costUsd !== null || row.requestsCount !== null)
    .sort((left, right) => right.costUsd === left.costUsd ? 0 : ((right.costUsd || 0) - (left.costUsd || 0)));

  const summary = readQuotaSummaryWithObservedAt(rows, observability, now, timeZone);
  if (summary == null) {
    return null;
  }
  return {
    rows: summary.rows,
    updatedAtLabel: summary.updatedAtLabel,
    updatedAtTimestamp: summary.updatedAtTimestamp,
  };
}
