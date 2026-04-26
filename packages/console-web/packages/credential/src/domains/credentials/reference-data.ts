import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import {
  ListCLIsResponseSchema,
  ListProviderSurfacesResponseSchema,
  ListVendorsResponseSchema,
  type CLI,
  type Vendor
} from "@code-code/agent-contract/platform/support/v1";
import type { ProviderSurface } from "@code-code/agent-contract/provider/v1";
import useSWR from "swr";
import { jsonFetcher, protobufJsonReadOptions } from "@code-code/console-web-ui";

const vendorsPath = "/api/support/vendors";
const clisPath = "/api/support/clis";
const providerSurfacesPath = "/api/support/provider-surfaces";

export type ManualCredentialVendorOption = {
  vendorId: string;
  displayName: string;
  vendor: Vendor;
};

export function useProviderVendors() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(vendorsPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListVendorsResponseSchema, data, protobufJsonReadOptions) : undefined;
  return {
    vendors: response?.items || ([] as Vendor[]),
    error,
    isLoading,
    isError: !!error,
    mutate
  };
}

export function useProviderCLIs() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(clisPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListCLIsResponseSchema, data, protobufJsonReadOptions) : undefined;
  return {
    clis: response?.items || ([] as CLI[]),
    error,
    isLoading,
    isError: !!error,
    mutate
  };
}

export function useProviderSurfaces() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(providerSurfacesPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListProviderSurfacesResponseSchema, data, protobufJsonReadOptions) : undefined;
  return {
    surfaces: response?.items || ([] as ProviderSurface[]),
    error,
    isLoading,
    isError: !!error,
    mutate
  };
}

export function listManualCredentialVendorOptions(vendors: Vendor[]): ManualCredentialVendorOption[] {
  return vendors
    .filter((item) => Boolean(item.vendor?.vendorId) && item.providerBindings.some((binding) => binding.surfaceTemplates.length > 0))
    .map((item) => ({
      vendorId: item.vendor!.vendorId,
      displayName: item.vendor!.displayName || item.vendor!.vendorId,
      vendor: item
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function listOAuthCLIs(clis: CLI[]) {
  return clis
    .filter((item) => Boolean(item.oauth))
    .sort((left, right) => {
      const leftRecommended = left.oauth?.recommended === true;
      const rightRecommended = right.oauth?.recommended === true;
      if (leftRecommended !== rightRecommended) {
        return leftRecommended ? -1 : 1;
      }
      return left.displayName.localeCompare(right.displayName);
    });
}
