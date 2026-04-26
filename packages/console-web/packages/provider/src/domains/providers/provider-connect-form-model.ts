import {
  isAPIKeyConnectOption,
  isCLIOAuthConnectOption,
  isVendorAPIKeyConnectOption,
  type ProviderConnectOption,
} from "./provider-connect-options";
import { providerSurfaceRuntimeBaseURL, providerSurfaceRuntimeProtocol } from "./provider-surface-binding-view";
import { providerProtocolLabel } from "./provider-protocol-presentation";
import { ProviderProtocol } from "./provider-protocol";

export type ProviderConnectProtocolOption = {
  value: string;
  label: string;
};

const providerConnectProtocolOptionProtocols = [
  ProviderProtocol.OPENAI_COMPATIBLE,
  ProviderProtocol.GEMINI,
  ProviderProtocol.ANTHROPIC,
] as const;

export const PROVIDER_CONNECT_PROTOCOL_OPTIONS = providerConnectProtocolOptionProtocols
  .map((protocol) => ({
    value: String(protocol),
    label: providerProtocolLabel(protocol),
  }));

export type ProviderConnectFormValues = {
  apiKey: string;
  baseUrl: string;
  connectOptionId: string;
  displayName: string;
  protocol: string;
};

export interface ProviderConnectFormModel {
  displayNamePlaceholder(): string;
  protocolOptions(): readonly ProviderConnectProtocolOption[];
  showAPIKeyFields(): boolean;
  submitLabel(overrideLabel?: string): string;
}

class DefaultProviderConnectFormModel implements ProviderConnectFormModel {
  private readonly selectedOption?: ProviderConnectOption;

  constructor(selectedOption: ProviderConnectOption | undefined) {
    this.selectedOption = selectedOption;
  }

  displayNamePlaceholder() {
    return this.selectedOption?.displayName || "Provider Provider";
  }

  protocolOptions() {
    return PROVIDER_CONNECT_PROTOCOL_OPTIONS;
  }

  showAPIKeyFields() {
    return isAPIKeyConnectOption(this.selectedOption);
  }

  submitLabel(overrideLabel?: string) {
    if (overrideLabel) {
      return overrideLabel;
    }
    return isCLIOAuthConnectOption(this.selectedOption) ? "Authorize" : "Connect";
  }
}

export function defaultProviderConnectFormValues(preferredOption?: ProviderConnectOption): ProviderConnectFormValues {
  const surface = isVendorAPIKeyConnectOption(preferredOption)
    ? preferredOption.prefilledSurfaces[0]?.runtime
    : undefined;
  return {
    connectOptionId: preferredOption?.id ?? "",
    displayName: preferredOption?.displayName ?? "",
    apiKey: "",
    baseUrl: providerSurfaceRuntimeBaseURL(surface),
    protocol: String(providerSurfaceRuntimeProtocol(surface) ?? ProviderProtocol.OPENAI_COMPATIBLE),
  };
}

export function providerConnectFormModel(
  selectedOption: ProviderConnectOption | undefined,
): ProviderConnectFormModel {
  return new DefaultProviderConnectFormModel(selectedOption);
}
