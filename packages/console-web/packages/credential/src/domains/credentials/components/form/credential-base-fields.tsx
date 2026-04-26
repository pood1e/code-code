import { Controller, useFormContext } from "react-hook-form";
import { FormSelectField, FormTextField } from "@code-code/console-web-ui";
import { Flex } from "@radix-ui/themes";
import type { ManualCredentialVendorOption } from "../../reference-data";
import { CUSTOM_VENDOR_OPTION, type ManualCredentialFormValues } from "./manual-credential-form";

type CredentialBaseFieldsProps = {
  vendors: ManualCredentialVendorOption[];
};

export function CredentialBaseFields({ vendors }: CredentialBaseFieldsProps) {
  const {
    control,
    register,
    watch,
    formState: { errors }
  } = useFormContext<ManualCredentialFormValues>();
  const vendorId = watch("vendorId") || CUSTOM_VENDOR_OPTION;

  return (
    <Flex direction="column" gap="4">
      <FormTextField
        label="Display Name"
        error={errors.displayName ? errors.displayName.message : null}
        placeholder="e.g. OpenAI Production Key"
        inputProps={register("displayName", { required: "Name is required" })}
      />

      <Controller
        name="vendorId"
        control={control}
        render={({ field }) => (
          <FormSelectField
            label="Vendor"
            value={field.value || CUSTOM_VENDOR_OPTION}
            items={[
              { value: CUSTOM_VENDOR_OPTION, label: "Custom" },
              ...vendors.map((vendor) => ({ value: vendor.vendorId, label: vendor.displayName })),
            ]}
            onValueChange={field.onChange}
          />
        )}
      />

      <FormTextField
        label="API Key"
        type="password"
        error={errors.apiKey ? errors.apiKey.message : null}
        placeholder={vendorId === CUSTOM_VENDOR_OPTION ? "Enter API key" : "sk-..."}
        inputProps={register("apiKey", {
          required: "API key is required"
        })}
      />
    </Flex>
  );
}
