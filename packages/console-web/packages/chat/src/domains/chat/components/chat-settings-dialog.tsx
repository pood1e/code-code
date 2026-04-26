import { Dialog } from "@radix-ui/themes";
import { DialogCloseFooterActions } from "@code-code/console-web-ui";
import { SessionSetupPanel } from "./session-setup-panel";
import type { SessionSetupPanelActions, SessionSetupPanelState } from "./session-setup-panel";

type ChatSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: SessionSetupPanelState;
  actions: SessionSetupPanelActions;
};

export function ChatSettingsDialog({
  open,
  onOpenChange,
  state,
  actions,
}: ChatSettingsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Session Settings</Dialog.Title>
        <SessionSetupPanel state={state} actions={actions} />
        <DialogCloseFooterActions cancelText="Close" mt="5" />
      </Dialog.Content>
    </Dialog.Root>
  );
}
