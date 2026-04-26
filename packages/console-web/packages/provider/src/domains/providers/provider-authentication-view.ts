export type ProviderAuthenticationKind = "apiKey" | "cliOAuth";

type ProviderAuthenticationStatusColor = "green" | "amber" | "red" | "gray";

export type ProviderAuthenticationStatusView = {
  label: string;
  color: ProviderAuthenticationStatusColor;
  reason: string;
};

export function providerAuthenticationStatus(materialReady: boolean | undefined, reason: string) {
  const normalizedReason = reason.trim();
  if (materialReady === true) {
    return { label: "Ready", color: "green" as const, reason: "" };
  }
  if (materialReady === false) {
    return {
      label: "Needs Attention",
      color: "red" as const,
      reason: normalizedReason || "Authentication material is not ready.",
    };
  }
  return { label: "Unknown", color: "gray" as const, reason: normalizedReason };
}

export function providerAuthenticationTokenStatus(expiresAt: string): ProviderAuthenticationStatusView {
  const expiry = parseTimestamp(expiresAt);
  if (!expiry) {
    return { label: "Not Reported", color: "gray", reason: "" };
  }
  const now = Date.now();
  if (expiry.getTime() <= now) {
    return { label: "Expired", color: "red", reason: "" };
  }
  if (expiry.getTime() - now <= 24 * 60 * 60 * 1000) {
    return { label: "Expiring Soon", color: "amber", reason: "" };
  }
  return { label: "Valid", color: "green", reason: "" };
}

export function providerAuthenticationExpiry(value: string) {
  const date = parseTimestamp(value);
  if (!date) {
    return "Not reported";
  }
  return `${date.toLocaleString()} (${relativeTime(date)})`;
}

function parseTimestamp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

function relativeTime(date: Date) {
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const hours = Math.round(absMs / (60 * 60 * 1000));
  if (hours < 1) {
    return diffMs >= 0 ? "soon" : "just expired";
  }
  if (hours < 48) {
    return diffMs >= 0 ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return diffMs >= 0 ? `in ${days}d` : `${days}d ago`;
}
