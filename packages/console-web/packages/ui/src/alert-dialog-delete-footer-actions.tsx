import { AlertDialogActions, type AlertDialogActionsProps } from "./alert-dialog-actions";

type AlertDialogDeleteFooterActionsProps = Omit<
  AlertDialogActionsProps,
  "submitText" | "submitLoadingText"
> & {
  submitLoadingText?: string;
};

export function AlertDialogDeleteFooterActions({
  submitLoadingText = "Deleting",
  ...props
}: AlertDialogDeleteFooterActionsProps = {}) {
  return <AlertDialogActions submitText="Delete" submitLoadingText={submitLoadingText} {...props} />;
}

export type { AlertDialogDeleteFooterActionsProps };
