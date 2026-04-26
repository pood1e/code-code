import { ProviderSurfaceKind, type ProviderSurfaceRuntime } from "@code-code/agent-contract/provider/v1";
import type { ProviderProtocolValue } from "./provider-protocol";

export function providerSurfaceRuntimeDisplayName(runtime?: ProviderSurfaceRuntime) {
  return runtime?.displayName?.trim() || "";
}

export function providerSurfaceRuntimeKind(runtime?: ProviderSurfaceRuntime) {
  switch (runtime?.access.case) {
    case "api":
      return ProviderSurfaceKind.API;
    case "cli":
      return ProviderSurfaceKind.CLI;
    default:
      return ProviderSurfaceKind.UNSPECIFIED;
  }
}

export function providerSurfaceRuntimeCLIID(runtime?: ProviderSurfaceRuntime) {
  return runtime?.access.case === "cli" ? runtime.access.value.cliId : "";
}

export function providerSurfaceRuntimeProtocol(runtime?: ProviderSurfaceRuntime): ProviderProtocolValue | undefined {
  return runtime?.access.case === "api" ? runtime.access.value.protocol : undefined;
}

export function providerSurfaceRuntimeBaseURL(runtime?: ProviderSurfaceRuntime) {
  return runtime?.access.case === "api" ? runtime.access.value.baseUrl : "";
}
