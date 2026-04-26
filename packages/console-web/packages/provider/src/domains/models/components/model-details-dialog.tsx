import type { ModelDefinition } from "@code-code/agent-contract/model/v1";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import type { ReactNode } from "react";
import { Button, Dialog, Flex, ScrollArea, Text } from "@radix-ui/themes";
import { formatModelMetadataSummary } from "./model-detail-formatters";
import { ModelDetailsOverview } from "./model-details-overview";
import { ModelDetailsRuntime } from "./model-details-runtime";
import { ModelDetailsSources } from "./model-details-sources";
import { DialogCloseFooterActions } from "@code-code/console-web-ui";

type ModelDetailsDialogProps = {
  row: ModelRegistryEntry;
  vendorsById: Record<string, VendorView>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
};

export function ModelDetailsDialog({ row, vendorsById, open, onOpenChange, trigger }: ModelDetailsDialogProps) {
  const model = row.definition as ModelDefinition;
  const displayName = model.displayName || model.modelId;
  const controlled = open !== undefined;

  return (
    <Dialog.Root open={controlled ? open : undefined} onOpenChange={onOpenChange}>
      {!controlled && (
        <Dialog.Trigger style={trigger ? { display: "contents" } : undefined}>
          {trigger ?? <Button variant="soft" color="gray" size="1">Details</Button>}
        </Dialog.Trigger>
      )}
      <Dialog.Content maxWidth="760px" aria-describedby={undefined}>
        <Dialog.Title>{displayName}</Dialog.Title>
        <Text size="1" color="gray">{formatModelMetadataSummary(model)}</Text>
        <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: "68vh" }}>
          <Flex direction="column" gap="5" pr="3" mt="4">
            <ModelDetailsOverview row={row} />
            <ModelDetailsSources row={row} vendorsById={vendorsById} />
            <ModelDetailsRuntime model={model} />
          </Flex>
        </ScrollArea>
        <DialogCloseFooterActions cancelText="Close" mt="5" />
      </Dialog.Content>
    </Dialog.Root>
  );
}
