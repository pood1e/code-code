import type { ReactNode } from "react";
import { Flex } from "@radix-ui/themes";
import { SoftBadge } from "@code-code/console-web-ui";

type Props = {
  tierLabel?: string | null;
  blocked?: boolean;
  labels?: readonly string[];
  children?: ReactNode;
};

export function ProviderCardTitleSuffix({ tierLabel, blocked = false, labels = [], children }: Props) {
  const normalizedLabels = labels.map((label) => label.trim()).filter(Boolean);
  if (!tierLabel && !blocked && normalizedLabels.length === 0 && !children) {
    return null;
  }

  return (
    <Flex align="center" gap="2" style={{ flexWrap: "wrap", rowGap: "var(--space-1)", minWidth: 0 }}>
      {tierLabel ? (
        <SoftBadge size="1" color="gray" label={tierLabel} />
      ) : null}
      {blocked ? (
        <SoftBadge size="1" color="red" label="Blocked" />
      ) : null}
      {normalizedLabels.map((label) => (
        <SoftBadge key={label} size="1" color="gray" label={label} />
      ))}
      {children}
    </Flex>
  );
}
