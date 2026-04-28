import {
  ActiveQueryInputControl,
  ActiveQueryInputPersistence,
  ActiveQueryInputValueTransform,
  type ActiveQueryInputField,
  type ActiveQueryInputForm,
} from "@code-code/agent-contract/observability/v1";
import type { Vendor } from "@code-code/agent-contract/platform/support/v1";
import { findVendor } from "./provider-capability-lookup";

export type ProviderObservabilityAuthField = {
  key: string;
  label: string;
  placeholder: string;
  description?: string;
  defaultValue?: string;
  required?: boolean;
  sensitive?: boolean;
  multiline?: boolean;
  persistence: ActiveQueryInputPersistence;
  targetFieldId?: string;
  transform: ActiveQueryInputValueTransform;
};

export type ProviderObservabilityAuthPresentation = {
  dialogTitle: string;
  providerActionLabel: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  schemaId: string;
  requiredKeys: string[];
  fields: ProviderObservabilityAuthField[];
  separateProviderUpdate: boolean;
};

export function providerObservabilityAuthPresentation(
  vendorId?: string | null,
  vendors: Vendor[] = [],
  surfaceId?: string | null,
): ProviderObservabilityAuthPresentation | null {
  const form = providerObservabilityInputForm(vendorId, vendors, surfaceId);
  if (!form) {
    return null;
  }
  const fields = form.fields
    .map(providerObservabilityAuthField)
    .filter((field): field is ProviderObservabilityAuthField => field !== null);
  if (fields.length === 0) {
    return null;
  }
  const firstField = fields[0];
  return {
    dialogTitle: form.title.trim() || "Update Observability Authentication",
    providerActionLabel: form.actionLabel.trim() || "Update Observability Authentication",
    description: form.description.trim(),
    fieldLabel: firstField.label,
    placeholder: firstField.placeholder,
    schemaId: form.schemaId.trim(),
    requiredKeys: fields
      .filter((field) => field.persistence === ActiveQueryInputPersistence.STORED_MATERIAL && field.required)
      .map((field) => field.key),
    fields,
    separateProviderUpdate: true,
  };
}

function providerObservabilityInputForm(
  vendorId?: string | null,
  vendors: Vendor[] = [],
  surfaceId?: string | null,
): ActiveQueryInputForm | null {
  const vendor = findVendor(vendors, vendorId || "");
  if (!vendor) {
    return null;
  }
  const normalizedSurfaceId = surfaceId?.trim() || "";
  for (const binding of vendor.providerBindings) {
    const bindingSurfaceId = binding.providerBinding?.surfaceId?.trim() || "";
    if (normalizedSurfaceId && bindingSurfaceId !== normalizedSurfaceId) {
      continue;
    }
    for (const profile of binding.observability?.profiles || []) {
      if (profile.collection.case !== "activeQuery") {
        continue;
      }
      const form = profile.collection.value.inputForm;
      if (form?.schemaId?.trim()) {
        return form;
      }
    }
  }
  return null;
}

function providerObservabilityAuthField(field: ActiveQueryInputField): ProviderObservabilityAuthField | null {
  const key = field.fieldId.trim();
  const label = field.label.trim();
  if (!key || !label) {
    return null;
  }
  return {
    key,
    label,
    description: field.description.trim() || undefined,
    placeholder: field.placeholder.trim(),
    defaultValue: field.defaultValue.trim() || undefined,
    required: field.required,
    sensitive: field.sensitive || field.control === ActiveQueryInputControl.PASSWORD,
    multiline: field.control === ActiveQueryInputControl.TEXTAREA,
    persistence: field.persistence,
    targetFieldId: field.targetFieldId.trim() || undefined,
    transform: field.transform || ActiveQueryInputValueTransform.IDENTITY,
  };
}
