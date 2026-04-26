import { DialogCloseFooterActions, type DialogCloseFooterActionsProps } from "./dialog-close-footer";

type DialogBackFooterActionsProps = Omit<
  DialogCloseFooterActionsProps,
  "cancelText"
>;

export function DialogBackFooterActions(props: DialogBackFooterActionsProps = {}) {
  return <DialogCloseFooterActions cancelText="Back" {...props} />;
}

export type { DialogBackFooterActionsProps };
