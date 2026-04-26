import { ProviderSurfaceKind } from "@code-code/agent-contract/provider/v1";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import type { CLI, Vendor } from "@code-code/agent-contract/platform/support/v1";
import type { ProviderObservabilityOwner } from "./provider-owner-observability-model";
import { findCLI, findVendor } from "./provider-capability-lookup";
import { providerSurfaceRuntimeCLIID, providerSurfaceRuntimeKind } from "./provider-surface-binding-view";
import { normalizeProviderOwnerId } from "./provider-owner-id";

export type ResolvedProviderObservabilityOwner = ProviderObservabilityOwner & {
  providerSurfaceBindingId?: string;
};

export function resolveProviderObservabilityOwner(surface: ProviderSurfaceBindingView | null | undefined): ProviderObservabilityOwner | null {
  const runtime = surface?.runtime;
  if (!runtime) {
    return null;
  }
  const surfaceId = surface?.surfaceId?.trim() || "";
  if (!surfaceId) {
    return null;
  }
  if (providerSurfaceRuntimeKind(runtime) === ProviderSurfaceKind.CLI) {
    const cliId = normalizeProviderOwnerId(providerSurfaceRuntimeCLIID(runtime));
    return cliId ? { kind: "cli", cliId, surfaceId } : null;
  }
  if (providerSurfaceRuntimeKind(runtime) === ProviderSurfaceKind.API) {
    const vendorId = normalizeProviderOwnerId(surface?.vendorId || "");
    return vendorId ? { kind: "vendor", vendorId, surfaceId } : null;
  }
  return null;
}

export function surfaceSupportsActiveQuery(
  surface: ProviderSurfaceBindingView | null | undefined,
  clis: CLI[],
  vendors: Vendor[],
) {
  return ownerSupportsActiveQuery(
    resolveProviderObservabilityOwner(surface),
    clis,
    vendors,
  );
}

export function providerSupportsActiveQuery(
  provider: ProviderView | null | undefined,
  clis: CLI[],
  vendors: Vendor[],
) {
  return Boolean(resolveProviderActiveQueryOwner(provider, clis, vendors));
}

export function providerActiveQueryProviderIDs(
  provider: ProviderView | null | undefined,
  clis: CLI[],
  vendors: Vendor[],
) {
  const providerID = (provider?.providerId || "").trim();
  if (!providerID) {
    return [];
  }
  return resolveProviderActiveQueryOwner(provider, clis, vendors) ? [providerID] : [];
}

export function resolveProviderActiveQueryOwner(
  provider: ProviderView | null | undefined,
  clis: CLI[],
  vendors: Vendor[],
): ResolvedProviderObservabilityOwner | null {
  for (const surface of provider?.surfaces || []) {
    const owner = resolveProviderObservabilityOwner(surface);
    if (!owner || !ownerSupportsActiveQuery(owner, clis, vendors)) {
      continue;
    }
    return { ...owner, providerSurfaceBindingId: surface.surfaceId };
  }
  return null;
}

function ownerSupportsActiveQuery(
  owner: ProviderObservabilityOwner | null,
  clis: CLI[],
  vendors: Vendor[],
) {
  if (!owner) {
    return false;
  }
  const capability = owner.kind === "cli"
    ? cliObservabilityCapability(findCLI(clis, owner.cliId), owner.surfaceId)
    : vendorObservabilityCapability(findVendor(vendors, owner.vendorId), owner.surfaceId);
  return capability?.profiles?.some((profile) => profile.collection.case === "activeQuery") ?? false;
}

function cliObservabilityCapability(cli: CLI | undefined, surfaceId: string) {
  if (!cli?.oauth?.observability) {
    return undefined;
  }
  const bindingSurfaceId = cli.oauth.providerBinding?.surfaceId?.trim() || "";
  if (!bindingSurfaceId || bindingSurfaceId !== surfaceId.trim()) {
    return undefined;
  }
  return cli.oauth.observability;
}

function vendorObservabilityCapability(vendor: Vendor | undefined, surfaceId: string) {
  const normalizedSurfaceId = surfaceId.trim();
  return vendor?.providerBindings.find((binding) => (
    binding.providerBinding?.surfaceId?.trim() === normalizedSurfaceId &&
    binding.observability?.profiles?.some((profile) => profile.collection.case === "activeQuery")
  ))?.observability;
}
