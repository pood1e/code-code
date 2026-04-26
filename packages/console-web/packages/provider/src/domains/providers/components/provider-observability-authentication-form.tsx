import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import { DialogFooterActions, ErrorCalloutIf, FormTextAreaField, FormTextField, requestErrorMessage } from "@code-code/console-web-ui";
import { updateProviderObservabilityAuthentication } from "../api-provider";
import { providerObservabilityAuthPresentation } from "../provider-observability-auth-presentation";
import { providerModel } from "../provider-model";

type Props = {
  provider: ProviderView;
  providerId: string;
  vendorId?: string;
  onSuccess: () => Promise<void> | void;
  onCancel: () => void;
};

type FormValues = {
  values: Record<string, string>;
};

export function ProviderObservabilityAuthenticationForm({
  provider,
  providerId,
  vendorId,
  onSuccess,
  onCancel,
}: Props) {
  const [errorMsg, setErrorMsg] = useState("");
  const presentation = providerObservabilityAuthPresentation(vendorId);
  if (!presentation) {
    return null;
  }
  const defaultValues = useMemo<FormValues>(() => ({
    values: Object.fromEntries(
      presentation.fields.map((field) => [field.key, fieldDefaultValue(provider, field.key, field.defaultValue)]),
    ),
  }), [provider, presentation.fields]);
  const methods = useForm<FormValues>({ defaultValues });

  const submit = methods.handleSubmit(async (data) => {
    setErrorMsg("");
    try {
      const values = normalizeSubmittedObservabilityValues(presentation.schemaId, Object.fromEntries(
        presentation.fields
          .map((field) => [field.key, (data.values?.[field.key] ?? field.defaultValue ?? "").trim()])
          .filter(([, value]) => value !== ""),
      ));
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
        const preservesExistingValue = presentation.schemaId === "google-ai-studio-session";
        const common = {
          key: field.key,
          label: field.label,
          description: preservesExistingValue ? appendKeepExistingHint(field.description) : field.description,
          error,
          placeholder: field.placeholder,
        };
        const register = methods.register(`values.${field.key}` as const, {
          required: field.required && !preservesExistingValue ? `${field.label} is required` : false,
        });
        if (field.multiline) {
          return (
            <Controller
              key={field.key}
              name={`values.${field.key}` as const}
              control={methods.control}
              rules={{ required: field.required && !preservesExistingValue ? `${field.label} is required` : false }}
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

function fieldDefaultValue(provider: ProviderView, fieldKey: string, fallback: string | undefined) {
  if (fieldKey === "cookie" || fieldKey === "response_set_cookie" || fieldKey === "authorization") {
    return fallback ?? "";
  }
  return providerModel(provider).oauthFieldValue(fieldKey) ?? fallback ?? "";
}

function normalizeSubmittedObservabilityValues(schemaId: string, values: Record<string, string>) {
  if (schemaId !== "google-ai-studio-session") {
    return values;
  }
  const { response_set_cookie: responseSetCookie, ...storedValues } = values;
  if (!responseSetCookie?.trim()) {
    return storedValues;
  }
  const mergedCookie = mergeCookieHeader(storedValues.cookie || "", responseSetCookie);
  if (mergedCookie) {
    storedValues.cookie = mergedCookie;
  }
  return storedValues;
}

function mergeCookieHeader(requestCookie: string, responseSetCookie: string) {
  const cookies = new Map<string, string>();
  for (const pair of requestCookie.split(";")) {
    applyCookiePair(cookies, pair);
  }
  for (const line of responseSetCookie.split(/\r?\n/)) {
    const headerValue = line.replace(/^set-cookie:\s*/i, "").trim();
    const pair = headerValue.split(";")[0] || "";
    applyCookiePair(cookies, pair);
  }
  return Array.from(cookies.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function applyCookiePair(cookies: Map<string, string>, pair: string) {
  const trimmed = pair.trim();
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return;
  }
  const key = trimmed.slice(0, separatorIndex).trim();
  const value = trimmed.slice(separatorIndex + 1).trim();
  if (!key) {
    return;
  }
  if (!value) {
    cookies.delete(key);
    return;
  }
  cookies.set(key, value);
}
