import type { Section } from "@code-code/console-web-ui";

export type LlmProviderSectionKey = "providers" | "models";

export type LlmProviderSection = Section & { key: LlmProviderSectionKey };

export const LLM_PROVIDER_SECTIONS: LlmProviderSection[] = [
  {
    key: "providers",
    label: "Providers",
    icon: "layers",
    headline: "Providers"
  },
  {
    key: "models",
    label: "Models",
    icon: "grid",
    headline: "Models"
  }
];

export const LLM_PROVIDER_SECTION_BY_KEY: Record<LlmProviderSectionKey, LlmProviderSection> =
  Object.fromEntries(LLM_PROVIDER_SECTIONS.map((section) => [section.key, section])) as Record<
    LlmProviderSectionKey,
    LlmProviderSection
  >;

const LLM_PROVIDER_SECTION_KEY_SET = new Set<LlmProviderSectionKey>(
  LLM_PROVIDER_SECTIONS.map((section) => section.key)
);

export function isLlmProviderSectionKey(value: string): value is LlmProviderSectionKey {
  return LLM_PROVIDER_SECTION_KEY_SET.has(value as LlmProviderSectionKey);
}
