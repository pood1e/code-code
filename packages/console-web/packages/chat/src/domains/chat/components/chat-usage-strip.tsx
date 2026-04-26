import type { ChatProjectionState } from "../projection";

type ChatUsageStripProps = {
  usage?: ChatProjectionState["usage"];
};

export function ChatUsageStrip({ usage }: ChatUsageStripProps) {
  const items = usageItems(usage);
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="chatUsageStrip">
      {items.map((item) => (
        <span key={item.label} className="chatUsageChip">
          {item.label}
        </span>
      ))}
    </div>
  );
}

function usageItems(usage: ChatProjectionState["usage"]) {
  if (!usage) {
    return [];
  }
  return [
    usage.modelId ? { label: `Model ${usage.modelId}` } : null,
    metricBadge("In", usage.inputTokens),
    metricBadge("Out", usage.outputTokens),
  ].filter((item): item is { label: string } => Boolean(item));
}

function metricBadge(label: string, value: number | undefined) {
  if (typeof value !== "number" || value <= 0) {
    return null;
  }
  return { label: `${label} ${formatCount(value)}` };
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { notation: value >= 1000 ? "compact" : "standard" }).format(value);
}
