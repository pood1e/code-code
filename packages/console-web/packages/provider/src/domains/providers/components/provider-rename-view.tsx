import { Dialog, Flex } from "@radix-ui/themes";
import { DialogBackSubmitFooterActions, ErrorCalloutIf, FormTextField } from "@code-code/console-web-ui";

type Props = {
  renameValue: string;
  renameError: string;
  isRenaming: boolean;
  canSaveRename: boolean;
  onRenameValueChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
};

export function ProviderRenameView({
  renameValue,
  renameError,
  isRenaming,
  canSaveRename,
  onRenameValueChange,
  onBack,
  onSubmit,
}: Props) {
  return (
    <>
      <Dialog.Title size="4" mb="3">Rename Provider</Dialog.Title>
      <Flex direction="column" gap="4">
        <FormTextField
          label="Provider Name"
          id="provider-name"
          value={renameValue}
          onValueChange={onRenameValueChange}
        />

        <ErrorCalloutIf error={renameError} />

        <DialogBackSubmitFooterActions
          isSubmitting={isRenaming}
          onCancel={onBack}
          submitDisabled={!canSaveRename}
          onSubmit={onSubmit}
        />
      </Flex>
    </>
  );
}
