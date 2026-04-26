import { jsonFetcher, jsonRequest } from "@code-code/console-web-ui";
import useSWR from "swr";
import { mutate as mutateSWR } from "swr";

import type {
  ProviderObservability,
  ProviderObservabilityView,
  ProviderObservabilityProbeAllResponse,
  ProviderObservabilitySummary,
  ProviderObservabilityWindow,
} from "./api-types";

const providerObservabilityPath = "/api/providers/observability";

export function useProviderObservabilitySummary(window: ProviderObservabilityWindow = "15m") {
  const key = `${providerObservabilityPath}/summary?window=${encodeURIComponent(window)}`;
  const { data, error, isLoading, mutate } = useSWR<ProviderObservabilitySummary>(key, jsonFetcher<ProviderObservabilitySummary>);
  return {
    summary: data,
    error,
    isLoading,
    isError: Boolean(error),
    mutate,
  };
}

export function useProviderObservability(
  providerId?: string,
  window: ProviderObservabilityWindow = "1h",
  view: ProviderObservabilityView = "full",
) {
  const normalizedProviderID = providerId?.trim() || "";
  const key = normalizedProviderID ? providerObservabilityRequestKey(normalizedProviderID, window, view) : null;
  const { data, error, isLoading, mutate } = useSWR<ProviderObservability>(
    key,
    jsonFetcher<ProviderObservability>,
    {
      keepPreviousData: true,
      refreshInterval: providerObservabilityRefreshInterval(view),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  return {
    detail: data,
    error,
    isLoading,
    isError: Boolean(error),
    mutate,
  };
}

export async function probeAllProviderObservability() {
  return jsonRequest<ProviderObservabilityProbeAllResponse>(`${providerObservabilityPath}:probe-all`, {
    method: "POST",
  });
}

export async function probeProvidersObservability(providerIds: string[]) {
  return jsonRequest<ProviderObservabilityProbeAllResponse>(`${providerObservabilityPath}:probe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerIds }),
  });
}

export async function pullProviderObservability(providerId: string, window: ProviderObservabilityWindow = "1h") {
  const normalizedProviderID = providerId.trim();
  if (!normalizedProviderID) {
    return;
  }
  const statusKey = providerObservabilityRequestKey(normalizedProviderID, window, "status");
  const cardKey = providerObservabilityRequestKey(normalizedProviderID, window, "card");
  const [statusDetail, cardDetail] = await Promise.all([
    jsonRequest<ProviderObservability>(statusKey),
    jsonRequest<ProviderObservability>(cardKey),
  ]);
  await Promise.all([
    mutateSWR(statusKey, statusDetail, { revalidate: false }),
    mutateSWR(cardKey, cardDetail, { revalidate: false }),
  ]);
}

export async function mutateProviderObservability(
  providerId?: string,
) {
  const normalizedProviderID = providerId?.trim() || "";
  if (!normalizedProviderID) {
    await mutateSWR((key) => typeof key === "string" && key.startsWith(providerObservabilityPath));
    return;
  }
  await mutateSWR((key) => (
    isProviderObservabilitySummaryKey(key) ||
    isProviderImmediateObservabilityKey(key, normalizedProviderID)
  ));
}

function isProviderObservabilitySummaryKey(key: unknown) {
  return typeof key === "string" && key.startsWith(`${providerObservabilityPath}/summary?`);
}

function isProviderImmediateObservabilityKey(key: unknown, providerId: string) {
  return isProviderObservabilityKey(key, providerId);
}

function isProviderObservabilityKey(key: unknown, providerId: string) {
  return typeof key === "string" && key.startsWith(providerObservabilityKeyPrefix(providerId));
}

function providerObservabilityKeyPrefix(providerId: string) {
  return `${providerObservabilityPath}/providers/${encodeURIComponent(providerId)}?`;
}

function providerObservabilityRequestKey(
  providerId: string,
  window: ProviderObservabilityWindow,
  view: ProviderObservabilityView,
) {
  return `${providerObservabilityKeyPrefix(providerId)}window=${encodeURIComponent(window)}&view=${encodeURIComponent(view)}`;
}

function providerObservabilityRefreshInterval(view: ProviderObservabilityView) {
  switch (view) {
    case "status":
      return 5_000;
    case "card":
      return 10_000;
    case "full":
    default:
      return 15_000;
  }
}
