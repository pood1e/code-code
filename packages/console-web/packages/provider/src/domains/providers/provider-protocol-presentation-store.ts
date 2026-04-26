import { ProviderProtocol, type ProviderProtocolValue } from "./provider-protocol";

type ProviderProtocolPresentation = {
  protocol: ProviderProtocolValue;
  label: string;
};

const defaultProviderProtocolPresentations: readonly ProviderProtocolPresentation[] = [
  {
    protocol: ProviderProtocol.GEMINI,
    label: "Gemini",
  },
  {
    protocol: ProviderProtocol.ANTHROPIC,
    label: "Anthropic",
  },
  {
    protocol: ProviderProtocol.OPENAI_RESPONSES,
    label: "OpenAI Responses",
  },
  {
    protocol: ProviderProtocol.OPENAI_COMPATIBLE,
    label: "OpenAI Compatible",
  },
];

const providerProtocolPresentationRegistry = new Map<ProviderProtocolValue, ProviderProtocolPresentation>();

export function registerProviderProtocolPresentation(item: ProviderProtocolPresentation) {
  if (providerProtocolPresentationRegistry.has(item.protocol)) {
    return;
  }
  providerProtocolPresentationRegistry.set(item.protocol, item);
}

export function registerProviderProtocolPresentations(items: readonly ProviderProtocolPresentation[]) {
  for (const item of items) {
    registerProviderProtocolPresentation(item);
  }
}

export function registerDefaultProviderProtocolPresentations() {
  registerProviderProtocolPresentations(defaultProviderProtocolPresentations);
}

export function providerProtocolLabel(protocol: ProviderProtocolValue) {
  return providerProtocolPresentationRegistry.get(protocol)?.label || "Unknown";
}
