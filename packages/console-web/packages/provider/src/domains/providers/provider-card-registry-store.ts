import type { ComponentType } from "react";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { ProviderModel, ProviderStatusView } from "./provider-model";
import type { ProviderCardOwner } from "./provider-card-capability";
import type { ProviderOwnerObservabilityModel } from "./provider-owner-observability-model";
import { normalizeProviderOwnerId } from "./provider-owner-id";

export type ProviderCardRendererContext = {
  provider: ProviderView;
  providerViewModel: ProviderModel;
  owner: ProviderCardOwner;
  observability: ProviderOwnerObservabilityModel | null;
  observabilityError?: unknown;
  isLoading: boolean;
  status?: ProviderStatusView | null;
};

export type ProviderCardRenderer = ComponentType<ProviderCardRendererContext>;

export type ProviderCardRendererOwner =
  | { kind: "cli"; cliId: string }
  | { kind: "vendor"; vendorId: string };

export type ProviderCardRendererBinding = {
  owner: ProviderCardRendererOwner;
  render: ProviderCardRenderer;
};

const providerCardRegistry = new Map<string, ProviderCardRenderer>();

export function registerProviderCardRenderer(binding: ProviderCardRendererBinding) {
  const key = providerCardOwnerKey(binding.owner);
  if (!key || providerCardRegistry.has(key)) {
    return;
  }
  providerCardRegistry.set(key, binding.render);
}

export function resolveRegisteredProviderCardRenderer(owner: ProviderCardOwner | ProviderCardRendererOwner | null) {
  if (!owner) {
    return null;
  }
  const key = providerCardOwnerKey(owner);
  if (!key) {
    return null;
  }
  return providerCardRegistry.get(key) || null;
}

function providerCardOwnerKey(owner: ProviderCardOwner | ProviderCardRendererOwner) {
  if (owner.kind === "cli") {
    const cliId = normalizeProviderOwnerId(owner.cliId);
    return cliId ? `cli:${cliId}` : "";
  }
  if (owner.kind === "vendor") {
    const vendorId = normalizeProviderOwnerId(owner.vendorId);
    return vendorId ? `vendor:${vendorId}` : "";
  }
  return "";
}
