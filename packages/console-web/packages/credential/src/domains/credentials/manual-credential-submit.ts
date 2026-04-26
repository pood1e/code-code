import type { CredentialUpsertDraft } from "./api";
import { buildCredentialId } from "./credential-id";
import {
  CUSTOM_VENDOR_OPTION,
  type ManualCredentialFormValues
} from "./components/form/manual-credential-form";

export const defaultManualCredentialValues: ManualCredentialFormValues = {
  displayName: "",
  vendorId: CUSTOM_VENDOR_OPTION,
  apiKey: "",
};

export function buildManualCredentialDraft(data: ManualCredentialFormValues): CredentialUpsertDraft {
  const isCustomVendor = data.vendorId === CUSTOM_VENDOR_OPTION;
  return {
    credentialId: buildCredentialId(data.displayName),
    displayName: data.displayName,
    kind: "CREDENTIAL_KIND_API_KEY",
    purpose: "CREDENTIAL_PURPOSE_UNSPECIFIED",
    vendorId: isCustomVendor ? "" : data.vendorId,
    cliId: "",
    material: {
      case: "apiKeyMaterial",
      value: {
        apiKey: data.apiKey,
      }
    }
  };
}
