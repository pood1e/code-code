import { DialogFooterActions, ErrorCalloutIf, FormTextField } from "@code-code/console-web-ui";
import { type UseFormReturn } from "react-hook-form";
import { type ProviderAuthenticationModel } from "../provider-authentication-model";
import type { FormEvent } from "react";

type Props = {
  model: ProviderAuthenticationModel;
  methods: UseFormReturn<{ apiKey: string }, unknown>;
  errorMsg: string;
  isSubmitting: boolean;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  onCancel: () => void;
};

export function ProviderAuthenticationApiKeyForm({
  model,
  methods,
  errorMsg,
  isSubmitting,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <form onSubmit={onSubmit}>
      <FormTextField
        label="API Key"
        htmlFor="provider-auth-api-key"
        error={methods.formState.errors.apiKey?.message}
        id="provider-auth-api-key"
        type="password"
        autoComplete="current-password"
        placeholder={model.apiKeyPlaceholder()}
        inputProps={methods.register("apiKey", { required: "API key is required" })}
      />

      <ErrorCalloutIf error={errorMsg} />

      <DialogFooterActions
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        submitText={model.submitLabel()}
      />
    </form>
  );
}
