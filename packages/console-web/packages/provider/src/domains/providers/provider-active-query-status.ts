import { useEffect, useMemo, useState } from "react";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import { useProviderObservability } from "./api-observability";
import type { ProviderObservability } from "./api-types";
import type { ProviderStatusView } from "./provider-model";
import { providerModel } from "./provider-model";
import { resolveProviderOwnerObservabilityModel, type ProviderObservabilityOwner } from "./provider-owner-observability-model";
import { resolveProviderObservabilityOwner } from "./provider-observability-visualization";

type ProviderActiveQueryStatusOwner = ProviderObservabilityOwner & {
  providerSurfaceBindingId?: string;
};

type ProviderActiveQueryStatusSource = {
  detail?: ProviderObservability;
  isLoading: boolean;
  isError: boolean;
};

export function useProviderActiveQueryStatus(provider: ProviderView | null, enabled: boolean) {
  const providerID = enabled ? provider?.providerId?.trim() || "" : "";
  const { detail, isLoading, isError } = useProviderObservability(providerID || undefined, "1h", "status");
  return useProviderActiveQueryStatusFromObservability(provider, enabled, {
    detail,
    isLoading,
    isError,
  });
}

export function useProviderActiveQueryStatusFromObservability(
  provider: ProviderView | null,
  enabled: boolean,
  source: ProviderActiveQueryStatusSource,
  preferredOwner?: ProviderActiveQueryStatusOwner | null,
) {
  const providerViewModel = useMemo(() => (provider ? providerModel(provider) : null), [provider]);
  const now = useRelativeNow(enabled);
  const owner = useMemo<ProviderActiveQueryStatusOwner | null>(
    () => preferredOwner ?? (providerViewModel ? resolveProviderObservabilityOwner(providerViewModel.primarySurface()) : null),
    [providerViewModel, preferredOwner],
  );

  return useMemo(() => {
    if (!enabled || !providerViewModel || !owner) {
      return null;
    }
    if ((source.isLoading && !source.detail) || source.isError) {
      return null;
    }
    const observability = resolveProviderOwnerObservabilityModel(
      source.detail,
      owner,
      owner.providerSurfaceBindingId || providerViewModel.primarySurfaceId(),
    );
    return readProviderActiveQueryStatus(observability, owner, now);
  }, [providerViewModel, enabled, now, owner, source.detail, source.isError, source.isLoading]);
}

export function readProviderActiveQueryStatus(
  observability: ReturnType<typeof resolveProviderOwnerObservabilityModel>,
  owner: ProviderObservabilityOwner | null,
  now: Date = new Date(),
  timeZone?: string,
): ProviderStatusView {
  if (!observability) {
    return { color: "gray", label: "No Probe", reason: "" };
  }
  const outcome = observability.lastProbeOutcomeValue();
  const lastProbeAt = observability.observedAtRelativeLabel(now) || observability.observedAtLabel(now, timeZone);
  switch (outcome) {
    case 1:
      return buildProviderActiveQueryStatus("green", "Executed", lastProbeAt);
    case 2:
      return buildProviderActiveQueryStatus("amber", "Throttled", lastProbeAt);
    case 3:
      return buildProviderActiveQueryStatus("red", "Auth Blocked", lastProbeAt, authBlockedReason(observability, owner));
    case 4:
      return buildProviderActiveQueryStatus("gray", "Unsupported", lastProbeAt);
    case 5:
      return buildProviderActiveQueryStatus("red", "Failed", lastProbeAt, probeFailureReason(observability));
  }
  if (lastProbeAt) {
    return buildProviderActiveQueryStatus("amber", "Probe Unknown", lastProbeAt);
  }
  return { color: "gray", label: "No Probe", reason: "" };
}

function buildProviderActiveQueryStatus(
  color: ProviderStatusView["color"],
  label: string,
  observedAtLabel: string | null,
  reason = "",
): ProviderStatusView {
  return {
    color,
    label: observedAtLabel ? `${label} · ${observedAtLabel}` : label,
    reason,
  };
}

function probeFailureReason(observability: ReturnType<typeof resolveProviderOwnerObservabilityModel>) {
  return observability?.lastProbeReason() || "";
}

function authBlockedReason(
  observability: ReturnType<typeof resolveProviderOwnerObservabilityModel>,
  owner: ProviderObservabilityOwner | null,
) {
  const probeReason = probeFailureReason(observability);
  if (probeReason) {
    return probeReason;
  }
  if (owner?.kind !== "vendor") {
    return "";
  }
  return "Observability authentication needs refresh.";
}

function useRelativeNow(enabled: boolean) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  return now;
}
