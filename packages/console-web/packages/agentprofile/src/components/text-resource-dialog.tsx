import { useEffect } from "react";
import { Dialog, Flex } from "@radix-ui/themes";
import { Controller, useForm } from "react-hook-form";
import type { TextResourceDraft } from "../domain/types";
import { DialogSaveFooterActions, FormFieldError, FormTextAreaField, FormTextField } from "@code-code/console-web-ui";

type TextResourceDialogProps = {
  item: TextResourceDraft | null;
  kindLabel: string;
  open: boolean;
  isSubmitting?: boolean;
  submitError?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (item: TextResourceDraft) => Promise<void> | void;
};

export function TextResourceDialog({
  item,
  kindLabel,
  open,
  isSubmitting = false,
  submitError,
  onOpenChange,
  onSubmit
}: TextResourceDialogProps) {
  const form = useForm<TextResourceDraft>({ defaultValues: item ?? emptyItem });
  const { control, handleSubmit, reset } = form;

  useEffect(() => {
    if (open && item) {
      reset(item);
    }
  }, [item, open, reset]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>{item?.name ?? `New ${kindLabel}`}</Dialog.Title>

        <Flex asChild direction="column" gap="4" mt="4">
          <form
            onSubmit={handleSubmit(async (values) => {
              await onSubmit({ ...values, name: values.name.trim() || item?.name || `New ${kindLabel}` });
            })}
          >
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <FormTextField
                  label="Name"
                  value={(field.value as string) ?? ""}
                  onValueChange={field.onChange}
                />
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <FormTextField
                  label="Description"
                  value={(field.value as string) ?? ""}
                  onValueChange={field.onChange}
                />
              )}
            />

            <Controller
              control={control}
              name="content"
              render={({ field }) => (
                <FormTextAreaField
                  label="Content"
                  value={(field.value as string) ?? ""}
                  rows={10}
                  onValueChange={field.onChange}
                />
              )}
            />

            <FormFieldError>{submitError}</FormFieldError>

            <DialogSaveFooterActions
              isSubmitting={isSubmitting}
              submitText={`Save ${kindLabel}`}
              cancelDisabled={isSubmitting}
            />
          </form>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

const emptyItem: TextResourceDraft = {
  id: "",
  name: "",
  description: "",
  content: ""
};
