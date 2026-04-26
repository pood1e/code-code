import type { CSSProperties, ReactNode } from "react";
import { Box, Flex, Skeleton, Text } from "@radix-ui/themes";

export type QuotaPanelRow = {
  id: string;
  label: string;
  value: string;
  resetAtLabel?: string | null;
  progressPercent?: number | null;
  progressUnavailableLabel?: string | null;
  subtle?: boolean;
};

export type QuotaPanelSkeletonLine = {
  height: string;
  width?: string;
  mt?: string;
};

type QuotaPanelProps = {
  title?: string;
  rows: readonly QuotaPanelRow[];
  meta?: ReactNode;
  controls?: ReactNode;
};

const defaultLoadingLines: readonly QuotaPanelSkeletonLine[] = [
  { height: "12px", width: "72px" },
  { height: "12px", mt: "2" },
  { height: "12px", mt: "2" },
] as const;

const quotaPanelMaxRows = 5;

export function QuotaPanel({ title = "Quota", rows, meta, controls }: QuotaPanelProps) {
  const visibleRows = rows.slice(0, quotaPanelMaxRows);
  const hiddenRowCount = Math.max(0, rows.length - visibleRows.length);

  return (
    <Box mt="2">
      <Flex justify="between" align="center" gap="2" mb="1">
        <Text size="1" color="gray" weight="medium">{title}</Text>
        {meta ? (
          <Flex align="center" justify="end" gap="2" style={{ flexWrap: "wrap", rowGap: "var(--space-1)", minWidth: 0 }}>
            {meta}
          </Flex>
        ) : null}
      </Flex>
      {controls ? (
        <Box mb="2">
          {controls}
        </Box>
      ) : null}
      {visibleRows.length > 0 ? (
        <Flex direction="column" mt="1" style={quotaListStyle}>
          {visibleRows.map((row) => (
            <QuotaPanelListRow key={row.id} row={row} />
          ))}
          {hiddenRowCount > 0 ? <QuotaPanelOverflowRow hiddenRowCount={hiddenRowCount} /> : null}
        </Flex>
      ) : null}
    </Box>
  );
}

export function QuotaPanelSkeleton({ loadingLines }: { loadingLines?: readonly QuotaPanelSkeletonLine[] }) {
  const lines = loadingLines?.length ? loadingLines : defaultLoadingLines;
  return (
    <Box mt="3">
      {lines.map((line, index) => (
        <Skeleton key={`quota-panel-loading-${index}`} height={line.height} width={line.width} mt={line.mt} />
      ))}
    </Box>
  );
}

function QuotaPanelListRow({ row }: { row: QuotaPanelRow }) {
  const progressValue = normalizeQuotaProgressValue(row.progressPercent);
  const tone = resolveQuotaTone(progressValue);
  const hasProgress = progressValue !== null;

  return (
    <Box
      data-subtle={row.subtle ? "true" : undefined}
      data-quota-bar={hasProgress ? "true" : undefined}
      role={hasProgress ? "meter" : undefined}
      aria-label={hasProgress ? row.label : undefined}
      aria-valuemin={hasProgress ? 0 : undefined}
      aria-valuemax={hasProgress ? 100 : undefined}
      aria-valuenow={hasProgress ? Math.round(progressValue) : undefined}
      aria-valuetext={hasProgress ? `${row.value}, ${Math.round(progressValue)}% remaining` : undefined}
      style={quotaRowStyle}
    >
      {hasProgress ? (
        <Box aria-hidden="true" data-quota-bar-track="true" style={quotaRowBarTrackStyle}>
          <Box
            data-quota-bar-fill="true"
            style={{
              ...quotaRowBarFillStyle,
              width: `${progressValue}%`,
              background: quotaToneVars[tone].bar,
            }}
          />
        </Box>
      ) : null}
      <Flex align="center" justify="between" gap="3" style={quotaRowContentStyle}>
        <QuotaRowText row={row} />
        <Box style={quotaRowValueBoxStyle}>
          <Text size="1" weight="medium" style={quotaRowValueStyle}>
            {row.value}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}

function QuotaPanelOverflowRow({ hiddenRowCount }: { hiddenRowCount: number }) {
  return (
    <Box style={quotaRowStyle}>
      <Text size="1" color="gray">
        {`+${hiddenRowCount} more quota rows`}
      </Text>
    </Box>
  );
}

function QuotaRowText({ row }: { row: QuotaPanelRow }) {
  return (
    <Box style={quotaRowTextStyle}>
      <Text size="1" color="gray" weight={row.subtle ? "regular" : "medium"} style={quotaRowLabelStyle}>
        {row.label}
      </Text>
      {row.resetAtLabel ? (
        <Text size="1" color="gray" style={quotaRowHintStyle}>
          {`resets ${row.resetAtLabel}`}
        </Text>
      ) : null}
      {!row.resetAtLabel && row.progressUnavailableLabel ? (
        <Text size="1" color="gray" style={quotaRowHintStyle}>
          {row.progressUnavailableLabel}
        </Text>
      ) : null}
    </Box>
  );
}

function normalizeQuotaProgressValue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, value));
}

type QuotaTone = "green" | "amber" | "red" | "gray";

const quotaToneVars: Record<QuotaTone, { text: string; bg: string; border: string; bar: string }> = {
  green: { text: "var(--green-11)", bg: "var(--green-a3)", border: "var(--green-a5)", bar: "var(--green-a4)" },
  amber: { text: "var(--amber-11)", bg: "var(--amber-a3)", border: "var(--amber-a5)", bar: "var(--amber-a4)" },
  red: { text: "var(--red-11)", bg: "var(--red-a3)", border: "var(--red-a5)", bar: "var(--red-a4)" },
  gray: { text: "var(--gray-11)", bg: "var(--gray-a2)", border: "var(--gray-a5)", bar: "var(--gray-a4)" },
};

function resolveQuotaTone(value: number | null): QuotaTone {
  if (value === null) {
    return "gray";
  }
  if (value <= 20) {
    return "red";
  }
  if (value <= 50) {
    return "amber";
  }
  return "green";
}

const quotaListStyle = {
  rowGap: "var(--space-1)",
} satisfies CSSProperties;

const quotaRowStyle = {
  position: "relative",
  minHeight: 34,
  overflow: "hidden",
} satisfies CSSProperties;

const quotaRowBarTrackStyle = {
  position: "absolute",
  insetBlockEnd: 4,
  insetInline: 0,
  height: 3,
  overflow: "hidden",
  borderRadius: 999,
  background: "var(--gray-a3)",
} satisfies CSSProperties;

const quotaRowBarFillStyle = {
  height: "100%",
  borderRadius: 999,
} satisfies CSSProperties;

const quotaRowContentStyle = {
  position: "relative",
  minHeight: 34,
  paddingBlockStart: "5px",
  paddingBlockEnd: "8px",
  zIndex: 1,
} satisfies CSSProperties;

const quotaRowTextStyle = {
  minWidth: 0,
  paddingInlineEnd: "var(--space-2)",
  background: "var(--color-panel-solid)",
} satisfies CSSProperties;

const quotaRowValueBoxStyle = {
  flexShrink: 0,
  paddingInlineStart: "var(--space-2)",
  background: "var(--color-panel-solid)",
} satisfies CSSProperties;

const quotaRowValueStyle = {
  lineHeight: "16px",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const quotaRowLabelStyle = {
  display: "block",
  lineHeight: "16px",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const quotaRowHintStyle = {
  display: "block",
  lineHeight: "14px",
  whiteSpace: "nowrap",
} satisfies CSSProperties;
