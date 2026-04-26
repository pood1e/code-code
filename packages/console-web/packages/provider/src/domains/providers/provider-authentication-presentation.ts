import { ProviderSurfaceKind } from "@code-code/agent-contract/provider/v1";

export function providerSurfaceBindingAuthenticationLabel(kind: ProviderSurfaceKind | undefined) {
  switch (kind) {
    case ProviderSurfaceKind.CLI:
      return "CLI OAuth";
    case ProviderSurfaceKind.API:
      return "API Key";
    default:
      return "Unknown Auth";
  }
}

export function providerConnectOptionAuthenticationLabel(kind: "vendorApiKey" | "customApiKey" | "cliOAuth") {
  return kind === "cliOAuth" ? "CLI OAuth" : "API Key";
}
