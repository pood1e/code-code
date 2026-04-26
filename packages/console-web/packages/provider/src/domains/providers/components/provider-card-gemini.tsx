import type { ProviderModel } from "../provider-model";
import { normalizeMetricPercent, type ProviderOwnerObservabilityModel } from "../provider-owner-observability-model";
import type { ProviderCardRendererContext } from "../provider-card-registry";
import { ProviderQuotaCardFromPercentRows } from "./provider-quota-card";
import {
  readQuotaPercentWindowSummary,
  type QuotaPercentWindowSummary,
  type QuotaPercentWindowMetricDescriptor,
} from "../provider-quota-metric-aggregation";
import { ProviderCardTitleSuffix } from "./provider-card-title-suffix";

type Props = ProviderCardRendererContext;

type GeminiQuotaSummary = QuotaPercentWindowSummary & {
  tierLabel: string | null;
};

type GeminiQuotaGroupDefinition = QuotaPercentWindowMetricDescriptor & {
  amountMetric: string;
};

const geminiMetricRows: readonly GeminiQuotaGroupDefinition[] = [
  {
    label: "Pro",
    amountMetric: "gen_ai.provider.cli.oauth.gemini.pro.remaining.amount",
    percentMetric: "gen_ai.provider.cli.oauth.gemini.pro.remaining.fraction.percent",
    resetMetric: "gen_ai.provider.cli.oauth.gemini.pro.reset.timestamp.seconds",
  },
  {
    label: "Flash",
    amountMetric: "gen_ai.provider.cli.oauth.gemini.flash.remaining.amount",
    percentMetric: "gen_ai.provider.cli.oauth.gemini.flash.remaining.fraction.percent",
    resetMetric: "gen_ai.provider.cli.oauth.gemini.flash.reset.timestamp.seconds",
  },
  {
    label: "Flash Lite",
    amountMetric: "gen_ai.provider.cli.oauth.gemini.flash.lite.remaining.amount",
    percentMetric: "gen_ai.provider.cli.oauth.gemini.flash.lite.remaining.fraction.percent",
    resetMetric: "gen_ai.provider.cli.oauth.gemini.flash.lite.reset.timestamp.seconds",
  },
] as const;

export function ProviderCardGemini({ providerViewModel, observability, observabilityError, isLoading, status }: Props) {
  const summary = readGeminiQuotaSummary(providerViewModel, observability, new Date());

  return (
    <ProviderQuotaCardFromPercentRows
      loading={isLoading}
      error={observabilityError}
      summary={summary}
      status={status}
      titleSuffix={<ProviderCardTitleSuffix tierLabel={summary?.tierLabel} />}
    />
  );
}

export function readGeminiQuotaSummary(
  provider: ProviderModel,
  observability: ProviderOwnerObservabilityModel | null,
  now: Date = new Date(),
  timeZone?: string,
): GeminiQuotaSummary | null {
  if (observability == null) {
    return null;
  }
  const visibleMetricRows = geminiMetricRows.filter((row) => geminiQuotaGroupVisible(observability, row));
  const summary = readQuotaPercentWindowSummary(
    observability,
    visibleMetricRows,
    now,
    timeZone,
    normalizeMetricPercent,
  );
  if (summary == null) {
    return null;
  }
  return {
    tierLabel: geminiTierLabel(provider.oauthFieldValue("tier")),
    ...summary,
  };
}

function geminiQuotaGroupVisible(
  observability: ProviderOwnerObservabilityModel,
  group: GeminiQuotaGroupDefinition,
) {
  const resetAt = observability.metricValue(group.resetMetric) || 0;
  if (resetAt > 0) {
    return true;
  }
  const remainingAmount = observability.metricValue(group.amountMetric) || 0;
  if (remainingAmount > 0) {
    return true;
  }
  const remainingPercent = observability.metricValue(group.percentMetric) || 0;
  return remainingPercent > 0;
}

function geminiTierLabel(value: string | null) {
  const normalized = value?.trim() || "";
  const lower = normalized.toLowerCase();
  switch (lower) {
    case "gemini code assist for individuals":
      return "Free";
    case "google ai pro":
      return "Pro";
    case "google ai ultra":
      return "Ultra";
    case "gemini code assist standard":
      return "Standard";
    case "gemini code assist enterprise":
      return "Enterprise";
  }
  if (lower.startsWith("google ai ")) {
    return normalized.slice("Google AI ".length).trim() || normalized;
  }
  if (lower.startsWith("gemini code assist ")) {
    return normalized.slice("Gemini Code Assist ".length).trim() || normalized;
  }
  return normalized || null;
}
