import { Box } from "@radix-ui/themes";
import type { UseFormReturn } from "react-hook-form";
import { FormSelectField, FormTextField } from "@code-code/console-web-ui";
import { isCustomAPIKeyConnectOption, type ProviderConnectOption } from "../provider-connect-options";
import { type ProviderConnectProtocolOption, type ProviderConnectFormValues } from "../provider-connect-form-model";

type Props = {
  selectedOption?: ProviderConnectOption;
  methods: UseFormReturn<ProviderConnectFormValues>;
  protocolOptions: readonly ProviderConnectProtocolOption[];
};

export function ProviderConnectAPIKeyFields({ selectedOption, methods, protocolOptions }: Props) {
  return (
    <>
      <FormTextField
        label="API Key"
        htmlFor="provider-connect-api-key"
        error={methods.formState.errors.apiKey?.message}
        id="provider-connect-api-key"
        type="password"
        autoComplete="current-password"
        placeholder="sk-…"
        inputProps={methods.register("apiKey", { required: "API key is required" })}
      />

      {isCustomAPIKeyConnectOption(selectedOption) ? (
        <>
          <FormTextField
            label="Base URL"
            htmlFor="provider-connect-base-url"
            error={methods.formState.errors.baseUrl?.message}
            id="provider-connect-base-url"
            placeholder="https://api.example.com/v1"
            inputProps={methods.register("baseUrl", {
              validate: (value) => value.trim() ? true : "Base URL is required",
            })}
          />

          <Box>
            <FormSelectField
              label="Protocol"
              value={methods.watch("protocol") || protocolOptions[0].value}
              items={protocolOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              triggerStyle={{ width: "100%" }}
              onValueChange={(value) => methods.setValue("protocol", value, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
            />
          </Box>
        </>
      ) : null}
    </>
  );
}
