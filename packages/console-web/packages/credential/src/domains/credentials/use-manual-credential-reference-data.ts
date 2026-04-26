import type { UseFormReturn } from "react-hook-form";
import { listManualCredentialVendorOptions, useProviderVendors } from "./reference-data";
import { CUSTOM_VENDOR_OPTION, type ManualCredentialFormValues } from "./components/form/manual-credential-form";

export function useManualCredentialReferenceData(methods: UseFormReturn<ManualCredentialFormValues>) {
  const { vendors } = useProviderVendors();
  const vendorId = methods.watch("vendorId") || CUSTOM_VENDOR_OPTION;
  return {
    vendors: listManualCredentialVendorOptions(vendors),
    vendorId,
  };
}
