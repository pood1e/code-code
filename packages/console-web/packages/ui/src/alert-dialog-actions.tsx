import { AlertDialog, Button, Flex } from "@radix-ui/themes";

type AlertDialogActionsProps = {
  isSubmitting?: boolean;
  submitText?: string;
  submitLoadingText?: string;
  submitDisabled?: boolean;
  onSubmit?: () => void;
  onCancel?: () => void;
  cancelText?: string;
  cancelDisabled?: boolean;
  showSubmit?: boolean;
  showCancel?: boolean;
  closeOnCancel?: boolean;
  mt?: string;
};

export function AlertDialogActions({
  isSubmitting = false,
  submitText = "Delete",
  submitLoadingText,
  submitDisabled = false,
  onSubmit,
  onCancel,
  cancelText = "Cancel",
  cancelDisabled = false,
  showSubmit = true,
  showCancel = true,
  closeOnCancel,
  mt = "4"
}: AlertDialogActionsProps) {
  const submitLabel = isSubmitting && submitLoadingText ? submitLoadingText : submitText;
  const finalSubmitDisabled = isSubmitting || submitDisabled;
  const cancelButton = (
    <Button
      variant="soft"
      color="gray"
      type="button"
      disabled={isSubmitting || cancelDisabled}
      onClick={onCancel}
    >
      {cancelText}
    </Button>
  );
  const withAlertClose =
    closeOnCancel === true || (closeOnCancel === undefined && !onCancel);

  return (
    <Flex gap="3" justify="end" mt={mt}>
      {showCancel ? (withAlertClose ? <AlertDialog.Cancel>{cancelButton}</AlertDialog.Cancel> : cancelButton) : null}
      {showSubmit ? (
        <Button color="red" loading={isSubmitting} disabled={finalSubmitDisabled} onClick={onSubmit}>
          {submitLabel}
        </Button>
      ) : null}
    </Flex>
  );
}

export type { AlertDialogActionsProps };
