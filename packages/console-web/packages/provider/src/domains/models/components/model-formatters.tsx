import type { ModelVersion, ContextSpec } from "@code-code/agent-contract/model/v1";

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

export function getVendorLabel(model: ModelVersion) {
  return model.vendorId || "Unspecified";
}

export function formatDate(iso: string): string {
  if (!iso || !iso.trim()) return "";
  // ISO 8601 date strings like "2024-10-22"
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type ContextBreakdownLine = {
  label: string;
  value: string;
};

export function formatContextBreakdown(spec?: ContextSpec): ContextBreakdownLine[] {
  if (!spec) return [];
  const lines: ContextBreakdownLine[] = [];
  const add = (label: string, tokens?: bigint) => {
    if (tokens && tokens !== 0n) {
      lines.push({ label, value: formatTokenSize(tokens) });
    }
  };
  add("Max Input Tokens", spec.maxInputTokens);
  add("Max Output Tokens", spec.maxOutputTokens);
  add("Max Context Window", spec.maxContextTokens);
  add("Max Reasoning Tokens", spec.maxReasoningTokens);
  if (spec.tokenizer) {
    lines.push({ label: "Tokenizer", value: spec.tokenizer });
  }
  return lines;
}
