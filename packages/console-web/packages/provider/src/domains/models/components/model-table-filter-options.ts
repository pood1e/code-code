import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import "./source-filter-option-registrations";
import {
  listRegisteredSourceFilterOptions,
  registeredSourceFilterOptionLabel,
  type SourceFilterOption
} from "./source-filter-option-registry-store";

type VendorFilterOption = {
  iconUrl?: string;
  label: string;
  value: string;
};

export function buildVendorOptions(vendors: VendorView[]): VendorFilterOption[] {
  return vendors
    .filter((vendor) => Boolean(vendor.vendorId))
    .map((vendor) => ({
      iconUrl: vendor.iconUrl,
      value: vendor.vendorId,
      label: vendor.displayName || vendor.vendorId
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildSourceOptions(): SourceFilterOption[] {
  return listRegisteredSourceFilterOptions();
}

export function sourceOptionLabel(sourceId: string): string {
  return registeredSourceFilterOptionLabel(sourceId);
}
