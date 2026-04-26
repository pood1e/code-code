import { ModelService, type ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import { ProviderService, type VendorView } from "@code-code/agent-contract/platform/provider/v1";
import useSWR from "swr";
import { connectClient } from "@code-code/console-web-ui";

export const DEFAULT_MODEL_PAGE_SIZE = 20;

const modelServiceClient = connectClient(ModelService);
const providerServiceClient = connectClient(ProviderService);

export type ModelListQuery = {
  filter?: string;
  pageSize?: number;
  pageToken?: string;
};

export function useModels(query: ModelListQuery, enabled = true) {
  const key = enabled ? getModelsKey(query) : null;
  const { data, error, isLoading, mutate } = useSWR(key, () => listModels(query));
  return {
    models: data?.items || ([] as ModelRegistryEntry[]),
    nextPageToken: data?.nextPageToken || "",
    totalCount: Number(data?.totalCount ?? 0n),
    isLoading,
    isError: !!error,
    error,
    mutate
  };
}

export function useVendors() {
  const { data, error, isLoading, mutate } = useSWR("connect:provider-vendors", () => providerServiceClient.listVendors({}));
  return {
    vendors: data?.items || ([] as VendorView[]),
    isLoading,
    isError: !!error,
    error,
    mutate
  };
}

function getModelsKey(query: ModelListQuery) {
  const params = new URLSearchParams();
  params.set("pageSize", String(query.pageSize || DEFAULT_MODEL_PAGE_SIZE));
  if (query.pageToken) {
    params.set("pageToken", query.pageToken);
  }
  if (query.filter) {
    params.set("filter", query.filter);
  }
  return `connect:model-definitions?${params.toString()}`;
}

function listModels(query: ModelListQuery) {
  return modelServiceClient.listModelDefinitions({
    pageSize: query.pageSize || DEFAULT_MODEL_PAGE_SIZE,
    pageToken: query.pageToken || "",
    filter: query.filter || ""
  });
}
