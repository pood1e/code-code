import { normalizeMetricPercent, type ProviderOwnerObservabilityModel } from "../provider-owner-observability-model";

type CerebrasCardDescriptor = {
  id: string;
  window: string;
  resource: string;
  label: string;
};

type MutableCerebrasQuotaCandidate = {
  descriptorId: string;
  descriptorLabel: string;
  modelID: string;
  descriptorOrder: number;
  remaining: number | null;
  limit: number | null;
};

type CerebrasQuotaRow = {
  id: string;
  label: string;
  remaining: number | null;
  limit: number | null;
  progressPercent: number | null;
  subtle?: boolean;
};

type CerebrasResolvedQuotaRow = CerebrasQuotaRow & {
  modelID: string;
  descriptorOrder: number;
};

const cerebrasRemainingMetric = "gen_ai.provider.quota.remaining";
const cerebrasLimitMetric = "gen_ai.provider.quota.limit";
const maxDescriptorRows = 3;
const maxSummaryRows = 6;

export function resolveCerebrasQuotaRows(
  observability: ProviderOwnerObservabilityModel,
  orgID: string,
  descriptors: readonly CerebrasCardDescriptor[],
) {
  const primaryRows = groupRowsByModel(
    descriptors.slice(0, 2).flatMap((descriptor, descriptorOrder) =>
      resolveDescriptorRows(observability, orgID, descriptor, descriptorOrder),
    ),
  );
  if (primaryRows.length > 0) {
    return primaryRows.slice(0, maxSummaryRows);
  }
  for (const descriptor of descriptors.slice(2)) {
    const rows = resolveDescriptorRows(observability, orgID, descriptor, 0);
    if (rows.length > 0) {
      return rows.slice(0, maxSummaryRows);
    }
  }
  return [];
}

function groupRowsByModel(rows: readonly CerebrasResolvedQuotaRow[]) {
  const groups = new Map<string, CerebrasResolvedQuotaRow[]>();
  for (const row of rows) {
    const current = groups.get(row.modelID) || [];
    current.push(row);
    groups.set(row.modelID, current);
  }
  return Array.from(groups.entries())
    .sort((left, right) => resolveGroupRank(left[1]) - resolveGroupRank(right[1]) || left[0].localeCompare(right[0]))
    .flatMap(([, groupRows]) =>
      groupRows
        .slice()
        .sort((left, right) => left.descriptorOrder - right.descriptorOrder)
        .map(({ modelID: _modelID, descriptorOrder: _descriptorOrder, ...row }) => row),
    );
}

function resolveDescriptorRows(
  observability: ProviderOwnerObservabilityModel,
  orgID: string,
  descriptor: CerebrasCardDescriptor,
  descriptorOrder: number,
) {
  const candidatesByKey = new Map<string, MutableCerebrasQuotaCandidate>();
  for (const metricRow of observability.metricRows(cerebrasRemainingMetric, {
    org_id: orgID,
    window: descriptor.window,
    resource: descriptor.resource,
  })) {
    const candidate = readQuotaCandidate(candidatesByKey, descriptor, descriptorOrder, metricRow.labels);
    if (!candidate || typeof metricRow.value !== "number") {
      continue;
    }
    candidate.remaining = metricRow.value;
  }
  for (const metricRow of observability.metricRows(cerebrasLimitMetric, {
    org_id: orgID,
    window: descriptor.window,
    resource: descriptor.resource,
  })) {
    const candidate = readQuotaCandidate(candidatesByKey, descriptor, descriptorOrder, metricRow.labels);
    if (!candidate || typeof metricRow.value !== "number") {
      continue;
    }
    candidate.limit = metricRow.value;
  }
  return Array.from(candidatesByKey.values())
    .filter((candidate) => candidate.remaining !== null || candidate.limit !== null)
    .sort((left, right) => resolveCandidateRank(left) - resolveCandidateRank(right) || left.modelID.localeCompare(right.modelID))
    .slice(0, maxDescriptorRows)
    .map((candidate) => ({
      id: `${candidate.descriptorId}:${candidate.modelID}`,
      label: formatDescriptorRowLabel(candidate.modelID, candidate.descriptorLabel),
      modelID: candidate.modelID,
      descriptorOrder: candidate.descriptorOrder,
      remaining: candidate.remaining,
      limit: candidate.limit,
      progressPercent: resolveRemainingPercent(candidate.remaining, candidate.limit),
      subtle: descriptorLabelIsSecondary(candidate.descriptorLabel),
    }));
}

function readQuotaCandidate(
  candidatesByKey: Map<string, MutableCerebrasQuotaCandidate>,
  descriptor: CerebrasCardDescriptor,
  descriptorOrder: number,
  labels?: Record<string, string>,
) {
  const modelID = (labels?.model_id || "").trim();
  if (!modelID) {
    return null;
  }
  const key = `${descriptor.id}:${modelID}`;
  const current = candidatesByKey.get(key);
  if (current) {
    return current;
  }
  const next = {
    descriptorId: descriptor.id,
    descriptorLabel: descriptor.label,
    modelID,
    descriptorOrder,
    remaining: null,
    limit: null,
  };
  candidatesByKey.set(key, next);
  return next;
}

function resolveGroupRank(rows: readonly CerebrasResolvedQuotaRow[]) {
  return rows.reduce((current, row) => Math.min(current, resolveRowRank(row)), Number.POSITIVE_INFINITY);
}

function resolveRowRank(row: { progressPercent: number | null; descriptorOrder: number }) {
  const rank = row.progressPercent ?? Number.POSITIVE_INFINITY;
  return rank + row.descriptorOrder / 1000;
}

function resolveCandidateRank(candidate: MutableCerebrasQuotaCandidate) {
  const remainingPercent = resolveRemainingPercent(candidate.remaining, candidate.limit);
  if (remainingPercent === null) {
    return Number.POSITIVE_INFINITY;
  }
  return remainingPercent;
}

function formatDescriptorRowLabel(modelID: string, descriptorLabel: string) {
  if (descriptorLabel === "Day tokens") {
    return `${modelID} · tokens`;
  }
  if (descriptorLabel === "Day requests") {
    return `${modelID} · requests`;
  }
  return `${modelID} · ${descriptorLabel}`;
}

function descriptorLabelIsSecondary(descriptorLabel: string) {
  return descriptorLabel !== "Day tokens";
}

function resolveRemainingPercent(remaining: number | null, limit: number | null) {
  if (typeof remaining !== "number" || typeof limit !== "number" || limit <= 0) {
    return null;
  }
  if (!Number.isFinite(remaining) || !Number.isFinite(limit)) {
    return null;
  }
  return normalizeMetricPercent(remaining / limit * 100);
}
