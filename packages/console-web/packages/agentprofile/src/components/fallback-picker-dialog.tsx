import { Dialog, Flex, Text } from "@radix-ui/themes";
import { DialogFooterActions, FormSelectField } from "@code-code/console-web-ui";
import { FallbackAvailabilityBadge } from "./fallback-chain";
import { useFallbackPickerModel } from "./use-fallback-picker-model";
import type { FallbackProviderOption, SelectionFallback } from "../domain/types";

type FallbackPickerDialogProps = {
  open: boolean;
  items: FallbackProviderOption[];
  onOpenChange: (open: boolean) => void;
  onSelect: (item: SelectionFallback) => void;
};

export function FallbackPickerDialog({ open, items, onOpenChange, onSelect }: FallbackPickerDialogProps) {
  const {
    providerOptions,
    surfaceOptions,
    modelSelectOptions,
    resolvedProviderValue,
    resolvedSurfaceValue,
    resolvedModelValue,
    setProviderValue,
    setSurfaceValue,
    setModelValue,
    selectedModelAvailability,
    selectedFallback,
  } = useFallbackPickerModel(items);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Add Fallback</Dialog.Title>
        <Flex direction="column" gap="4" mt="4">
          <FormSelectField
            label="Provider"
            value={resolvedProviderValue}
            items={providerOptions}
            disabled={providerOptions.length === 0}
            onValueChange={setProviderValue}
          />

          {surfaceOptions.length > 1 ? (
            <FormSelectField
              label="Surface"
              value={resolvedSurfaceValue}
              items={surfaceOptions}
              disabled={surfaceOptions.length === 0}
              onValueChange={setSurfaceValue}
            />
          ) : null}

          <FormSelectField
            label="Model"
            value={resolvedModelValue}
            items={modelSelectOptions}
            disabled={modelSelectOptions.length === 0}
            onValueChange={setModelValue}
          />

          {selectedModelAvailability ? (
            <Flex align="center" gap="2">
              <Text size="1" color="gray">
                Availability
              </Text>
              <FallbackAvailabilityBadge availability={selectedModelAvailability} />
            </Flex>
          ) : null}

          <DialogFooterActions
            submitText="Add"
            submitDisabled={selectedFallback === null}
            onSubmit={() => {
              if (!selectedFallback) {
                return;
              }
              onSelect(selectedFallback);
              onOpenChange(false);
            }}
            mt="0"
          />
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
