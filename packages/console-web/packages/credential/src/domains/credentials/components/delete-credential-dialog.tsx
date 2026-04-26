import { useState } from "react";
import { AlertDialog, Button } from "@radix-ui/themes";
import { AlertDialogDeleteFooterActions, ErrorCalloutIf, requestErrorMessage } from "@code-code/console-web-ui";

type DeleteCredentialDialogProps = {
  credentialId: string;
  displayName: string;
  onDelete: (id: string) => Promise<void>;
};

export function DeleteCredentialDialog({
  credentialId,
  displayName,
  onDelete
}: DeleteCredentialDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg("");
    try {
      await onDelete(credentialId);
      setOpen(false);
    } catch (error: unknown) {
      setErrorMsg(requestErrorMessage(error, "Failed to delete credential"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setErrorMsg("");
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Trigger>
        <Button variant="ghost" color="red" size="1">Delete</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="400px">
        <AlertDialog.Title>Delete Credential</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Are you sure you want to delete <strong>{displayName}</strong>? This action cannot be undone.
        </AlertDialog.Description>
        <ErrorCalloutIf error={errorMsg} mt="3" />
        <AlertDialogDeleteFooterActions isSubmitting={isDeleting} onSubmit={handleDelete} />
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
