import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { AgentResourcesSchema } from "@code-code/agent-contract/agent/v1/cap";
import { AgentSessionRuntimeConfigSchema } from "@code-code/agent-contract/platform/agent-session/v1";
import type { ChatView } from "./types";
import { hasPendingSetupChange } from "./types";

describe("chat session setup diff", () => {
  it("does not flush unchanged profile setup", () => {
    expect(hasPendingSetupChange(profileView("profile-1"), "profile", "profile-1", null)).toBe(false);
  });

  it("flushes changed profile setup", () => {
    expect(hasPendingSetupChange(profileView("profile-1"), "profile", "profile-2", null)).toBe(true);
  });

  it("does not flush unchanged inline setup", () => {
    const inline = inlineView();
    expect(hasPendingSetupChange(inline, "inline", "", {
      providerId: "codex",
      executionClass: "cli-standard",
      runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
        providerRuntimeRef: { surfaceId: "primary-1" },
        primaryModelSelector: { selector: { case: "providerModelId", value: "gpt-5" } },
      }),
      resourceConfig: create(AgentResourcesSchema, {
        instructions: [{ kind: 1, name: "rule-1", content: "stay concise" }],
      }),
    })).toBe(false);
  });

  it("flushes changed inline setup", () => {
    const inline = inlineView();
    expect(hasPendingSetupChange(inline, "inline", "", {
      providerId: "codex",
      executionClass: "cli-standard",
      runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
        providerRuntimeRef: { surfaceId: "primary-2" },
        primaryModelSelector: { selector: { case: "providerModelId", value: "gpt-5" } },
      }),
      resourceConfig: create(AgentResourcesSchema, {
        instructions: [{ kind: 1, name: "rule-1", content: "stay concise" }],
      }),
    })).toBe(true);
  });
});

function profileView(profileId: string): ChatView {
  return {
    id: "chat-1",
    session: {
      id: "chat-1",
      sessionSetup: { mode: "profile", profileId, editable: false },
      state: {},
    },
  };
}

function inlineView(): ChatView {
  return {
    id: "chat-1",
    session: {
      id: "chat-1",
      sessionSetup: {
        mode: "inline",
        providerId: "codex",
        executionClass: "cli-standard",
        editable: true,
        runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
          providerRuntimeRef: { surfaceId: "primary-1" },
          primaryModelSelector: { selector: { case: "providerModelId", value: "gpt-5" } },
        }),
        resourceConfig: create(AgentResourcesSchema, {
          instructions: [{ kind: 1, name: "rule-1", content: "stay concise" }],
        }),
      },
      state: {},
    },
  };
}
