import { Button, Flex, Text } from "@radix-ui/themes";
import { useMemo, useState, type CSSProperties } from "react";
import { CloseIcon, PlusIcon } from "./action-icons";
import { ResourcePickerDialog } from "./resource-picker-dialog";
import type { MCPResourceSummary, TextResourceSummary } from "../domain/types";
import { ActionIconButton } from "@code-code/console-web-ui";

type ProfileResourceSelectionTabProps = {
  label: string;
  pickerTitle: string;
  selectedItems: Array<MCPResourceSummary | TextResourceSummary>;
  availableItems: Array<MCPResourceSummary | TextResourceSummary>;
  onAttach: (id: string) => void;
  onRemove: (id: string) => void;
};

export function ProfileResourceSelectionTab({
  label,
  pickerTitle,
  selectedItems,
  availableItems,
  onAttach,
  onRemove
}: ProfileResourceSelectionTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const pickerItems = useMemo(
    () =>
      availableItems.map((item) => ({
        id: item.id,
        name: item.name,
        meta: describeItem(item)
      })),
    [availableItems]
  );

  return (
    <>
      <Flex align="start" gap="3" wrap="wrap">
        <Text size="1" color="gray" style={labelStyle}>
          {label}
        </Text>

        <Flex gap="2" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
          {selectedItems.map((item) => (
            <Button
              key={item.id}
              size="1"
              variant="soft"
              color="gray"
              radius="full"
              aria-label={`Remove ${item.name}`}
              title={`Remove ${item.name}`}
              onClick={() => onRemove(item.id)}
              style={tagButtonStyle}
            >
              <Text as="span" size="1" style={tagTextStyle}>
                {item.name}
              </Text>
              <CloseIcon />
            </Button>
          ))}
        </Flex>

        <Flex justify="end">
          <ActionIconButton size="1" variant="soft" aria-label={`Add ${label}`} title={`Add ${label}`} onClick={() => setDialogOpen(true)}>
            <PlusIcon />
          </ActionIconButton>
        </Flex>
      </Flex>

      <ResourcePickerDialog
        title={pickerTitle}
        open={dialogOpen}
        items={pickerItems}
        onOpenChange={setDialogOpen}
        onSelect={(id) => {
          onAttach(id);
          setDialogOpen(false);
        }}
      />
    </>
  );
}

function describeItem(item: MCPResourceSummary | TextResourceSummary) {
  if ("transport" in item) {
    return item.summary || (item.transport === "stdio" ? "stdio" : "Streamable HTTP");
  }
  return item.description || "No description yet.";
}

const tagButtonStyle: CSSProperties = {
  maxWidth: 180,
  minWidth: 0
};

const tagTextStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const labelStyle: CSSProperties = {
  width: 44,
  paddingTop: 5,
  flexShrink: 0
};
