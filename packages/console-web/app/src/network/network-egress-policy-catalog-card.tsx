import type { CSSProperties, KeyboardEvent } from "react";
import { Card, Text } from "@radix-ui/themes";
import type { IstioEgressPolicy } from "./network-types";

type PolicyCatalogCardProps = {
  policy: IstioEgressPolicy;
  selected: boolean;
  onSelect: () => void;
};

export function PolicyCatalogCard({ policy, selected, onSelect }: PolicyCatalogCardProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      size="1"
      variant="surface"
      aria-pressed={selected}
      aria-label={policy.displayName}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      style={cardStyle(selected)}
    >
      <Text size="2" weight="medium">{policy.displayName}</Text>
    </Card>
  );
}

function cardStyle(selected: boolean): CSSProperties {
  return {
    cursor: "pointer",
    minHeight: 56,
    outline: selected ? "2px solid var(--accent-a8)" : undefined,
    outlineOffset: selected ? 2 : undefined
  };
}
