import type { ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import {
  providerSurfaceRuntimeBaseURL,
  providerSurfaceRuntimeDisplayName,
  providerSurfaceRuntimeProtocol,
} from "./provider-surface-binding-view";
import { providerModelsSummary } from "./provider-model-summary";
import { providerProtocolLabel } from "./provider-protocol-presentation";
import { providerStatusColor, providerStatusLabel, providerStatusReason } from "./provider-status-view";

export interface ProviderSurfaceBindingModel {
  readonly raw: ProviderSurfaceBindingView;
  detail(): string;
  displayName(): string;
  modelsSummary(): string;
  statusColor(): ReturnType<typeof providerStatusColor>;
  statusLabel(): ReturnType<typeof providerStatusLabel>;
  statusReason(): string;
}

class DefaultProviderSurfaceBindingModel implements ProviderSurfaceBindingModel {
  readonly raw: ProviderSurfaceBindingView;

  constructor(surface: ProviderSurfaceBindingView) {
    this.raw = surface;
  }

  detail() {
    const surface = this.raw.runtime;
    if (!surface) {
      return "";
    }
    const protocol = providerSurfaceRuntimeProtocol(surface);
    const baseURL = providerSurfaceRuntimeBaseURL(surface);
    if (protocol && baseURL) {
      return `${providerProtocolLabel(protocol)} · ${baseURL}`;
    }
    if (baseURL) {
      return baseURL;
    }
    if (protocol) {
      return providerProtocolLabel(protocol);
    }
    return "";
  }

  displayName() {
    return this.raw.displayName?.trim() || providerSurfaceRuntimeDisplayName(this.raw.runtime) || this.raw.surfaceId || "Surface";
  }

  modelsSummary() {
    return providerModelsSummary(this.raw);
  }

  statusColor() {
    return providerStatusColor(this.raw.status?.phase);
  }

  statusLabel() {
    return providerStatusLabel(this.raw.status?.phase);
  }

  statusReason() {
    return providerStatusReason(this.raw.status?.phase, this.raw.status?.reason);
  }
}

export function providerSurfaceBindingModel(surface: ProviderSurfaceBindingView): ProviderSurfaceBindingModel {
  return new DefaultProviderSurfaceBindingModel(surface);
}
