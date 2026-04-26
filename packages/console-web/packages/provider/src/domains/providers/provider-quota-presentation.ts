const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const plainNumberFormatter = new Intl.NumberFormat("en-US");

export function formatQuotaAmount(value: number) {
  const roundedValue = Math.round(value);
  if (Math.abs(roundedValue) < 10000) {
    return plainNumberFormatter.format(roundedValue);
  }
  return compactNumberFormatter.format(roundedValue);
}

export function formatQuotaAmountSummary(remaining: number | null, limit: number | null) {
  if (typeof remaining === "number" && typeof limit === "number") {
    return `${formatQuotaAmount(remaining)}/${formatQuotaAmount(limit)}`;
  }
  if (typeof remaining === "number") {
    return formatQuotaAmount(remaining);
  }
  if (typeof limit === "number") {
    return `~/${formatQuotaAmount(limit)}`;
  }
  return "-";
}
