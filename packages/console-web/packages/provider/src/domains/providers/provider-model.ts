import { ProviderSurfaceKind, type ProviderSurface } from "@code-code/agent-contract/provider/v1";
import { ProviderSurfaceBindingPhase, type ProviderView, type ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import { providerSurfaceBindingAuthenticationLabel } from "./provider-authentication-presentation";
import { providerSurfaceRuntimeKind, providerSurfaceRuntimeProtocol } from "./provider-surface-binding-view";
import { providerStatusReason } from "./provider-status-view";
import { providerProtocolLabel } from "./provider-protocol-presentation-store";

type ProviderStatusColor = "green" | "red" | "amber" | "gray";

type ProviderAuthenticationKind = "cliOAuth" | "apiKey";

export type ProviderStatusView = {
  color: ProviderStatusColor;
  label: string;
  reason: string;
};

export type CredentialSubjectSummaryLine = {
  key: string;
  value: string;
  emphasized: boolean;
};

export interface ProviderModel {
  readonly raw: ProviderView;
  authenticationKind(): ProviderAuthenticationKind;
  authenticationLabel(): string;
  displayName(): string;
  protocolLabels(): string[];
  modelCount(): number;
  modelsSummary(): string;
  oauthFieldValue(fieldId: string): string | null;
  oauthSummary(): CredentialSubjectSummaryLine[];
  operationalSummary(): string;
  primarySurface(): ProviderSurfaceBindingView | undefined;
  primarySurfaceId(): string;
  primaryVendorId(): string;
  surfaceCount(): number;
  surfaceIds(): string[];
  surfaceLabels(surfaces: ProviderSurface[]): string[];
  status(): ProviderStatusView;
}

class DefaultProviderModel implements ProviderModel {
  readonly raw: ProviderView;

  constructor(provider: ProviderView) {
    this.raw = provider;
  }

  authenticationKind() {
    return providerSurfaceRuntimeKind(this.primarySurface()?.runtime) === ProviderSurfaceKind.CLI ? "cliOAuth" : "apiKey";
  }

  authenticationLabel() {
    const surface = this.primarySurface()?.runtime;
    if (!surface) {
      return "Unknown Auth";
    }
    return providerSurfaceBindingAuthenticationLabel(providerSurfaceRuntimeKind(surface));
  }

  displayName() {
    const displayName = this.raw.displayName?.trim() || "";
    return displayName || this.raw.providerId;
  }

  protocolLabels() {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const instance of this.raw.surfaces) {
      const protocol = providerSurfaceRuntimeProtocol(instance.runtime);
      if (!protocol) continue;
      const label = providerProtocolLabel(protocol);
      if (label && !seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
    return labels;
  }

  modelCount() {
    return this.raw.modelCatalog?.models?.length ?? 0;
  }

  modelsSummary() {
    const modelCount = this.modelCount();
    if (modelCount === 0) {
      return "No models configured";
    }
    return `${modelCount} model${modelCount === 1 ? "" : "s"}`;
  }

  oauthFieldValue(fieldId: string) {
    const normalizedFieldID = fieldId.trim();
    if (!normalizedFieldID) {
      return null;
    }
    const value = this.raw.credentialSubjectSummary?.find((item) => item.fieldId?.trim() === normalizedFieldID)?.value || "";
    return value.trim() || null;
  }

  oauthSummary() {
    return (this.raw.credentialSubjectSummary || []).reduce<CredentialSubjectSummaryLine[]>((items, item) => {
      const fieldId = item.fieldId?.trim() || "";
      const value = item.value?.trim() || "";
      if (!value) {
        return items;
      }
      switch (fieldId) {
        case "account-email":
        case "account-id":
          items.push({
            key: fieldId || value,
            value,
            emphasized: true,
          });
          return items;
        default:
          return items;
      }
    }, []);
  }

  operationalSummary() {
    const surfaceCount = this.surfaceCount();
    return `${surfaceCount} surface${surfaceCount === 1 ? "" : "s"} · ${this.modelsSummary()}`;
  }

  primarySurface() {
    return this.raw.surfaces[0];
  }

  primarySurfaceId() {
    return this.primarySurface()?.surfaceId || "";
  }

  primaryVendorId() {
    return this.raw.vendorId || this.raw.surfaces[0]?.vendorId || "";
  }

  surfaceCount() {
    return this.surfaceIds().length;
  }

  surfaceIds() {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const surface of this.raw.surfaces) {
      const surfaceId = surface.surfaceId.trim();
      if (!surfaceId || seen.has(surfaceId)) {
        continue;
      }
      seen.add(surfaceId);
      ids.push(surfaceId);
    }
    return ids;
  }

  surfaceLabels(surfaces: ProviderSurface[]) {
    const surfaceByID = new Map(surfaces.map((surface) => [surface.surfaceId.trim(), surface]));
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const binding of this.raw.surfaces) {
      const surfaceId = binding.surfaceId.trim();
      if (!surfaceId || seen.has(surfaceId)) {
        continue;
      }
      seen.add(surfaceId);
      const surface = surfaceByID.get(surfaceId);
      const label = surface?.displayName?.trim() || surface?.surfaceId.trim() || "";
      if (label) {
        labels.push(label);
      }
    }
    return labels;
  }

  status(): ProviderStatusView {
    const stats = phaseStats(this.raw.surfaces);
    if (stats.invalid > 0 || stats.error > 0) {
      return { color: "red", label: "Needs Attention", reason: this.statusReason() };
    }
    if (stats.refreshing > 0) {
      return { color: "amber", label: "Refreshing", reason: this.statusReason() };
    }
    if (stats.stale > 0) {
      return { color: "amber", label: "Stale", reason: this.statusReason() };
    }
    if (stats.ready === this.raw.surfaces.length && this.raw.surfaces.length > 0) {
      return { color: "green", label: "Ready", reason: this.statusReason() };
    }
    return { color: "gray", label: "Unknown", reason: this.statusReason() };
  }

  private statusReason() {
    if (this.raw.surfaces.length > 1) {
      return "";
    }
    return providerStatusReason(this.raw.surfaces[0]?.status?.phase, this.raw.surfaces[0]?.status?.reason);
  }
}

function phaseStats(instances: ProviderSurfaceBindingView[]) {
  const stats = { ready: 0, refreshing: 0, stale: 0, invalid: 0, error: 0, unknown: 0 };
  for (const instance of instances) {
    switch (instance.status?.phase) {
      case ProviderSurfaceBindingPhase.READY:
        stats.ready += 1;
        break;
      case ProviderSurfaceBindingPhase.REFRESHING:
        stats.refreshing += 1;
        break;
      case ProviderSurfaceBindingPhase.STALE:
        stats.stale += 1;
        break;
      case ProviderSurfaceBindingPhase.INVALID_CONFIG:
        stats.invalid += 1;
        break;
      case ProviderSurfaceBindingPhase.ERROR:
        stats.error += 1;
        break;
      default:
        stats.unknown += 1;
        break;
    }
  }
  return stats;
}

export function providerModel(provider: ProviderView): ProviderModel {
  return new DefaultProviderModel(provider);
}
