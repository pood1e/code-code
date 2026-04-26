import { Flex } from "@radix-ui/themes";
import type { UseFormReturn } from "react-hook-form";
import {
  type ProviderConnectOption
} from "../provider-connect-options";
import {
  providerConnectFormModel,
  type ProviderConnectFormValues,
} from "../provider-connect-form-model";
import { DialogFooterActions, ErrorCalloutIf, FormTextField } from "@code-code/console-web-ui";
import { ProviderConnectAPIKeyFields } from "./provider-connect-api-key-fields";
import { ProviderConnectOptionSelector } from "./provider-connect-option-selector";

type Props = {
  connectOptions: ProviderConnectOption[];
  selectedOption?: ProviderConnectOption;
  connectOptionLabel?: string;
  submitLabel?: string;
  showConnectOptionSelector?: boolean;
  methods: UseFormReturn<ProviderConnectFormValues>;
  submitError: string;
  onSubmit: () => void;
  onConnectOptionChange: (connectOptionId: string) => void;
  onCancel: () => void;
};

export function ProviderConnectForm({
  connectOptions,
  selectedOption,
  connectOptionLabel = "Add Method",
  submitLabel,
  showConnectOptionSelector = true,
  methods,
  submitError,
  onSubmit,
  onConnectOptionChange,
  onCancel,
}: Props) {
  const formModel = providerConnectFormModel(selectedOption);

  return (
    <form onSubmit={onSubmit}>
      <Flex direction="column" gap="3" mt="3">
        <ErrorCalloutIf error={submitError} />

        {showConnectOptionSelector ? (
          <ProviderConnectOptionSelector
            connectOptions={connectOptions}
            selectedOptionId={selectedOption?.id ?? ""}
            label={connectOptionLabel}
            onChange={onConnectOptionChange}
          />
        ) : null}

        <FormTextField
          label="Name"
          htmlFor="provider-connect-name"
          error={methods.formState.errors.displayName?.message}
          id="provider-connect-name"
          placeholder={formModel.displayNamePlaceholder()}
          inputProps={methods.register("displayName", { required: "Name is required" })}
        />

        {formModel.showAPIKeyFields() ? (
          <ProviderConnectAPIKeyFields
            selectedOption={selectedOption}
            methods={methods}
            protocolOptions={formModel.protocolOptions()}
          />
        ) : null}

        <DialogFooterActions
          isSubmitting={methods.formState.isSubmitting}
          submitText={formModel.submitLabel(submitLabel)}
          onCancel={onCancel}
        />
      </Flex>
    </form>
  );
}
