export const SOURCE_BADGE_FREE = "free";

type SourceBadgeView = {
  color: "gray" | "green";
  key: string;
  label: string;
};

export function sourceBadgeLabel(value: string) {
  switch (value.trim().toLowerCase()) {
    case SOURCE_BADGE_FREE:
      return "Free";
    default:
      return value.trim();
  }
}

export function sourceBadgeViews(badges?: string[]): SourceBadgeView[] {
  return (badges ?? [])
    .map((badge) => {
      const normalized = badge.trim().toLowerCase();
      const label = sourceBadgeLabel(normalized);
      if (!label) {
        return null;
      }
      return {
        key: `badge:${normalized}`,
        label,
        color: normalized === SOURCE_BADGE_FREE ? "green" : "gray",
      };
    })
    .filter((view): view is SourceBadgeView => view !== null);
}
