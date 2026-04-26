import { FormProvider, type UseFormReturn } from "react-hook-form";
import type { ManualCredentialVendorOption } from "../reference-data";
import { DialogSaveFooterActions } from "@code-code/console-web-ui";
import { CredentialBaseFields } from "./form/credential-base-fields";
import type { ManualCredentialFormValues } from "./form/manual-credential-form";

type CredentialFormContentProps = {
  methods: UseFormReturn<ManualCredentialFormValues>;
  vendors: ManualCredentialVendorOption[];
  submitting: boolean;
  onSubmit: (data: ManualCredentialFormValues) => Promise<void>;
  onCancel?: () => void;
};

export function CredentialFormContent({
  methods,
  vendors,
  submitting,
  onSubmit,
  onCancel
}: CredentialFormContentProps) {
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <CredentialBaseFields vendors={vendors} />
        <DialogSaveFooterActions isSubmitting={submitting} onCancel={onCancel} />
      </form>
    </FormProvider>
  );
}
