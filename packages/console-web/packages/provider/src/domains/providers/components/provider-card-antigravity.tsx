import type { ProviderModel } from "../provider-model";
import {
  normalizeMetricPercent,
  type ProviderOwnerObservabilityModel,
} from "../provider-owner-observability-model";
import { formatQuotaResetAtLocal } from "../provider-observability-time";
import type { ProviderCardRendererContext } from "../provider-card-registry";
import { ProviderQuotaCardFromPercentRows } from "./provider-quota-card";
import {
  appendNumericMetricRowsByDescriptor,
  type QuotaMetricDescriptor,
  readQuotaSummaryWithObservedAt,
} from "../provider-quota-metric-aggregation";
import { ProviderCardTitleSuffix } from "./provider-card-title-suffix";

type Props = ProviderCardRendererContext;

type AntigravityQuotaRow = {
  label: string;
  groupId: string;
  percent: number;
  resetAtLabel: string | null;
};

type AntigravityQuotaSummary = {
  tierLabel: string | null;
  updatedAtLabel: string | null;
  updatedAtTimestamp?: string | null;
  rows: readonly AntigravityQuotaRow[];
};

type AntigravityQuotaGroupState = {
  groupId: string;
  baseLabel: string;
  percent: number;
  resetAtSeconds: number | null;
};

const antigravityRemainingMetric = "gen_ai.provider.cli.oauth.antigravity.model.quota.remaining.fraction.percent";
const antigravityResetMetric = "gen_ai.provider.cli.oauth.antigravity.model.quota.reset.timestamp.seconds";

export function ProviderCardAntigravity({ providerViewModel, observability, observabilityError, isLoading, status }: Props) {
  const summary = readAntigravityQuotaSummary(providerViewModel, observability, new Date());

  return (
    <ProviderQuotaCardFromPercentRows
      loading={isLoading}
      error={observabilityError}
      summary={summary}
      status={status}
      getId={(row) => row.groupId}
      titleSuffix={<ProviderCardTitleSuffix tierLabel={summary?.tierLabel} />}
    />
  );
}

export function readAntigravityQuotaSummary(
  provider: ProviderModel,
  observability: ProviderOwnerObservabilityModel | null,
  now: Date = new Date(),
  timeZone?: string,
): AntigravityQuotaSummary | null {
  if (!observability) {
    return null;
  }
  const rows = buildAntigravityRows(observability, now, timeZone);
  const summary = readQuotaSummaryWithObservedAt(rows, observability, now, timeZone);
  if (summary == null) {
    return null;
  }
  return {
    tierLabel: provider.oauthFieldValue("tier"),
    rows: summary.rows,
    updatedAtLabel: summary.updatedAtLabel,
    updatedAtTimestamp: summary.updatedAtTimestamp,
  };
}

function buildAntigravityRows(
  observability: ProviderOwnerObservabilityModel,
  now: Date,
  timeZone?: string,
) {
  const groups = new Map<string, AntigravityQuotaGroupState>();
  appendNumericMetricRowsByDescriptor(
    groups,
    observability.metricRows(antigravityResetMetric),
    readAntigravityGroupDescriptor,
    createAntigravityGroupState,
    (state, resetAtSeconds) => {
      state.resetAtSeconds = earliestTimestamp(state.resetAtSeconds, resetAtSeconds);
    },
  );
  appendNumericMetricRowsByDescriptor(
    groups,
    observability.metricRows(antigravityRemainingMetric),
    readAntigravityGroupDescriptor,
    createAntigravityGroupState,
    (state, percent) => {
      state.percent = Math.min(state.percent, normalizeMetricPercent(percent));
    },
  );
  return Array.from(groups.values())
    .sort((left, right) => compareQuotaGroup(left.groupId, right.groupId, left.baseLabel, right.baseLabel))
    .map((row) => ({
      groupId: row.groupId,
      label: antigravityQuotaLabel(row.baseLabel, row.resetAtSeconds, now),
      percent: row.percent,
      resetAtLabel: formatQuotaResetAtLocal(row.resetAtSeconds, now, timeZone),
    }));
}

function readAntigravityGroupDescriptor(labels?: Record<string, string>): QuotaMetricDescriptor | null {
  const modelId = (labels?.model_id || "").trim();
  if (!modelId) {
    return null;
  }
  const group = antigravityQuotaGroup(modelId);
  return { id: group.groupId, label: group.baseLabel };
}

function createAntigravityGroupState(descriptor: QuotaMetricDescriptor): AntigravityQuotaGroupState {
  return {
    groupId: descriptor.id,
    baseLabel: descriptor.label,
    percent: 100,
    resetAtSeconds: null,
  };
}

function antigravityQuotaGroup(modelId: string) {
  const normalized = modelId.trim();
  const lower = normalized.toLowerCase();
  if (lower.startsWith("claude")) {
    return { groupId: "claude-openai", baseLabel: "Claude / OpenAI" };
  }
  if (lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("o4")) {
    return { groupId: "claude-openai", baseLabel: "Claude / OpenAI" };
  }
  if (lower.startsWith("image") || lower.startsWith("imagen")) {
    return { groupId: "gemini-flash", baseLabel: "Gemini Flash" };
  }
  if (lower.startsWith("gemini")) {
    if (lower.includes("flash") || lower.includes("image")) {
      return { groupId: "gemini-flash", baseLabel: "Gemini Flash" };
    }
    if (lower.includes("pro")) {
      return { groupId: "gemini-pro", baseLabel: "Gemini Pro" };
    }
    return { groupId: "gemini", baseLabel: "Gemini" };
  }
  return { groupId: "other", baseLabel: "Other" };
}

function compareQuotaGroup(leftId: string, rightId: string, leftLabel: string, rightLabel: string) {
  const leftOrder = quotaGroupOrder(leftId);
  const rightOrder = quotaGroupOrder(rightId);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return leftLabel.localeCompare(rightLabel);
}

function quotaGroupOrder(groupId: string) {
  switch (groupId) {
    case "gemini-pro":
      return 0;
    case "gemini-flash":
      return 1;
    case "claude-openai":
      return 2;
    case "gemini":
      return 3;
    default:
      return 99;
  }
}

function earliestTimestamp(left: number | null, right: number | null) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return Math.min(left, right);
}

function antigravityQuotaLabel(baseLabel: string, resetAtSeconds: number | null, now: Date) {
  const cadence = antigravityQuotaCadenceLabel(resetAtSeconds, now);
  return cadence ? `${baseLabel} · ${cadence}` : baseLabel;
}

function antigravityQuotaCadenceLabel(resetAtSeconds: number | null, now: Date) {
  if (!resetAtSeconds || !Number.isFinite(resetAtSeconds)) {
    return "";
  }
  const remainingHours = (resetAtSeconds * 1000 - now.getTime()) / (60 * 60 * 1000);
  if (remainingHours <= 0) {
    return "";
  }
  if (remainingHours <= 8) {
    return "5h";
  }
  if (remainingHours <= 36) {
    return "1d";
  }
  if (remainingHours <= 96) {
    return "3d";
  }
  if (remainingHours <= 9 * 24) {
    return "7d";
  }
  return "";
}
