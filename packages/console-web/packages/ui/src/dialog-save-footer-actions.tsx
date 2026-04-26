import { DialogFooterActions, type DialogFooterActionsProps } from "./dialog-footer-actions";

type DialogSaveFooterActionsProps = Omit<
  DialogFooterActionsProps,
  "submitText" | "submitLoadingText"
> & {
  submitText?: string;
  submitLoadingText?: string;
};

export function DialogSaveFooterActions({
  submitText = "Save",
  submitLoadingText = "Saving...",
  ...props
}: DialogSaveFooterActionsProps = {}) {
  return (
    <DialogFooterActions
      submitText={submitText}
      submitLoadingText={submitLoadingText}
      {...props}
    />
  );
}

export type { DialogSaveFooterActionsProps };

