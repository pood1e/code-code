type OpenExternalUrlOptions = {
  sameTab?: boolean;
};

export function openExternalUrl(url: string | null | undefined, options?: OpenExternalUrlOptions): void {
  const normalized = (url || "").trim();
  if (!normalized) {
    return;
  }
  if (options?.sameTab) {
    window.location.assign(normalized);
    return;
  }
  window.open(normalized, "_blank", "noopener,noreferrer");
}
