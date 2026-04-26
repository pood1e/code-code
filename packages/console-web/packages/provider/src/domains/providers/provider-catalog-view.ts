import type { ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import {
  providerCatalogSourceHelpValue,
  providerCatalogSourceLabelValue,
} from "./provider-catalog-presentation";

function providerCatalogSourceLabel(instance: ProviderSurfaceBindingView) {
  return providerCatalogSourceLabelValue(instance.runtime?.catalog?.source);
}

export function providerCatalogSummary(instance: ProviderSurfaceBindingView) {
  const count = instance.runtime?.catalog?.models.length ?? 0;
  if (count === 0) {
    return "No models configured";
  }
  return `${providerCatalogSourceLabel(instance)} · ${count} model${count === 1 ? "" : "s"}`;
}

export function providerCatalogLastSync(instance: ProviderSurfaceBindingView) {
  const updatedAt = instance.runtime?.catalog?.updatedAt;
  if (!updatedAt) {
    return "Not tracked";
  }
  const date = new Date(Number(updatedAt.seconds) * 1000 + Math.floor(updatedAt.nanos / 1_000_000));
  if (Number.isNaN(date.getTime())) {
    return "Not tracked";
  }
  return date.toLocaleString();
}

export function providerModelCatalogHelp(instance: ProviderSurfaceBindingView) {
  return providerCatalogSourceHelpValue(instance.runtime?.catalog?.source);
}
