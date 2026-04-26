import { normalizeMetricPercent, type ProviderOwnerObservabilityModel } from "../provider-owner-observability-model";
import { formatQuotaResetAtLocal } from "../provider-observability-time";
import {
  appendNumericMetricRowsByDescriptor,
  readQuotaSummaryWithObservedAt,
  resolveModelDescriptor,
} from "../provider-quota-metric-aggregation";

export type MiniMaxQuotaSummary = {
  updatedAtLabel: string | null;
  updatedAtTimestamp?: string | null;
  rows: readonly MiniMaxQuotaRow[];
};

export type MiniMaxQuotaRow = {
  modelId: string;
  label: string;
  remaining: number | null;
  total: number | null;
  progressPercent: number | null;
  resetAtLabel: string | null;
};

type MutableMiniMaxQuotaRow = {
  modelId: string;
  label: string;
  order: number;
  remaining: number | null;
  total: number | null;
  resetAtSeconds: number | null;
};

const minimaxTextRemainingCountMetric = "gen_ai.provider.quota.remaining";
const minimaxTextTotalCountMetric = "gen_ai.provider.quota.limit";
const minimaxTextResetTimestampMetric = "gen_ai.provider.quota.reset.timestamp.seconds";

export function readMiniMaxQuotaSummary(
  observability: ProviderOwnerObservabilityModel | null,
  now: Date = new Date(),
  timeZone?: string,
): MiniMaxQuotaSummary | null {
  if (!observability) {
    return null;
  }
  const rowsByModel = new Map<string, MutableMiniMaxQuotaRow>();
  appendNumericMetricRowsByDescriptor(
    rowsByModel,
    observability.metricRows(minimaxTextRemainingCountMetric, { resource: "requests" }),
    readMinimaxModelDescriptor,
    createMiniMaxQuotaRow,
    (row, value) => {
      row.remaining = value;
    },
  );
  appendNumericMetricRowsByDescriptor(
    rowsByModel,
    observability.metricRows(minimaxTextTotalCountMetric, { resource: "requests" }),
    readMinimaxModelDescriptor,
    createMiniMaxQuotaRow,
    (row, value) => {
      row.total = value;
    },
  );
  appendNumericMetricRowsByDescriptor(
    rowsByModel,
    observability.metricRows(minimaxTextResetTimestampMetric, { resource: "requests" }),
    readMinimaxModelDescriptor,
    createMiniMaxQuotaRow,
    (row, value) => {
      row.resetAtSeconds = value;
    },
  );

  const rows = Array.from(rowsByModel.values())
    .map((row): MiniMaxQuotaRow | null => {
      if (row.remaining === null && row.total === null && row.resetAtSeconds === null) {
        return null;
      }
      return {
        modelId: row.modelId,
        label: row.label,
        remaining: row.remaining,
        total: row.total,
        progressPercent: resolveQuotaProgressPercent(row.remaining, row.total),
        resetAtLabel: formatQuotaResetAtLocal(row.resetAtSeconds, now, timeZone),
      };
    })
    .filter((row): row is MiniMaxQuotaRow => row !== null)
    .sort((left, right) => compareMiniMaxQuotaRow(left, right, rowsByModel));
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

function readMinimaxModelDescriptor(labels?: Record<string, string>) {
  const descriptor = resolveModelDescriptor(labels, "Text");
  return {
    ...descriptor,
    label: minimaxQuotaLabel(descriptor.id),
  };
}

function createMiniMaxQuotaRow(descriptor: { id: string; label: string }) {
  return {
    modelId: descriptor.id,
    label: descriptor.label,
    order: minimaxQuotaOrder(descriptor.id),
    remaining: null,
    total: null,
    resetAtSeconds: null,
  };
}

function resolveQuotaProgressPercent(remaining: number | null, total: number | null) {
  if (typeof remaining !== "number" || typeof total !== "number" || total <= 0) {
    return null;
  }
  if (!Number.isFinite(remaining) || !Number.isFinite(total)) {
    return null;
  }
  return normalizeMetricPercent(remaining / total * 100);
}

function compareMiniMaxQuotaRow(
  left: MiniMaxQuotaRow,
  right: MiniMaxQuotaRow,
  rowsByModel: Map<string, MutableMiniMaxQuotaRow>,
) {
  const leftOrder = rowsByModel.get(left.modelId)?.order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = rowsByModel.get(right.modelId)?.order ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.label.localeCompare(right.label);
}

function minimaxQuotaLabel(modelId: string) {
  const normalized = modelId.trim();
  const lower = normalized.toLowerCase();
  switch (lower) {
    case "coding-plan-search":
      return "Coding Search";
    case "coding-plan-vlm":
      return "Coding Vision";
    case "minimax-m*":
      return "MiniMax M Series";
  }
  if (lower.startsWith("minimax-m")) {
    return normalized.replace(/-/g, " ");
  }
  return normalized;
}

function minimaxQuotaOrder(modelId: string) {
  const lower = modelId.trim().toLowerCase();
  if (lower === "minimax-m*") {
    return 0;
  }
  if (lower.startsWith("minimax-m")) {
    return 1;
  }
  if (lower === "coding-plan-search") {
    return 10;
  }
  if (lower === "coding-plan-vlm") {
    return 11;
  }
  return 99;
}
