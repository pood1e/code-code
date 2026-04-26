import { create, fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import {
  ListProvidersResponseSchema,
  type ProviderView,
} from "@code-code/agent-contract/platform/management/v1";
import useSWR from "swr";
import { jsonFetcher, protobufJsonReadOptions } from "@code-code/console-web-ui";

const providersPath = "/api/providers";

export function useProviders() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(providersPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListProvidersResponseSchema, data, protobufJsonReadOptions) : undefined;
  const upsertProvider = (provider: ProviderView) => mutate((current) => {
    const currentResponse = current
      ? fromJson(ListProvidersResponseSchema, current, protobufJsonReadOptions)
      : create(ListProvidersResponseSchema);
    return toJson(ListProvidersResponseSchema, create(ListProvidersResponseSchema, {
      items: [
        ...currentResponse.items.filter((item) => item.providerId !== provider.providerId),
        provider,
      ],
    }));
  }, { revalidate: true });
  return {
    providers: response?.items || ([] as ProviderView[]),
    error,
    isLoading,
    isError: Boolean(error),
    mutate,
    upsertProvider,
  };
}
