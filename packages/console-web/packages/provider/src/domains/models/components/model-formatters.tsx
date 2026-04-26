import type { ModelDefinition } from "@code-code/agent-contract/model/v1";

export function formatTokenSize(tokens?: bigint): string {
  if (!tokens || tokens === 0n) {
    return "Unknown";
  }
  const value = Number(tokens);
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

export function getVendorLabel(model: ModelDefinition) {
  return model.vendorId || "Unspecified";
}
