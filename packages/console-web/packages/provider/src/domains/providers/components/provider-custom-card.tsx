import { createElement, useMemo } from "react";
import type { CLI } from "@code-code/agent-contract/platform/support/v1";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { Vendor } from "@code-code/agent-contract/platform/support/v1";
import type { ProviderObservability } from "../api";
import { resolveProviderCardOwner } from "../provider-card-capability";
import { resolveProviderCardRenderer } from "../provider-card-registry";
import { providerModel, type ProviderStatusView } from "../provider-model";
import { resolveProviderOwnerObservabilityModel } from "../provider-owner-observability-model";

type Props = {
  provider: ProviderView;
  clis: CLI[];
  vendors: Vendor[];
  detail?: ProviderObservability;
  isLoading: boolean;
  error?: unknown;
  status?: ProviderStatusView | null;
};

export function ProviderCustomCard({
  provider,
  clis,
  vendors,
  detail,
  isLoading,
  error,
  status,
}: Props) {
  const owner = useMemo(
    () => resolveProviderCardOwner({
      provider,
      clis,
      vendors,
    }),
    [provider, clis, vendors],
  );
  const providerViewModel = useMemo(() => providerModel(provider), [provider]);
  const observability = useMemo(
    () => (owner ? resolveProviderOwnerObservabilityModel(detail, owner, owner.providerSurfaceBindingId || providerViewModel.primarySurfaceId()) : null),
    [detail, owner, providerViewModel],
  );
  const renderer = useMemo(() => resolveProviderCardRenderer(owner), [owner]);
  if (!owner || !renderer) {
    return null;
  }

  return createElement(renderer, {
    provider,
    providerViewModel,
    owner,
    observability,
    observabilityError: error,
    isLoading,
    status,
  });
}
