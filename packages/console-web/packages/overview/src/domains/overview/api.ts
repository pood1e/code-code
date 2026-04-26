import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import {
  ListProvidersResponseSchema,
  type ProviderView,
} from "@code-code/agent-contract/platform/management/v1";
import useSWR from "swr";
import { jsonFetcher, protobufJsonReadOptions } from "@code-code/console-web-ui";

const providersPath = "/api/providers";

export function useOverviewProviderAccounts() {
  const { data, error, isLoading } = useSWR<JsonValue>(providersPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListProvidersResponseSchema, data, protobufJsonReadOptions) : undefined;
  return {
    providerAccounts: response?.items || ([] as ProviderView[]),
    isLoading,
    isError: Boolean(error),
  };
}
