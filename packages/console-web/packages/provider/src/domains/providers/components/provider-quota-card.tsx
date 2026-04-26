import { Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AsyncState, QuotaPanel, QuotaPanelSkeleton, StatusBadge, type QuotaPanelSkeletonLine } from "@code-code/console-web-ui";
import {
  toProviderQuotaCardRows,
  type ProviderQuotaCardRow,
  type QuotaPercentCardRow,
  type QuotaCardSummary,
} from "../provider-quota-metric-aggregation";
import { formatObservedAtRelative } from "../provider-observability-time";
import type { ProviderStatusView } from "../provider-model";

export type { ProviderQuotaCardRow } from "../provider-quota-metric-aggregation";

type ProviderQuotaCardProps = {
  loading: boolean;
  error?: unknown;
  updatedAtLabel?: string | null;
  updatedAtTimestamp?: string | null;
  rows: readonly ProviderQuotaCardRow[];
  status?: ProviderStatusView | null;
  titleSuffix?: ReactNode;
  controls?: ReactNode;
  loadingLines?: readonly QuotaPanelSkeletonLine[];
};

export function ProviderQuotaCard({
  loading,
  error,
  updatedAtLabel,
  updatedAtTimestamp,
  rows,
  status,
  titleSuffix,
  controls,
  loadingLines,
}: ProviderQuotaCardProps) {
  const now = useRelativeNow(Boolean(updatedAtTimestamp));
  const resolvedUpdatedAtLabel = useMemo(
    () => resolveUpdatedAtLabel(updatedAtTimestamp, updatedAtLabel, now),
    [now, updatedAtLabel, updatedAtTimestamp],
  );
  const statusReason = status?.reason?.trim() || "";
  const headerStatus = status?.label && status.label !== "Unknown" ? (
    <StatusBadge color={status.color} label={status.label} size="1" />
  ) : resolvedUpdatedAtLabel ? (
    <Text size="1" color="gray">Updated {resolvedUpdatedAtLabel}</Text>
  ) : null;
  const meta = headerStatus || titleSuffix ? (
    <>
      {headerStatus}
      {statusReason ? (
        <Text size="1" color={status?.color === "red" ? "red" : "gray"} style={{ whiteSpace: "nowrap" }}>
          {statusReason}
        </Text>
      ) : null}
      {titleSuffix}
    </>
  ) : null;
  return (
    <AsyncState
      loading={loading}
      error={error}
      errorTitle="Failed to load quota metrics."
      isEmpty={rows.length === 0}
      emptyContent={(
        <div style={{ marginTop: "var(--space-3)" }}>
          <Text size="1" color="gray">No current quota gauge values.</Text>
        </div>
      )}
      loadingContent={<QuotaPanelSkeleton loadingLines={loadingLines} />}
    >
      <QuotaPanel rows={rows} meta={meta} controls={controls} />
    </AsyncState>
  );
}

type ProviderQuotaCardFromPercentRowsProps<TRow extends QuotaPercentCardRow> = {
  loading: boolean;
  error?: unknown;
  summary: QuotaCardSummary<TRow> | null;
  status?: ProviderStatusView | null;
  titleSuffix?: ReactNode;
  loadingLines?: readonly QuotaPanelSkeletonLine[];
  getId?: (row: TRow) => string;
};

export function ProviderQuotaCardFromPercentRows<TRow extends QuotaPercentCardRow>({
  loading,
  error,
  summary,
  status,
  titleSuffix,
  loadingLines,
  getId = (row) => row.label,
}: ProviderQuotaCardFromPercentRowsProps<TRow>) {
  const rows = summary?.rows ? toProviderQuotaCardRows(summary.rows, getId) : [];
  return (
    <ProviderQuotaCard
      loading={loading}
      error={error}
      rows={rows}
      loadingLines={loadingLines}
      status={status}
      updatedAtLabel={summary?.updatedAtLabel}
      updatedAtTimestamp={summary?.updatedAtTimestamp}
      titleSuffix={titleSuffix}
    />
  );
}

function useRelativeNow(enabled: boolean) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  return now;
}

function resolveUpdatedAtLabel(updatedAtTimestamp: string | null | undefined, updatedAtLabel: string | null | undefined, now: Date) {
  const relativeLabel = updatedAtTimestamp ? formatObservedAtRelative(updatedAtTimestamp, now) : null;
  if (relativeLabel) {
    return relativeLabel;
  }
  return updatedAtLabel || null;
}
