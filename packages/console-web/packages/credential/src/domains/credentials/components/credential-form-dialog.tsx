import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Box, Button, Dialog, Heading } from "@radix-ui/themes";
import { ErrorCalloutIf, requestErrorMessage } from "@code-code/console-web-ui";
import { createCredential, updateCredential, type CredentialView } from "../api";
import {
  buildManualCredentialDraft,
  defaultManualCredentialValues
} from "../manual-credential-submit";
import { useManualCredentialReferenceData } from "../use-manual-credential-reference-data";
import { CredentialFormContent } from "./credential-form-content";
import {
  type ManualCredentialFormValues
} from "./form/manual-credential-form";

export type CredentialFormDialogProps = {
  onSuccess?: (view: CredentialView) => void;
  onCancel?: () => void;
  triggerLabel?: string;
  existingCredentialId?: string;
  headless?: boolean;
};

export function CredentialFormDialog({
  onSuccess,
  onCancel,
  triggerLabel = "New Manual Credential",
  existingCredentialId,
  headless = false,
}: CredentialFormDialogProps) {
  const [open, setOpen] = useState(headless);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const methods = useForm<ManualCredentialFormValues>({
    defaultValues: defaultManualCredentialValues,
    shouldUnregister: true
  });
  const { reset } = methods;
  const { vendors } = useManualCredentialReferenceData(methods);

  // Initialize on mount for headless mode
  useEffect(() => {
    if (headless) {
      reset(defaultManualCredentialValues);
      setErrorMsg("");
    }
  }, [headless, reset]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    reset(defaultManualCredentialValues);
    setErrorMsg("");
    if (!nextOpen) onCancel?.();
  };

  const onSubmit = async (data: ManualCredentialFormValues) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const draft = buildManualCredentialDraft(data);
      const cred = existingCredentialId 
        ? await updateCredential(existingCredentialId, draft)
        : await createCredential(draft);
        
      if (!headless) setOpen(false);
      reset(defaultManualCredentialValues);
      onSuccess?.(cred);
    } catch (error: unknown) {
      setErrorMsg(requestErrorMessage(error, "Failed to create/update credential"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (headless && onCancel) {
      onCancel();
    } else {
      setOpen(false);
      onCancel?.();
    }
  };

  const content = (
    <Box>
      {headless ? (
        <Heading size="4" mb="4">Create New Credential</Heading>
      ) : (
        <Dialog.Title>Create New Credential</Dialog.Title>
      )}
      <ErrorCalloutIf error={errorMsg} mb="4" />
      <CredentialFormContent
        methods={methods}
        vendors={vendors}
        submitting={isSubmitting}
        onSubmit={onSubmit}
        onCancel={headless ? handleCancel : undefined}
      />
    </Box>
  );

  if (headless) {
    return (
      <Box>
        {content}
      </Box>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>
        <Button size="2" variant="soft" color="gray">{triggerLabel}</Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="500px" aria-describedby={undefined}>
        {content}
      </Dialog.Content>
    </Dialog.Root>
  );
}
