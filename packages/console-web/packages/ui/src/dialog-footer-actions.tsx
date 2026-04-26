import { Fragment, type ComponentProps } from "react";
import { Button, Dialog, Flex } from "@radix-ui/themes";

type DialogFooterActionsProps = {
  isSubmitting?: boolean;
  submitText?: string;
  submitLoadingText?: string;
  submitType?: "submit" | "button";
  submitDisabled?: boolean;
  onSubmit?: () => void;
  onCancel?: () => void;
  cancelText?: string;
  cancelDisabled?: boolean;
  cancelLoading?: boolean;
  cancelColor?: ComponentProps<typeof Button>["color"];
  cancelVariant?: ComponentProps<typeof Button>["variant"];
  submitColor?: ComponentProps<typeof Button>["color"];
  submitVariant?: ComponentProps<typeof Button>["variant"];
  showSubmit?: boolean;
  showCancel?: boolean;
  actionsOrder?: "cancel-first" | "submit-first";
  closeOnCancel?: boolean;
  mt?: string;
};

export function DialogFooterActions({
  isSubmitting: resolvedIsSubmitting = false,
  submitText = "Save",
  submitLoadingText,
  submitType,
  submitDisabled = false,
  onSubmit,
  onCancel,
  cancelText = "Cancel",
  cancelDisabled = false,
  cancelLoading = false,
  cancelColor = "gray",
  cancelVariant = "soft",
  submitColor = "gray",
  submitVariant = "soft",
  showSubmit = true,
  showCancel = true,
  actionsOrder = "cancel-first",
  closeOnCancel,
  mt = "2",
}: DialogFooterActionsProps) {
  const submitLabel = resolvedIsSubmitting && submitLoadingText ? submitLoadingText : submitText;
  const finalSubmitDisabled = resolvedIsSubmitting || submitDisabled;
  const resolvedSubmitType: "submit" | "button" = submitType ?? (onSubmit ? "button" : "submit");
  const cancelButton = (
    <Button
      variant={cancelVariant}
      color={cancelColor}
      type="button"
      disabled={resolvedIsSubmitting || cancelDisabled}
      loading={cancelLoading}
      onClick={onCancel}
    >
      {cancelText}
    </Button>
  );
  const withDialogClose = closeOnCancel === true || (closeOnCancel === undefined && !onCancel);
  const cancelAction = withDialogClose ? <Dialog.Close>{cancelButton}</Dialog.Close> : cancelButton;
  const submitButton = showSubmit ? (
    <Button
      type={resolvedSubmitType}
      loading={resolvedIsSubmitting}
      disabled={finalSubmitDisabled}
      color={submitColor}
      variant={submitVariant}
      onClick={resolvedSubmitType === "button" ? onSubmit : undefined}
    >
      {submitLabel}
    </Button>
  ) : null;
  const cancelActionNode = showCancel ? cancelAction : null;
  const orderedActions =
    actionsOrder === "submit-first"
      ? [submitButton, cancelActionNode]
      : [cancelActionNode, submitButton];

  return (
    <Flex justify="end" gap="2" mt={mt}>
      {orderedActions.map((action, index) => (action === null ? null : <Fragment key={`${actionsOrder}-${index}`}>{action}</Fragment>))}
    </Flex>
  );
}

export type { DialogFooterActionsProps };
