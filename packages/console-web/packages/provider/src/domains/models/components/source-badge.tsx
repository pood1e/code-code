import { SoftBadge } from "@code-code/console-web-ui";
import { sourceBadgeViews } from "../source-badges";

type SourceBadgeProps = {
  badges?: string[];
};

export function SourceBadge({ badges }: SourceBadgeProps) {
  const views = sourceBadgeViews(badges);
  if (views.length === 0) {
    return null;
  }

  return (
    <>
      {views.map((view) => (
        <SoftBadge key={view.key} color={view.color} size="1" title={view.label} label={view.label} />
      ))}
    </>
  );
}
