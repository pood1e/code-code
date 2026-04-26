import { readQuotaSummaryWithObservedAt, type QuotaCardSummary } from "../provider-quota-metric-aggregation";
import type { ProviderOwnerObservabilityModel } from "../provider-owner-observability-model";
import { resolveCerebrasQuotaRows } from "./provider-card-cerebras-rows";

export type CerebrasQuotaSummaryRow = {
  id: string;
  label: string;
  remaining: number | null;
  limit: number | null;
  progressPercent: number | null;
  subtle?: boolean;
};

export type CerebrasQuotaSummary = QuotaCardSummary<CerebrasQuotaSummaryRow>;

export type CerebrasQuotaOrganization = {
  id: string;
  label: string;
};

const cerebrasCardDescriptors = [
  { id: "day:tokens", window: "day", resource: "tokens", label: "Day tokens" },
  { id: "day:requests", window: "day", resource: "requests", label: "Day requests" },
  { id: "hour:tokens", window: "hour", resource: "tokens", label: "Hour tokens" },
] as const;
const cerebrasLimitMetric = "gen_ai.provider.quota.limit";

export function listCerebrasQuotaOrganizations(observability: ProviderOwnerObservabilityModel | null) {
  if (!observability) {
    return [];
  }
  const rows = observability.metricRows(cerebrasLimitMetric);
  const optionsByID = new Map<string, CerebrasQuotaOrganization>();
  for (const row of rows) {
    const orgID = (row.labels?.org_id || "").trim();
    const orgName = (row.labels?.org_name || "").trim();
    if (!orgID) {
      continue;
    }
    optionsByID.set(orgID, {
      id: orgID,
      label: orgName || orgID,
    });
  }
  return Array.from(optionsByID.values()).sort((left, right) => {
    if (left.label === "Personal" && right.label !== "Personal") {
      return -1;
    }
    if (right.label === "Personal" && left.label !== "Personal") {
      return 1;
    }
    return left.label.localeCompare(right.label);
  });
}

export function readCerebrasQuotaSummary(
  observability: ProviderOwnerObservabilityModel | null,
  orgID: string,
  now: Date = new Date(),
  timeZone?: string,
): CerebrasQuotaSummary | null {
  if (!observability) {
    return null;
  }
  const normalizedOrgID = orgID.trim();
  if (!normalizedOrgID) {
    return null;
  }
  const rows = resolveCerebrasQuotaRows(observability, normalizedOrgID, cerebrasCardDescriptors);
  return readQuotaSummaryWithObservedAt(rows, observability, now, timeZone);
}
