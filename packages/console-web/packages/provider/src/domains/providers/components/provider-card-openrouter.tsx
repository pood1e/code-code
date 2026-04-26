import { ProviderQuotaCard, type ProviderQuotaCardRow } from "./provider-quota-card";
import { readOpenRouterQuotaSummary } from "./provider-card-openrouter-summary";
import type { ProviderCardRendererContext } from "../provider-card-registry";
import { formatQuotaAmount } from "../provider-quota-presentation";

type Props = ProviderCardRendererContext;

export function ProviderCardOpenRouter({ observability, observabilityError, isLoading, status }: Props) {
  const summary = readOpenRouterQuotaSummary(observability, new Date());
  
  const rows: ProviderQuotaCardRow[] = [];
  if (summary) {
    for (const row of summary.rows) {
      rows.push({
        id: `${row.modelId}-cost`,
        label: row.label,
        value: `$${(row.costUsd || 0).toFixed(4)}`,
      });
      if (typeof row.requestsCount === "number") {
        rows.push({
          id: `${row.modelId}-req`,
          label: "Requests",
          value: formatQuotaAmount(row.requestsCount),
          subtle: true,
        });
      }
      if (typeof row.inputTokens === "number" || typeof row.outputTokens === "number") {
        rows.push({
          id: `${row.modelId}-tokens`,
          label: "Tokens (Input / Output)",
          value: `${formatQuotaAmount(row.inputTokens || 0)} / ${formatQuotaAmount(row.outputTokens || 0)}`,
          subtle: true,
        });
      }
    }
  }

  return (
    <ProviderQuotaCard
      loading={isLoading}
      error={observabilityError}
      rows={rows}
      status={status}
      updatedAtLabel={summary?.updatedAtLabel}
      updatedAtTimestamp={summary?.updatedAtTimestamp}
      titleSuffix={<span style={{ fontSize: "var(--font-size-1)", color: "var(--gray-11)" }}>(30 Days)</span>}
    />
  );
}
