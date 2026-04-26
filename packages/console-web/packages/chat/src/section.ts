import type { Section } from "@code-code/console-web-ui";

export type ChatSectionKey = "chat";

export const CHAT_SECTION: Section = {
  key: "chat",
  label: "Chat",
  icon: "link",
  headline: "Chat"
};

export const CHAT_SECTIONS: Section[] = [CHAT_SECTION];
