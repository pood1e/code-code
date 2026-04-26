import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import {
  ListCLIsResponseSchema,
  type CLI,
} from "@code-code/agent-contract/platform/support/v1";
import type { ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import {
  ListProviderSurfaceBindingsResponseSchema,
} from "@code-code/agent-contract/platform/management/v1";
import { ProviderService, type VendorView } from "@code-code/agent-contract/platform/provider/v1";
import { useMemo } from "react";
import useSWR from "swr";
import { connectClient, jsonFetcher, protobufJsonReadOptions } from "@code-code/console-web-ui";
import { EMPTY_SESSION_RUNTIME_OPTIONS, type CLIReference, type SessionRuntimeOptions } from "./types";

const providerSurfacesPath = "/api/providers/surface-bindings";
const clisPath = "/api/support/clis";
const sessionRuntimeOptionsPath = "/api/chats/session-runtime-options";
const providerServiceClient = connectClient(ProviderService);

export function useVendors() {
  const { data, error, isLoading, mutate } = useSWR("connect:provider-vendors", () => providerServiceClient.listVendors({}));
  return {
    vendors: data?.items || ([] as VendorView[]),
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}

export function useProviderSurfaces() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(providerSurfacesPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListProviderSurfaceBindingsResponseSchema, data, protobufJsonReadOptions) : undefined;
  return {
    providerSurfaces: response?.items || ([] as ProviderSurfaceBindingView[]),
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}

export function useCLIReferences() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(clisPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListCLIsResponseSchema, data, protobufJsonReadOptions) : undefined;
  return {
    clis: (response?.items || ([] as CLI[])).map(toCLIReference),
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}

export function useSessionRuntimeOptions() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(sessionRuntimeOptionsPath, jsonFetcher<JsonValue>);
  const sessionRuntimeOptions = useMemo(
    () => data ? parseSessionRuntimeOptions(data) : EMPTY_SESSION_RUNTIME_OPTIONS,
    [data],
  );
  return {
    sessionRuntimeOptions,
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}

function toCLIReference(item: CLI): CLIReference {
  return {
    cliId: item.cliId,
    displayName: item.displayName || item.cliId,
    iconUrl: item.iconUrl,
    supportedProviderTypes: item.apiKeyProtocols.map((entry) => Number(entry.protocol))
  };
}

function parseSessionRuntimeOptions(data: JsonValue | undefined): SessionRuntimeOptions {
  const value = (data || {}) as Record<string, unknown>;
  const items = Array.isArray(value.items) ? value.items : [];
  return {
    items: items
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        providerId: stringValue(item.providerId),
        label: stringValue(item.label),
        executionClasses: stringArray(item.executionClasses),
      })),
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
