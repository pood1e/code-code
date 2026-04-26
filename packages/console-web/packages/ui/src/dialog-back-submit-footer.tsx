import { DialogFooterActions, type DialogFooterActionsProps } from "./dialog-footer-actions";

type DialogBackSubmitFooterActionsProps = Omit<
  DialogFooterActionsProps,
  "cancelText"
>;

export function DialogBackSubmitFooterActions(props: DialogBackSubmitFooterActionsProps = {}) {
  return <DialogFooterActions cancelText="Back" {...props} />;
}

export type { DialogBackSubmitFooterActionsProps };

