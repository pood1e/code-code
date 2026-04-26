import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { DialogCloseFooterActions, WarningCallout } from "@code-code/console-web-ui";

export function CookieCredentialDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button size="2" variant="soft" color="gray">Add Cookie</Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="420px" aria-describedby={undefined}>
        <Dialog.Title>Add Cookie Credential</Dialog.Title>
        <Flex direction="column" gap="4">
          <Text size="2">
            Cookie credential support is not connected to the control plane yet.
          </Text>
          <WarningCallout>
            This entry is reserved for the cookie credential flow. No credential will be created from this dialog.
          </WarningCallout>
          <DialogCloseFooterActions cancelText="Close" mt="0" />
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
