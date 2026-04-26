import type { ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";

export function getProviderModelCount(instance: ProviderSurfaceBindingView) {
  return Math.max(instance.runtime?.catalog?.models.length ?? 0, 0);
}

export function providerModelsSummary(instance: ProviderSurfaceBindingView) {
  const modelCount = getProviderModelCount(instance);
  if (modelCount === 0) {
    return "No models configured";
  }
  return `${modelCount} model${modelCount === 1 ? "" : "s"}`;
}
