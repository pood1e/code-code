import type { ProviderOwnerObservabilityModel, ProviderRuntimeMetricRow } from "../provider-owner-observability-model";
import { formatQuotaResetAtLocal } from "../provider-observability-time";
import { readQuotaSummaryWithObservedAt, type ProviderQuotaCardRow } from "../provider-quota-metric-aggregation";
import { formatQuotaAmount } from "../provider-quota-presentation";

export type GoogleAIStudioQuotaSummary = {
  tierLabel: string | null;
  updatedAtLabel: string | null;
  updatedAtTimestamp?: string | null;
  rows: readonly ProviderQuotaCardRow[];
};

type MutableGoogleAIStudioQuotaRow = {
  id: string;
  modelId: string;
  modelCategory: string;
  modelLabel: string;
  quotaType: string;
  quotaLabel: string;
  quotaOrder: number;
  value: number;
  remainingValue: number | null;
  resetAtSeconds: number | null;
};

const googleAIStudioQuotaLimitMetric = "gen_ai.provider.quota.limit";
const googleAIStudioQuotaRemainingMetric = "gen_ai.provider.quota.remaining";
const googleAIStudioQuotaResetTimestampMetric = "gen_ai.provider.quota.reset.timestamp.seconds";
const googleAIStudioSupportedModelCategories = new Set(["text_output", "gemma"]);
const googleAIStudioVisibleQuotaTypes = new Set(["RPD"]);
const googleAIStudioMaxVisibleRows = 5;

export function readGoogleAIStudioQuotaSummary(
  observability: ProviderOwnerObservabilityModel | null,
  now: Date = new Date(),
  timeZone?: string,
): GoogleAIStudioQuotaSummary | null {
  if (!observability) {
    return null;
  }
  const rows = readGoogleAIStudioQuotaRows(observability, now, timeZone);
  const summary = readQuotaSummaryWithObservedAt(rows, observability, now, timeZone);
  if (summary == null) {
    return null;
  }
  return {
    tierLabel: null,
    rows: summary.rows,
    updatedAtLabel: summary.updatedAtLabel,
    updatedAtTimestamp: summary.updatedAtTimestamp,
  };
}

function readGoogleAIStudioQuotaRows(
  observability: ProviderOwnerObservabilityModel,
  now: Date,
  timeZone?: string,
): ProviderQuotaCardRow[] {
  const rowsByID = new Map<string, MutableGoogleAIStudioQuotaRow>();
  const resetAtByID = readGoogleAIStudioResetAtByID(observability);
  const remainingByID = readGoogleAIStudioRemainingByID(observability);
  for (const metricRow of observability.metricRows(googleAIStudioQuotaLimitMetric)) {
    if (typeof metricRow.value !== "number" || !Number.isFinite(metricRow.value) || metricRow.value <= 0) {
      continue;
    }
    const descriptor = googleAIStudioQuotaDescriptor(metricRow);
    if (!descriptor) {
      continue;
    }
    const row = {
      ...descriptor,
      resetAtSeconds: resetAtByID.get(descriptor.id) ?? null,
      remainingValue: remainingByID.get(descriptor.id) ?? null,
    };
    const existing = rowsByID.get(row.id);
    if (!existing || row.value > existing.value) {
      rowsByID.set(row.id, row);
    }
  }
  const sortedRows = Array.from(rowsByID.values()).sort(compareGoogleAIStudioQuotaRows);
  const visibleRows = sortedRows
    .filter((row) => googleAIStudioVisibleQuotaTypes.has(row.quotaType))
    .slice(0, googleAIStudioMaxVisibleRows);
  let previousModelID = "";
  return visibleRows.map((row) => {
    const subtle = previousModelID === row.modelId;
    previousModelID = row.modelId;
    const resetAtLabel = formatQuotaResetAtLocal(row.resetAtSeconds, now, timeZone);
    const progressPercent = resolveGoogleAIStudioRemainingPercent(row.remainingValue, row.value);
    const valueLabel = resolveGoogleAIStudioQuotaValueLabel(row.remainingValue, row.value);
    return {
      id: row.id,
      label: `${row.modelLabel} · ${row.quotaLabel}`,
      value: valueLabel,
      ...(typeof progressPercent === "number" ? { progressPercent } : {}),
      ...(typeof progressPercent === "number" ? {} : { progressUnavailableLabel: "limit only" }),
      ...(resetAtLabel ? { resetAtLabel } : {}),
      subtle,
    };
  });
}

function googleAIStudioQuotaDescriptor(metricRow: ProviderRuntimeMetricRow): MutableGoogleAIStudioQuotaRow | null {
  const labels = metricRow.labels;
  if (!isGoogleAIStudioTextOutputMetric(labels)) {
    return null;
  }
  const modelId = normalizeModelID(labels?.model_id);
  const quotaLabel = normalizeQuotaLabel(labels);
  const resource = (labels?.resource || "").trim().toLowerCase();
  const window = (labels?.window || "").trim().toLowerCase();
  const quotaType = normalizeQuotaType(labels?.quota_type, resource, window);
  const id = [modelId, quotaType, resource, window].filter(Boolean).join(":");
  if (!id) {
    return null;
  }
  return {
    id,
    modelId,
    modelCategory: normalizeModelCategory(labels?.model_category),
    modelLabel: quotaModelLabel(modelId, labels?.preview),
    quotaType,
    quotaLabel,
    quotaOrder: quotaLabelOrder(quotaType || quotaLabel),
    value: metricRow.value || 0,
    remainingValue: null,
    resetAtSeconds: null,
  };
}

function compareGoogleAIStudioQuotaRows(left: MutableGoogleAIStudioQuotaRow, right: MutableGoogleAIStudioQuotaRow) {
  if (left.modelCategory !== right.modelCategory) {
    return googleAIStudioModelCategoryOrder(left.modelCategory) - googleAIStudioModelCategoryOrder(right.modelCategory);
  }
  if (left.modelId !== right.modelId) {
    return left.modelId.localeCompare(right.modelId);
  }
  if (left.quotaOrder !== right.quotaOrder) {
    return left.quotaOrder - right.quotaOrder;
  }
  return left.quotaLabel.localeCompare(right.quotaLabel);
}

function normalizeModelID(value: string | undefined) {
  const normalized = (value || "").trim();
  if (!normalized) {
    return "Unknown";
  }
  if (normalized.startsWith("models/")) {
    return normalized.slice("models/".length).trim() || "Unknown";
  }
  return normalized;
}

function quotaModelLabel(modelId: string, previewRaw: string | undefined) {
  const preview = (previewRaw || "").trim().toLowerCase() === "true";
  if (preview) {
    return `${modelId} (Preview)`;
  }
  return modelId;
}

function normalizeQuotaLabel(labels: Record<string, string> | undefined) {
  const quotaType = normalizeQuotaType(labels?.quota_type, labels?.resource, labels?.window);
  if (quotaType) {
    return quotaType;
  }
  const resource = (labels?.resource || "").trim();
  const window = (labels?.window || "").trim();
  if (resource && window) {
    return `${capitalize(resource)}/${capitalize(window)}`;
  }
  if (resource) {
    return capitalize(resource);
  }
  if (window) {
    return capitalize(window);
  }
  return "Limit";
}

function normalizeQuotaType(
  quotaTypeRaw: string | undefined,
  resourceRaw: string | undefined,
  windowRaw: string | undefined,
) {
  const quotaType = (quotaTypeRaw || "").trim().toUpperCase();
  if (quotaType) {
    return quotaType;
  }
  const resource = (resourceRaw || "").trim().toLowerCase();
  const window = (windowRaw || "").trim().toLowerCase();
  switch (`${resource}:${window}`) {
    case "requests:minute":
      return "RPM";
    case "tokens:minute":
      return "TPM";
    case "requests:day":
      return "RPD";
    case "tokens:day":
      return "TPD";
    case "images:minute":
      return "IPM";
    case "images:day":
      return "IPD";
    case "videos:minute":
      return "VPM";
    case "videos:day":
      return "VPD";
    default:
      return "";
  }
}

function readGoogleAIStudioResetAtByID(observability: ProviderOwnerObservabilityModel) {
  const resetAtByID = new Map<string, number>();
  for (const metricRow of observability.metricRows(googleAIStudioQuotaResetTimestampMetric)) {
    if (typeof metricRow.value !== "number" || !Number.isFinite(metricRow.value) || metricRow.value <= 0) {
      continue;
    }
    const labels = metricRow.labels;
    if (!isGoogleAIStudioTextOutputMetric(labels)) {
      continue;
    }
    const modelId = normalizeModelID(labels?.model_id);
    const resource = (labels?.resource || "").trim().toLowerCase();
    const window = (labels?.window || "").trim().toLowerCase();
    const quotaType = normalizeQuotaType(labels?.quota_type, resource, window);
    const id = [modelId, quotaType, resource, window].filter(Boolean).join(":");
    if (!id) {
      continue;
    }
    const current = resetAtByID.get(id);
    if (typeof current !== "number" || metricRow.value < current) {
      resetAtByID.set(id, metricRow.value);
    }
  }
  return resetAtByID;
}

function readGoogleAIStudioRemainingByID(observability: ProviderOwnerObservabilityModel) {
  const remainingByID = new Map<string, number>();
  for (const metricRow of observability.metricRows(googleAIStudioQuotaRemainingMetric)) {
    if (typeof metricRow.value !== "number" || !Number.isFinite(metricRow.value) || metricRow.value < 0) {
      continue;
    }
    const labels = metricRow.labels;
    if (!isGoogleAIStudioTextOutputMetric(labels)) {
      continue;
    }
    const modelId = normalizeModelID(labels?.model_id);
    const resource = (labels?.resource || "").trim().toLowerCase();
    const window = (labels?.window || "").trim().toLowerCase();
    const quotaType = normalizeQuotaType(labels?.quota_type, resource, window);
    const id = [modelId, quotaType, resource, window].filter(Boolean).join(":");
    if (!id) {
      continue;
    }
    const current = remainingByID.get(id);
    if (typeof current !== "number" || metricRow.value > current) {
      remainingByID.set(id, metricRow.value);
    }
  }
  return remainingByID;
}

function isGoogleAIStudioTextOutputMetric(labels: Record<string, string> | undefined) {
  return googleAIStudioSupportedModelCategories.has((labels?.model_category || "").trim().toLowerCase());
}

function normalizeModelCategory(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

function googleAIStudioModelCategoryOrder(value: string) {
  switch (value) {
    case "text_output":
      return 0;
    case "gemma":
      return 1;
    default:
      return 99;
  }
}

function resolveGoogleAIStudioQuotaValueLabel(remainingValue: number | null, limitValue: number) {
  if (typeof remainingValue === "number" && Number.isFinite(remainingValue) && remainingValue >= 0) {
    return `${formatQuotaAmount(remainingValue)} / ${formatQuotaAmount(limitValue)}`;
  }
  return formatQuotaAmount(limitValue);
}

function resolveGoogleAIStudioRemainingPercent(remainingValue: number | null, limitValue: number) {
  if (
    typeof remainingValue !== "number" ||
    !Number.isFinite(remainingValue) ||
    !Number.isFinite(limitValue) ||
    limitValue <= 0
  ) {
    return null;
  }
  return Math.max(0, Math.min(100, (remainingValue / limitValue) * 100));
}

function quotaLabelOrder(value: string) {
  switch (value.toUpperCase()) {
    case "RPM":
      return 0;
    case "TPM":
      return 1;
    case "RPD":
      return 2;
    case "TPD":
      return 3;
    case "IPM":
      return 4;
    case "IPD":
      return 5;
    case "VPM":
      return 6;
    case "VPD":
      return 7;
    default:
      return 99;
  }
}

function capitalize(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}
