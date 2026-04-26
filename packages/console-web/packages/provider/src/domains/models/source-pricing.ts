import type { RegistryModelPricing } from "@code-code/agent-contract/platform/model/v1";

export function formatSourcePricing(pricing?: RegistryModelPricing) {
  const parts: string[] = [];
  const input = formatSourcePrice(pricing?.input || "");
  const output = formatSourcePrice(pricing?.output || "");
  const cacheReadInput = formatSourcePrice(pricing?.cacheReadInput || "");
  const cacheWriteInput = formatSourcePrice(pricing?.cacheWriteInput || "");
  if (input) {
    parts.push(`Input ${input}`);
  }
  if (output) {
    parts.push(`Output ${output}`);
  }
  if (cacheReadInput) {
    parts.push(`Cache Read ${cacheReadInput}`);
  }
  if (cacheWriteInput) {
    parts.push(`Cache Write ${cacheWriteInput}`);
  }
  return parts.join(" · ");
}

function formatSourcePrice(raw: string) {
  const amount = parseSourcePricePerMillion(raw);
  if (amount === null) {
    return "";
  }
  return `$${formatPerMillionAmount(amount)}/M`;
}

function parseSourcePricePerMillion(raw: string) {
  const normalized = raw.trim();
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
