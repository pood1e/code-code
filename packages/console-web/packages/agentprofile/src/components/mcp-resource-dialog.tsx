import { useEffect } from "react";
import { Dialog, Flex, Text } from "@radix-ui/themes";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { MCPResourceDraft, MCPTransport } from "../domain/types";
import { DialogSaveFooterActions, FormField, FormFieldError, FormSelectField, FormTextAreaField, FormTextField } from "@code-code/console-web-ui";

type MCPResourceDialogProps = {
  item: MCPResourceDraft | null;
  open: boolean;
  isSubmitting?: boolean;
  submitError?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (item: MCPResourceDraft) => Promise<void> | void;
};

export function MCPResourceDialog({ item, open, isSubmitting = false, submitError, onOpenChange, onSubmit }: MCPResourceDialogProps) {
  const form = useForm<MCPResourceDraft>({ defaultValues: item ?? emptyItem });
  const { control, handleSubmit, reset } = form;
  const transport = useWatch({ control, name: "transport" });

  useEffect(() => {
    if (open && item) {
      reset(item);
    }
  }, [item, open, reset]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>{item?.name ?? "New MCP"}</Dialog.Title>
        <Text size="2" color="gray">
          Use the official MCP transport split: local `stdio` subprocess or remote `Streamable HTTP` endpoint.
        </Text>

        <Flex asChild direction="column" gap="4" mt="4">
          <form
            onSubmit={handleSubmit(async (values) => {
              await onSubmit(cleanMcp(values));
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
              name="transport"
              render={({ field }) => (
                <FormSelectField
                  label="Transport"
                  value={field.value}
                  items={[
                    { value: "stdio", label: "stdio" },
                    { value: "streamable-http", label: "Streamable HTTP" },
                  ]}
                  onValueChange={(value) => field.onChange(value as MCPTransport)}
                />
              )}
            />

            {transport === "stdio" ? (
              <Flex direction="column" gap="3">
                <Controller
                  control={control}
                  name="command"
                  render={({ field }) => (
                    <FormTextField
                      label="Command"
                      value={(field.value as string) ?? ""}
                      onValueChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="args"
                  render={({ field }) => (
                    <FormTextAreaField
                      label="Args"
                      value={(field.value as string) ?? ""}
                      placeholder="One argument per line"
                      rows={4}
                      onValueChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="env"
                  render={({ field }) => (
                    <FormTextAreaField
                      label="Environment"
                      value={(field.value as string) ?? ""}
                      placeholder="KEY=value per line"
                      rows={4}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </Flex>
            ) : (
              <Flex direction="column" gap="3">
                <Controller
                  control={control}
                  name="endpoint"
                  render={({ field }) => (
                    <FormTextField
                      label="MCP endpoint"
                      value={(field.value as string) ?? ""}
                      placeholder="https://example.com/mcp"
                      onValueChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="headers"
                  render={({ field }) => (
                    <FormTextAreaField
                      label="Headers"
                      value={(field.value as string) ?? ""}
                      placeholder="Header: value"
                      rows={4}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </Flex>
            )}

            <FormFieldError>{submitError}</FormFieldError>

            <DialogSaveFooterActions
              isSubmitting={isSubmitting}
              submitText="Save MCP"
              cancelDisabled={isSubmitting}
            />
          </form>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function cleanMcp(item: MCPResourceDraft): MCPResourceDraft {
  return item.transport === "stdio" ? { ...item, endpoint: "", headers: "" } : { ...item, command: "", args: "", env: "" };
}

const emptyItem: MCPResourceDraft = {
  id: "",
  name: "",
  transport: "stdio",
  command: "",
  args: "",
  env: "",
  endpoint: "",
  headers: ""
};
