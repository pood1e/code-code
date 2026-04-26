import { DialogFooterActions, type DialogFooterActionsProps } from "./dialog-footer-actions";

type DialogCloseFooterActionsProps = Omit<
  DialogFooterActionsProps,
  "showSubmit" | "submitText" | "submitLoadingText" | "submitDisabled" | "onSubmit"
>;

export function DialogCloseFooterActions(props: DialogCloseFooterActionsProps = {}) {
  return <DialogFooterActions {...props} showSubmit={false} />;
}

export type { DialogCloseFooterActionsProps };
