import { OAuthAuthorizationFlow } from "@code-code/agent-contract/credential/v1";
import type { ProviderSurfaceRuntime } from "@code-code/agent-contract/provider/v1";
import type { CLI, OAuthCallbackDelivery, Vendor } from "@code-code/agent-contract/platform/support/v1";
import { providerConnectOptionAuthenticationLabel } from "./provider-authentication-presentation";
import { ProviderProtocol, type ProviderProtocolValue } from "./provider-protocol";

export type ProviderConnectSurfaceTemplate = {
  surfaceId: string;
  runtime: ProviderSurfaceRuntime;
};

export type ProviderConnectOption =
  | {
    id: string;
    kind: "vendorApiKey";
    displayName: string;
    vendorId: string;
    prefilledSurfaces: ProviderConnectSurfaceTemplate[];
  }
  | {
    id: string;
    kind: "customApiKey";
    displayName: string;
  }
  | {
    id: string;
    kind: "cliOAuth";
    displayName: string;
    cliId: string;
    flow: OAuthAuthorizationFlow;
    callbackDelivery?: OAuthCallbackDelivery;
    recommended: boolean;
  };

export type ProviderConnectOptionKind = ProviderConnectOption["kind"];

export function listProviderConnectOptions(
  vendors: Vendor[],
  clis: CLI[]
): ProviderConnectOption[] {
  const vendorOptions: ProviderConnectOption[] = vendors
    .filter((item) => Boolean(item.vendor?.vendorId) && vendorPrefilledSurfaces(item).length > 0)
    .map((item) => ({
      id: `vendor:${item.vendor!.vendorId}`,
      kind: "vendorApiKey" as const,
      displayName: item.vendor!.displayName || item.vendor!.vendorId,
      vendorId: item.vendor!.vendorId,
      prefilledSurfaces: vendorPrefilledSurfaces(item)
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const cliOptions: ProviderConnectOption[] = clis
    .filter((item) => Boolean(item.oauth))
    .map((item) => ({
      id: `cli:${item.cliId}`,
      kind: "cliOAuth" as const,
      displayName: item.displayName || item.cliId,
      cliId: item.cliId,
      flow: item.oauth?.flow || OAuthAuthorizationFlow.UNSPECIFIED,
      callbackDelivery: item.oauth?.codeFlow?.callbackDelivery,
      recommended: item.oauth?.recommended === true
    }))
    .sort((left, right) => {
      if (left.kind !== "cliOAuth" || right.kind !== "cliOAuth") {
        return 0;
      }
      if (left.recommended !== right.recommended) {
        return left.recommended ? -1 : 1;
      }
      return left.displayName.localeCompare(right.displayName);
    });

  return [
    ...vendorOptions,
    {
      id: "custom-api-key",
      kind: "customApiKey" as const,
      displayName: "Custom API Key",
    },
    ...cliOptions
  ];
}

function vendorPrefilledSurfaces(vendor: Vendor): ProviderConnectSurfaceTemplate[] {
  const templates: ProviderConnectSurfaceTemplate[] = [];
  for (const binding of vendor.providerBindings) {
    for (const template of binding.surfaceTemplates) {
      const surfaceId = template.surfaceId?.trim() || "";
      if (!surfaceId || !template.runtime) {
        continue;
      }
      templates.push({ surfaceId, runtime: template.runtime });
    }
  }
  return templates;
}

export function findProviderConnectOption(options: ProviderConnectOption[], optionId: string) {
  return options.find((item) => item.id === optionId);
}

export function isAPIKeyConnectOption(option?: ProviderConnectOption): option is Extract<ProviderConnectOption, { kind: "vendorApiKey" | "customApiKey" }> {
  return option?.kind === "vendorApiKey" || option?.kind === "customApiKey";
}

export function isVendorAPIKeyConnectOption(option?: ProviderConnectOption): option is Extract<ProviderConnectOption, { kind: "vendorApiKey" }> {
  return option?.kind === "vendorApiKey";
}

export function isCustomAPIKeyConnectOption(option?: ProviderConnectOption): option is Extract<ProviderConnectOption, { kind: "customApiKey" }> {
  return option?.kind === "customApiKey";
}

export function isCLIOAuthConnectOption(option?: ProviderConnectOption): option is Extract<ProviderConnectOption, { kind: "cliOAuth" }> {
  return option?.kind === "cliOAuth";
}

export function scopedProviderConnectOptionLabel(option: ProviderConnectOption) {
  if (isVendorAPIKeyConnectOption(option) || isCustomAPIKeyConnectOption(option)) {
    return option.displayName;
  }
  const authLabel = providerConnectOptionAuthenticationLabel(option.kind);
  const flowLabel = option.flow === OAuthAuthorizationFlow.DEVICE ? "Device Flow" : "Code Flow";
  return option.recommended
    ? `${option.displayName} · ${authLabel} · Recommended`
    : `${option.displayName} · ${authLabel} · ${flowLabel}`;
}

export function parseProtocolValue(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return ProviderProtocol.UNSPECIFIED;
  }
  return parsed as ProviderProtocolValue;
}
