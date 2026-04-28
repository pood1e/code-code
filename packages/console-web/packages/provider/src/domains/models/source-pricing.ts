import type { PricingSummary, PriceType } from "@code-code/agent-contract/platform/model/v1";

export type PricingDetailLine = {
  label: string;
  value: string;
};

export function formatSourcePricing(pricing?: PricingSummary) {
  const parts: string[] = [];
  const add = (label: string, raw: string, unit = "/M") => {
    const amount = parseSourcePricePerMillion(raw);
    if (amount === null) return;
    parts.push(`${label} ${currencySymbol(pricing)}${formatPerMillionAmount(amount)}${unit}`);
  };
  add("Input", pricing?.input || "");
  add("Output", pricing?.output || "");
  add("Reasoning", pricing?.reasoning || "");
  add("Cache Read", pricing?.cacheReadInput || "");
  add("Cache Write", pricing?.cacheWriteInput || "");
  add("Image In", pricing?.imageInput || "", "/img");
  add("Audio In", pricing?.audioInput || "");
  add("Audio Out", pricing?.audioOutput || "");
  add("Request", pricing?.request || "", "/req");
  return parts.join(" · ");
}

export function formatPricingDetail(pricing?: PricingSummary): PricingDetailLine[] {
  if (!pricing) return [];
  const lines: PricingDetailLine[] = [];
  const add = (label: string, raw: string, unit = "/M") => {
    const amount = parseSourcePricePerMillion(raw);
    if (amount === null) return;
    lines.push({ label, value: `${currencySymbol(pricing)}${formatPerMillionAmount(amount)}${unit}` });
  };
  add("Input", pricing.input);
  add("Output", pricing.output);
  add("Reasoning", pricing.reasoning);
  add("Cache Read", pricing.cacheReadInput);
  add("Cache Write", pricing.cacheWriteInput);
  add("Image Input", pricing.imageInput, "/img");
  add("Audio Input", pricing.audioInput);
  add("Audio Output", pricing.audioOutput);
  add("Request", pricing.request, "/req");
  return lines;
}

export function formatPriceType(priceType: PriceType): string {
  // PriceType enum values: UNSPECIFIED=0, VENDOR_PUBLIC=1, CLOUD_PUBLIC=2, AGENT_CONTRACT=3, INTERNAL_COST=4
  switch (priceType) {
    case 1:
      return "Vendor Public";
    case 2:
      return "Cloud Public";
    case 3:
      return "Agent Contract";
    case 4:
      return "Internal Cost";
    default:
      return "";
  }
}

function currencySymbol(pricing?: PricingSummary): string {
  const currency = pricing?.currency?.trim().toUpperCase();
  if (!currency || currency === "USD" || currency === "") return "$";
  if (currency === "EUR") return "€";
  if (currency === "GBP") return "£";
  if (currency === "CNY" || currency === "RMB") return "¥";
  return `${currency} `;
}

function parseSourcePricePerMillion(raw: string | undefined) {
  const normalized = (raw ?? "").trim();
  if (!normalized) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return value * 1_000_000;
}

function formatPerMillionAmount(value: number) {
  const maximumFractionDigits = value >= 100 ? 0 : value >= 1 ? 3 : 6;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}
