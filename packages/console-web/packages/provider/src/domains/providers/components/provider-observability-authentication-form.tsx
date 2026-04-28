import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActiveQueryInputPersistence } from "@code-code/agent-contract/observability/v1";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import { DialogFooterActions, ErrorCalloutIf, FormTextAreaField, FormTextField, requestErrorMessage } from "@code-code/console-web-ui";
import { updateProviderObservabilityAuthentication } from "../api-provider";
import type { ProviderObservabilityAuthField, ProviderObservabilityAuthPresentation } from "../provider-observability-auth-presentation";
import { providerModel } from "../provider-model";

type Props = {
  provider: ProviderView;
  providerId: string;
  presentation: ProviderObservabilityAuthPresentation;
  onSuccess: () => Promise<void> | void;
  onCancel: () => void;
};

type FormValues = {
  values: Record<string, string>;
};

export function ProviderObservabilityAuthenticationForm({
  provider,
  providerId,
  presentation,
  onSuccess,
  onCancel,
}: Props) {
  const [errorMsg, setErrorMsg] = useState("");
  const defaultValues = useMemo<FormValues>(() => ({
    values: Object.fromEntries(
      presentation.fields.map((field) => [field.key, fieldDefaultValue(provider, field)]),
    ),
  }), [provider, presentation.fields]);
  const methods = useForm<FormValues>({ defaultValues });

  const submit = methods.handleSubmit(async (data) => {
    setErrorMsg("");
    try {
      const values = Object.fromEntries(
        presentation.fields
          .map((field) => [field.key, (data.values?.[field.key] ?? field.defaultValue ?? "").trim()])
          .filter(([, value]) => value !== ""),
      );
      if (Object.keys(values).length === 0) {
        setErrorMsg("Enter at least one observability authentication value.");
        return;
      }
      await updateProviderObservabilityAuthentication(providerId, {
        schemaId: presentation.schemaId,
        requiredKeys: presentation.requiredKeys,
        values,
      });
      await onSuccess();
    } catch (error: unknown) {
      setErrorMsg(requestErrorMessage(error, "Failed to update observability authentication."));
    }
  });

  return (
    <form onSubmit={submit}>
      {presentation.fields.map((field) => {
        const error = methods.formState.errors.values?.[field.key]?.message;
        const preservesExistingValue = field.persistence === ActiveQueryInputPersistence.STORED_MATERIAL;
        const common = {
          label: field.label,
          description: preservesExistingValue ? appendKeepExistingHint(field.description) : field.description,
          error,
          placeholder: field.placeholder,
        };
        const register = methods.register(`values.${field.key}` as const, {
          required: false,
        });
        if (field.multiline) {
          return (
            <Controller
              key={field.key}
              name={`values.${field.key}` as const}
              control={methods.control}
              rules={{ required: false }}
              render={({ field: controllerField }) => (
                <FormTextAreaField
                  {...common}
                  rows={5}
                  value={controllerField.value ?? ""}
                  onValueChange={controllerField.onChange}
                />
              )}
            />
          );
        }
        return (
          <FormTextField
            key={field.key}
            {...common}
            type={field.sensitive ? "password" : "text"}
            autoComplete="off"
            inputProps={register}
          />
        );
      })}

      <ErrorCalloutIf error={errorMsg} />

      <DialogFooterActions
        isSubmitting={methods.formState.isSubmitting}
        submitText={presentation.providerActionLabel.replace(/…$/, "")}
        onCancel={onCancel}
      />
    </form>
  );
}

function appendKeepExistingHint(description: string | undefined) {
  const hint = "Leave blank to keep the current saved value.";
  return description ? `${description} ${hint}` : hint;
}

function fieldDefaultValue(provider: ProviderView, field: ProviderObservabilityAuthField) {
  if (field.sensitive || field.persistence !== ActiveQueryInputPersistence.STORED_MATERIAL) {
    return field.defaultValue ?? "";
  }
  return providerModel(provider).oauthFieldValue(field.key) ?? field.defaultValue ?? "";
}
