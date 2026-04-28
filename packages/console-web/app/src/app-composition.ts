import { type ReactElement } from "react";
import {
  AGENT_PROFILE_ROUTES,
  AGENT_PROFILE_SECTIONS,
  type AgentProfileSectionKey
} from "@code-code/console-web-agentprofile";
import {
  CHAT_ROUTES,
  CHAT_SECTIONS,
  type ChatSectionKey
} from "@code-code/console-web-chat";
import {
  isLlmProviderSectionKey,
  LLM_PROVIDER_ROUTES,
  LLM_PROVIDER_SECTIONS,
  type LlmProviderSectionKey
} from "@code-code/console-web-provider";
import { OVERVIEW_ROUTES, OVERVIEW_SECTION, OVERVIEW_SECTIONS } from "@code-code/console-web-overview";
import type { NavItem, Section } from "@code-code/console-web-ui";
import { GRAFANA_ROUTES, GRAFANA_SECTION, type GrafanaSectionKey } from "./grafana/routes";
import { NETWORK_ROUTES, NETWORK_SECTIONS, type NetworkSectionKey } from "./network/routes";

export type SectionKey =
  | "overview"
  | ChatSectionKey
  | LlmProviderSectionKey
  | AgentProfileSectionKey
  | NetworkSectionKey
  | GrafanaSectionKey;

export type AppRoute = { path: string; element: ReactElement };

// --- Console: all sections and routes ---

const CORE_APP_SECTIONS: Section[] = [
  ...OVERVIEW_SECTIONS,
  ...CHAT_SECTIONS,
  ...AGENT_PROFILE_SECTIONS,
  ...NETWORK_SECTIONS,
  ...LLM_PROVIDER_SECTIONS
];

export const APP_SECTIONS: Section[] = [...CORE_APP_SECTIONS, GRAFANA_SECTION];

export const APP_ROUTES: AppRoute[] = [
  ...OVERVIEW_ROUTES,
  ...CHAT_ROUTES,
  ...AGENT_PROFILE_ROUTES,
  ...NETWORK_ROUTES,
  ...LLM_PROVIDER_ROUTES,
  ...GRAFANA_ROUTES
];

export function resolveNavigationSections(options: { grafanaAvailable: boolean }) {
  return options.grafanaAvailable ? APP_SECTIONS : CORE_APP_SECTIONS;
}

export function buildNavItems(sections: Section[]): NavItem[] {
  return sections.map((section) => ({
    key: section.key,
    label: section.label,
    icon: section.icon
  }));
}

export const NAV_ITEMS: NavItem[] = buildNavItems(
  resolveNavigationSections({ grafanaAvailable: false })
);

const SECTION_BY_KEY = new Map<string, Section>(APP_SECTIONS.map((s) => [s.key, s]));

export function resolveSection(pathname: string, fallback: Section = OVERVIEW_SECTION) {
  const key = normalizeSectionKey(pathname.replace(/^\//, "").split("/", 1)[0]);
  const section = SECTION_BY_KEY.get(key) ?? fallback;
  return { activeKey: section.key, section };
}

export { isLlmProviderSectionKey };

function normalizeSectionKey(key: string) {
  return key === "mcps" || key === "skills" || key === "rules" ? "profiles" : key;
}
