import {
  formatMetricPercent,
  type ProviderOwnerObservabilityModel,
  type ProviderRuntimeMetricRow,
} from "./provider-owner-observability-model";
import { formatQuotaResetAtLocal } from "./provider-observability-time";

export type QuotaMetricDescriptor = {
  id: string;
  label: string;
};

export type QuotaPercentWindowMetricDescriptor = {
  label: string;
  percentMetric: string;
  resetMetric: string;
};

export type QuotaPercentWindowRow = {
  label: string;
  percent: number;
  resetAtLabel: string | null;
};

export type QuotaPercentCardRow = {
  label: string;
  percent: number;
  resetAtLabel?: string | null;
};

export type QuotaCardSummary<TRow> = {
  rows: readonly TRow[];
  updatedAtLabel: string | null;
  updatedAtTimestamp?: string | null;
};

export type QuotaPercentWindowSummary = QuotaCardSummary<QuotaPercentWindowRow>;

export type ProviderQuotaCardRow = {
  id: string;
  label: string;
  value: string;
  resetAtLabel?: string | null;
  progressPercent?: number | null;
  progressUnavailableLabel?: string | null;
  subtle?: boolean;
};

export function toProviderQuotaCardRows<TSummary extends QuotaPercentCardRow>(
  rows: readonly TSummary[],
  getId: (row: TSummary) => string = (row) => row.label,
): ProviderQuotaCardRow[] {
  return rows.map((row) => ({
    id: getId(row),
    label: row.label,
    value: formatMetricPercent(row.percent),
    resetAtLabel: row.resetAtLabel ?? null,
    progressPercent: row.percent,
  }));
}

export function appendNumericMetricRowsByDescriptor<TState>(
  rowsByDescriptor: Map<string, TState>,
  metricRows: readonly ProviderRuntimeMetricRow[],
  resolveDescriptor: (labels?: Record<string, string>) => QuotaMetricDescriptor | null,
  createState: (descriptor: QuotaMetricDescriptor) => TState,
  assignValue: (state: TState, value: number) => void,
): void {
  for (const metricRow of metricRows) {
    if (typeof metricRow.value !== "number") {
      continue;
    }
    const descriptor = resolveDescriptor(metricRow.labels);
    if (!descriptor) {
      continue;
    }
    const id = descriptor.id.trim();
    if (!id) {
      continue;
    }
    const current = rowsByDescriptor.get(id);
    const next = current ?? createState({
      id,
      label: descriptor.label.trim(),
    });
    assignValue(next, metricRow.value);
    rowsByDescriptor.set(id, next);
  }
}

export function resolveModelDescriptor(labels: Record<string, string> | undefined, fallbackLabel = "Text"): QuotaMetricDescriptor {
  const id = (labels?.model_id || "").trim() || fallbackLabel;
  return { id, label: id };
}

export function readQuotaPercentWindowRows(
  observability: ProviderOwnerObservabilityModel,
  metricDescriptors: readonly QuotaPercentWindowMetricDescriptor[],
  now: Date,
  timeZone: string | undefined,
  resolvePercent: (rawPercent: number) => number,
) {
  return metricDescriptors
    .map((descriptor) => {
      const percent = observability.metricValue(descriptor.percentMetric);
      if (percent === null) {
        return null;
      }
      return {
        label: descriptor.label,
        percent: resolvePercent(percent),
        resetAtLabel: formatQuotaResetAtLocal(observability.metricValue(descriptor.resetMetric), now, timeZone),
      };
    })
    .filter((row): row is QuotaPercentWindowRow => row !== null && Number.isFinite(row.percent));
}

export function readQuotaPercentWindowSummary(
  observability: ProviderOwnerObservabilityModel,
  metricDescriptors: readonly QuotaPercentWindowMetricDescriptor[],
  now: Date,
  timeZone: string | undefined,
  resolvePercent: (rawPercent: number) => number,
): QuotaPercentWindowSummary | null {
  const rows = readQuotaPercentWindowRows(observability, metricDescriptors, now, timeZone, resolvePercent);
  return readQuotaSummaryWithObservedAt(rows, observability, now, timeZone);
}

export function readQuotaSummaryWithObservedAt<TRow>(
  rows: readonly TRow[],
  observability: ProviderOwnerObservabilityModel,
  now: Date,
  timeZone: string | undefined,
): QuotaCardSummary<TRow> | null {
  if (!rows.length) {
    return null;
  }
  return {
    rows: [...rows],
    updatedAtLabel: observability.observedAtLabel(now, timeZone),
    updatedAtTimestamp: observability.observedAtTimestamp(),
  };
}
