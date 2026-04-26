import { Avatar, Box, Card, Flex, Text } from "@radix-ui/themes";
import type { CSSProperties, ReactNode } from "react";
import { RuntimeFallbackList, StatusBadge } from "@code-code/console-web-ui";
import type { SelectionFallback } from "../domain/types";

type FallbackChainPreviewProps = {
  items: SelectionFallback[];
};

type FallbackChainEditorProps = {
  items: SelectionFallback[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
};

export function FallbackChainPreview({ items }: FallbackChainPreviewProps) {
  return (
    <Flex direction="column" gap="2">
      {items.map((item, index) => (
        <FallbackRow key={item.id} item={item} index={index} />
      ))}
    </Flex>
  );
}

export function FallbackChainEditor({ items, onMoveUp, onMoveDown, onRemove }: FallbackChainEditorProps) {
  return (
    <RuntimeFallbackList
      items={items}
      rowKey={(item) => item.id}
      emptyText="No fallback candidates yet."
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onRemove={onRemove}
      canRemove={(_, total) => total > 1}
      renderRow={({ item, index, actions }) => (
        <FallbackRow item={item} index={index} actions={actions} />
      )}
    />
  );
}

function FallbackRow({
  item,
  index,
  actions
}: {
  item: SelectionFallback;
  index: number;
  actions?: ReactNode;
}) {
  return (
    <Card size="1">
      <Flex justify="between" align="start" gap="3">
        <Flex gap="3" align="start" style={{ minWidth: 0, flex: 1 }}>
          <Box style={indexStyle}>
            <Text size="1" weight="medium">
              {index + 1}
            </Text>
          </Box>
          <Avatar
            size="1"
            src={item.providerIconUrl}
            fallback={item.providerLabel.trim().slice(0, 2).toUpperCase() || "P"}
            radius="full"
          />
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Flex gap="2" align="center" wrap="wrap">
              <Text size="2" weight="medium">
                {item.modelId}
              </Text>
              <FallbackAvailabilityBadge availability={item.availability} />
            </Flex>
            <Text size="1" color="gray" style={metaStyle}>
              {item.providerLabel} · {item.surfaceLabel} · {item.vendorLabel}
            </Text>
          </Box>
        </Flex>
        {actions ?? null}
      </Flex>
    </Card>
  );
}

export function FallbackAvailabilityBadge({ availability }: { availability: SelectionFallback["availability"] }) {
  const tone = resolveAvailabilityTone(availability);
  return (
    <StatusBadge size="1" color={tone.color} label={tone.label} />
  );
}

function resolveAvailabilityTone(availability: SelectionFallback["availability"]) {
  switch (availability) {
    case "available":
      return { label: "Available", color: "green" as const };
    case "degraded":
      return { label: "Degraded", color: "amber" as const };
    case "unavailable":
      return { label: "Unavailable", color: "red" as const };
  }
}

const indexStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  border: "1px solid var(--gray-a5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const metaStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
