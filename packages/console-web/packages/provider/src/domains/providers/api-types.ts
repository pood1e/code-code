import type { ProviderProtocolValue } from "./provider-protocol";
import type { ModelRef } from "@code-code/agent-contract/model/v1";

export type ConnectProviderWithVendorAPIKeyDraft = {
  vendorId: string;
  displayName?: string;
  apiKey: string;
};

export type ConnectProviderWithCustomAPIKeyDraft = {
  displayName?: string;
  apiKey: string;
  baseUrl: string;
  protocol: ProviderProtocolValue;
};

export type ConnectProviderWithOAuthDraft = {
  cliId: string;
  displayName?: string;
};

export type ProviderModelRegistryBindingDraft = {
  vendorId?: string;
  providerModelIds: string[];
};

export type ProviderModelRegistryResolution = {
  providerModelIds: string[];
  modelRefByProviderModelId: Record<string, ModelRef>;
};

export type ProviderObservabilityWindow = "5m" | "15m" | "1h" | "6h" | "24h";
export type ProviderObservabilityView = "full" | "status" | "card";

export type ProviderObservabilitySummary = {
  window?: string;
  generatedAt?: string;
  items?: ProviderOwnerObservabilityCard[];
};

export type ProviderOwnerObservabilityCard = {
  cliId?: string;
  displayName?: string;
  iconUrl?: string;
  owner?: string;
  vendorId?: string;
  providerCount?: number;
  instanceCount?: number;
  probe?: {
    total?: number;
    executed?: number;
    throttled?: number;
    authBlocked?: number;
    unsupported?: number;
    failed?: number;
  };
  refresh?: {
    ready?: number;
    total?: number;
  };
  runtime?: {
    total?: number;
    status2xx?: number;
    status3xx?: number;
    status4xx?: number;
    status5xx?: number;
  };
};

export type ProviderObservability = {
  providerId?: string;
  window?: string;
  generatedAt?: string;
  items?: ProviderOwnerObservabilityItem[];
};

export type ProviderObservabilityProbeAllResponse = {
  triggeredCount?: number;
  workflowId?: string;
  message?: string;
  results?: Array<{
    providerId?: string;
    owner?: string;
    cliId?: string;
    vendorId?: string;
    outcome?: string;
    message?: string;
    lastAttemptAt?: string;
    nextAllowedAt?: string;
  }>;
};

export type ProviderOwnerObservabilityItem = {
  owner?: string;
  cliId?: string;
  displayName?: string;
  iconUrl?: string;
  vendorId?: string;
  providerSurfaceBindingIds?: string[];
  probeOutcomes?: Array<{ label?: string; value?: number }>;
  probeOutcomeSeries?: Array<{ label?: string; points?: Array<{ timestamp?: string; value?: number }> }>;
  refreshAttempts?: Array<{ label?: string; value?: number }>;
  refreshAttemptSeries?: Array<{ label?: string; points?: Array<{ timestamp?: string; value?: number }> }>;
  runtimeRequests?: Array<{ label?: string; value?: number }>;
  runtimeRequestSeries?: Array<{ label?: string; points?: Array<{ timestamp?: string; value?: number }> }>;
  runtimeRateLimits?: Array<{ label?: string; value?: number }>;
  runtimeRateLimitSeries?: Array<{ label?: string; points?: Array<{ timestamp?: string; value?: number }> }>;
  runtimeMetrics?: Array<{
    metricName?: string;
    displayName?: string;
    unit?: string;
    category?: string;
    rows?: Array<{ labels?: Record<string, string>; value?: number }>;
  }>;
  lastProbeRun?: Array<{ providerSurfaceBindingId?: string; timestamp?: string }>;
  lastProbeOutcome?: Array<{ providerSurfaceBindingId?: string; value?: number }>;
  lastProbeReason?: Array<{ providerSurfaceBindingId?: string; reason?: string }>;
  nextProbeAllowed?: Array<{ providerSurfaceBindingId?: string; timestamp?: string }>;
  authUsable?: Array<{ providerSurfaceBindingId?: string; value?: number }>;
  credentialLastUsed?: Array<{ providerSurfaceBindingId?: string; timestamp?: string }>;
  refreshReady?: Array<{ providerSurfaceBindingId?: string; value?: number }>;
  lastRuntimeSeen?: Array<{ providerSurfaceBindingId?: string; timestamp?: string }>;
};
