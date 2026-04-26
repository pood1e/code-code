import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { CLI, Vendor } from "@code-code/agent-contract/platform/support/v1";
import { providerModel } from "./provider-model";
import { findCLI, findVendor } from "./provider-capability-lookup";
import { resolveProviderObservabilityOwner } from "./provider-observability-visualization";

export type ProviderCardOwner =
  | { kind: "cli"; cliId: string; surfaceId: string; providerSurfaceBindingId?: string }
  | { kind: "vendor"; vendorId: string; surfaceId: string; providerSurfaceBindingId?: string };

export function resolveProviderCardOwner(args: {
  provider: ProviderView;
  clis: CLI[];
  vendors: Vendor[];
}): ProviderCardOwner | null {
  for (const surface of providerModel(args.provider).raw.surfaces) {
    const owner = resolveProviderObservabilityOwner(surface);
    if (!owner) {
      continue;
    }
    if (owner.kind === "cli") {
      const pkg = findCLI(args.clis, owner.cliId);
      if (cliProviderCardEnabled(pkg, owner.surfaceId)) {
        return { ...owner, providerSurfaceBindingId: surface.surfaceId };
      }
      continue;
    }
    const pkg = findVendor(args.vendors, owner.vendorId);
    if (vendorProviderCardEnabled(pkg, owner.surfaceId)) {
      return { ...owner, providerSurfaceBindingId: surface.surfaceId };
    }
  }
  return null;
}

function cliProviderCardEnabled(cli: CLI | undefined, surfaceId: string) {
  if (!cli?.oauth?.providerCard?.enabled) {
    return false;
  }
  const bindingSurfaceId = cli.oauth.providerBinding?.surfaceId?.trim() || "";
  return bindingSurfaceId !== "" && bindingSurfaceId === surfaceId.trim();
}

function vendorProviderCardEnabled(vendor: Vendor | undefined, surfaceId: string) {
  const normalizedSurfaceId = surfaceId.trim();
  return vendor?.providerBindings.some((binding) => {
    if (!binding.providerCard?.enabled) {
      return false;
    }
    const bindingSurfaceId = binding.providerBinding?.surfaceId?.trim() || "";
    return bindingSurfaceId !== "" && bindingSurfaceId === normalizedSurfaceId;
  }) ?? false;
}
