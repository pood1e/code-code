import {
  normalizeMetricPercent,
  type ProviderOwnerObservabilityModel,
} from "../provider-owner-observability-model";
import type { ProviderCardRendererContext } from "../provider-card-registry";
import { ProviderQuotaCardFromPercentRows } from "./provider-quota-card";
import {
  readQuotaPercentWindowSummary,
  type QuotaPercentWindowSummary,
  type QuotaPercentWindowMetricDescriptor,
} from "../provider-quota-metric-aggregation";
import { providerHasPrimaryModelID } from "../provider-card-model-support";
import { ProviderCardTitleSuffix } from "./provider-card-title-suffix";

type Props = ProviderCardRendererContext;

type CodexQuotaSummary = QuotaPercentWindowSummary & {
  blocked: boolean;
  tierLabel: string | null;
};

const codexLimitReachedMetric = "gen_ai.provider.cli.oauth.codex.limit.reached";
const codexPrimaryWindowMetric = "gen_ai.provider.cli.oauth.codex.primary.window.used.percent";
const codexPrimaryWindowResetMetric = "gen_ai.provider.cli.oauth.codex.primary.window.reset.timestamp.seconds";
const codexSecondaryWindowMetric = "gen_ai.provider.cli.oauth.codex.secondary.window.used.percent";
const codexSecondaryWindowResetMetric = "gen_ai.provider.cli.oauth.codex.secondary.window.reset.timestamp.seconds";
const codexPlanTypeCodeMetric = "gen_ai.provider.cli.oauth.codex.plan.type.code";

const codexWindowPercentMetrics: readonly QuotaPercentWindowMetricDescriptor[] = [
  {
    label: "5h",
    percentMetric: codexPrimaryWindowMetric,
    resetMetric: codexPrimaryWindowResetMetric,
  },
  {
    label: "7d",
    percentMetric: codexSecondaryWindowMetric,
    resetMetric: codexSecondaryWindowResetMetric,
  },
];

export function ProviderCardCodex({ providerViewModel, observability, observabilityError, isLoading, status }: Props) {
  const summary = readCodexQuotaSummary(observability, new Date());
  const featureLabels = readCodexFeatureLabels(providerViewModel);

  return (
    <ProviderQuotaCardFromPercentRows
      loading={isLoading}
      error={observabilityError}
      summary={summary}
      status={status}
      loadingLines={[
        { height: "12px", width: "72px" },
        { height: "10px", mt: "2" },
        { height: "12px", width: "72px", mt: "3" },
        { height: "10px", mt: "2" },
      ]}
      titleSuffix={
        <ProviderCardTitleSuffix
          tierLabel={summary?.tierLabel}
          blocked={summary?.blocked}
          labels={featureLabels}
        />
      }
    />
  );
}

export function readCodexQuotaSummary(
  observability: ProviderOwnerObservabilityModel | null,
  now: Date = new Date(),
  timeZone?: string,
): CodexQuotaSummary | null {
  if (observability == null) {
    return null;
  }
  const blockedMetricValue = readMetricValue(observability, codexLimitReachedMetric);
  const blocked = (blockedMetricValue || 0) > 0;
  const tierCode = observability.metricValue(codexPlanTypeCodeMetric);
  const summary = readQuotaPercentWindowSummary(
    observability,
    codexWindowPercentMetrics,
    now,
    timeZone,
    (value) => normalizeMetricPercent(100 - value),
  );
  if (summary == null) {
    return null;
  }
  return {
    ...summary,
    blocked,
    tierLabel: codexTierLabel(tierCode),
  };
}

export function readCodexFeatureLabels(provider: Props["providerViewModel"]) {
  return providerHasPrimaryModelID(provider, "gpt-5.3-codex-spark")
    ? ["gpt-5.3-codex-spark"]
    : [];
}

function readMetricValue(observability: ProviderOwnerObservabilityModel, metricName: string) {
  const value = observability.metricValue(metricName);
  return typeof value === "number" ? normalizeMetricPercent(value) : null;
}

function codexTierLabel(value: number | null) {
  switch (Math.round(value || 0)) {
    case 1:
      return "Guest";
    case 2:
      return "Free";
    case 3:
      return "Go";
    case 4:
      return "Plus";
    case 5:
      return "Pro";
    case 6:
      return "Pro Lite";
    case 7:
      return "Free Workspace";
    case 8:
      return "Team";
    case 9:
      return "Business Usage";
    case 10:
      return "Business";
    case 11:
      return "Enterprise Usage";
    case 12:
      return "Education";
    case 13:
      return "Quorum";
    case 14:
      return "K12";
    case 15:
      return "Enterprise";
    case 16:
      return "Edu";
    default:
      return null;
  }
}
