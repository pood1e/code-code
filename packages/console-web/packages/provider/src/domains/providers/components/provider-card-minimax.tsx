import { ProviderQuotaCard } from "./provider-quota-card";
import { readMiniMaxQuotaSummary } from "./provider-card-minimax-summary";
import type { ProviderCardRendererContext } from "../provider-card-registry";
import { formatQuotaAmountSummary } from "../provider-quota-presentation";

type Props = ProviderCardRendererContext;

export function ProviderCardMiniMax({ observability, observabilityError, isLoading, status }: Props) {
  const summary = readMiniMaxQuotaSummary(observability, new Date());
  const rows = summary?.rows.map((row) => ({
    id: row.modelId,
    label: row.label,
    value: formatQuotaAmountSummary(row.remaining, row.total),
    resetAtLabel: row.resetAtLabel,
    progressPercent: row.progressPercent,
  })) || [];

  return (
    <ProviderQuotaCard
      loading={isLoading}
      error={observabilityError}
      rows={rows}
      status={status}
      updatedAtLabel={summary?.updatedAtLabel}
      updatedAtTimestamp={summary?.updatedAtTimestamp}
    />
  );
}
