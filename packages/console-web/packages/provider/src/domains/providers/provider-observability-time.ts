export function formatQuotaResetAtLocal(resetAtSeconds: number | null, now: Date, timeZone?: string) {
  return formatLocalTimestamp(new Date(Math.round((resetAtSeconds || 0) * 1000)), now, timeZone);
}

export function formatObservedAtLocal(timestamp: string, now: Date, timeZone?: string) {
  const trimmed = timestamp.trim();
  if (!trimmed) {
    return null;
  }
  return formatLocalTimestamp(new Date(trimmed), now, timeZone);
}

export function formatObservedAtRelative(timestamp: string, now: Date = new Date()) {
  const trimmed = timestamp.trim();
  if (!trimmed) {
    return null;
  }
  const observedAt = new Date(trimmed);
  if (!(observedAt instanceof Date) || Number.isNaN(observedAt.getTime()) || !(now instanceof Date)) {
    return null;
  }
  const diffMs = now.getTime() - observedAt.getTime();
  const future = diffMs < 0;
  const absMs = Math.abs(diffMs);
  if (absMs < 60 * 1000) {
    return future ? "in <1m" : "just now";
  }
  const minutes = Math.round(absMs / (60 * 1000));
  if (minutes < 60) {
    return future ? `in ${minutes}m` : `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return future ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return future ? `in ${days}d` : `${days}d ago`;
}

function formatLocalTimestamp(date: Date, now: Date, timeZone?: string) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || !(now instanceof Date)) {
    return null;
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year") || "";
  const month = values.get("month") || "";
  const day = values.get("day") || "";
  const hour = values.get("hour") || "";
  const minute = values.get("minute") || "";
  const nowFormatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric" });
  const sameYear = year !== "" && year === nowFormatter.format(now);
  if (!month || !day || !hour || !minute) {
    return null;
  }
  if (sameYear) {
    return `${month}-${day} ${hour}:${minute}`;
  }
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
