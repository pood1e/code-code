import "./provider-card-registrations";
import type { ProviderCardOwner } from "./provider-card-capability";
import { resolveRegisteredProviderCardRenderer, type ProviderCardRendererOwner } from "./provider-card-registry-store";
export type {
  ProviderCardRenderer,
  ProviderCardRendererBinding,
  ProviderCardRendererContext,
} from "./provider-card-registry-store";

export function resolveProviderCardRenderer(owner: ProviderCardOwner | ProviderCardRendererOwner | null) {
  return resolveRegisteredProviderCardRenderer(owner);
}
