import { afterEach, describe, expect, it, vi } from "vitest";
import { create, toJson } from "@bufbuild/protobuf";
import { AgentResourcesSchema } from "@code-code/agent-contract/agent/v1/cap";
import { AgentSessionRuntimeConfigSchema } from "@code-code/agent-contract/platform/agent-session/v1";
import { AgentSessionActionStateSchema } from "@code-code/agent-contract/platform/agent-session-action/v1";
import { createChat, getChatOrNull, listChatMessages, listSessionRuntimeOptions, listChats, putChat, renameChat, resetChatWarmState } from "./api";

describe("chat api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates chat through /api/chats", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: "chat-9f8c",
        displayName: "Profile chat",
        session: {
          id: "chat-9f8c",
          sessionSetup: {
            mode: "profile",
            profileId: "profile-1",
            editable: false,
          },
          state: { id: "chat-9f8c", phase: "ready" },
        },
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const chat = await createChat({ mode: "profile", displayName: "Profile chat", profileId: "profile-1" });

    expect(chat.id).toBe("chat-9f8c");
    expect(chat.displayName).toBe("Profile chat");
    expect(chat.session.sessionSetup.profileId).toBe("profile-1");
    expect(chat.session.sessionSetup.mode).toBe("profile");

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/chats");
    expect(request.method).toBe("POST");
    expect(JSON.parse(String(request.body))).toMatchObject({
      displayName: "Profile chat",
      sessionSetup: {
        mode: "profile",
        profileId: "profile-1",
      },
    });
  });

  it("upserts inline chat through /api/chats/{chatId}", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: "chat-1",
        session: {
          id: "chat-1",
          sessionSetup: {
            mode: "inline",
            providerId: "codex",
            executionClass: "cli-standard",
            editable: true,
            runtimeConfig: toJson(AgentSessionRuntimeConfigSchema, create(AgentSessionRuntimeConfigSchema, {
              providerRuntimeRef: { surfaceId: "openai-default" },
              primaryModelSelector: { selector: { case: "providerModelId", value: "gpt-5" } },
            })),
            resourceConfig: toJson(AgentResourcesSchema, create(AgentResourcesSchema, {
              instructions: [{ kind: 1, name: "rule-1", content: "stay concise" }],
            })),
          },
          state: { id: "chat-1", phase: "ready" },
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const chat = await putChat("chat-1", {
      mode: "inline",
      inline: {
        providerId: "codex",
        executionClass: "cli-standard",
        runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
          providerRuntimeRef: { surfaceId: "openai-default" },
          primaryModelSelector: { selector: { case: "providerModelId", value: "gpt-5" } },
        }),
        resourceConfig: create(AgentResourcesSchema, {
          instructions: [{ kind: 1, name: "rule-1", content: "stay concise" }],
        }),
      },
    });

    expect(chat.session.sessionSetup.mode).toBe("inline");
    expect(chat.session.sessionSetup.providerId).toBe("codex");
    expect(chat.session.sessionSetup.runtimeConfig?.providerRuntimeRef?.surfaceId).toBe("openai-default");

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/chats/chat-1");
    expect(JSON.parse(String(request.body))).toMatchObject({
      sessionSetup: {
        mode: "inline",
        inline: {
          providerId: "codex",
          executionClass: "cli-standard",
        },
      },
    });
    expect(JSON.parse(String(request.body))).not.toHaveProperty("displayName");
  });

  it("renames chat independently from setup", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: "chat-1",
        displayName: "Renamed chat",
        session: {
          id: "chat-1",
          sessionSetup: {
            mode: "profile",
            profileId: "profile-1",
            editable: false,
          },
          state: { id: "chat-1", phase: "ready" },
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const chat = await renameChat("chat-1", "Renamed chat");

    expect(chat.displayName).toBe("Renamed chat");
    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/chats/chat-1:rename");
    expect(request.method).toBe("POST");
    expect(JSON.parse(String(request.body))).toEqual({ displayName: "Renamed chat" });
  });

  it("returns null for missing chat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    await expect(getChatOrNull("missing")).resolves.toBeNull();
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/chats/missing");
  });

  it("lists chats through /api/chats", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        items: [{
          id: "chat-1",
          displayName: "Design review",
          sessionId: "session-1",
        }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const chats = await listChats();

    expect(chats.items[0]?.id).toBe("chat-1");
    expect(chats.items[0]?.displayName).toBe("Design review");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/chats");
  });

  it("lists AG-UI chat messages with assistant tool calls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        messages: [{
          id: "assistant-1",
          role: "assistant",
          content: "checking",
          toolCalls: [{
            id: "tool-1",
            type: "function",
            function: { name: "shell", arguments: `{"cmd":"ls"}` },
          }],
        }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const messages = await listChatMessages("chat-1");

    const [message] = messages;
    expect(message?.role).toBe("assistant");
    expect(message?.role === "assistant" ? message.toolCalls?.[0]?.function.name : "").toBe("shell");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/chats/chat-1/messages");
  });

  it("rejects invalid AG-UI chat messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        messages: [{ role: "user", content: "missing id" }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    await expect(listChatMessages("chat-1")).rejects.toThrow();
  });

  it("resets warm state through /api/chats/{chatId}:reset-warm-state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify(toJson(AgentSessionActionStateSchema, create(AgentSessionActionStateSchema, {
        spec: { actionId: "reset-1", sessionId: "chat-1" },
      }))), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const action = await resetChatWarmState("chat-1", "reset-1");
    expect(action.spec?.actionId).toBe("reset-1");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/chats/chat-1:reset-warm-state");
  });

  it("loads session runtime options through /api/chats/session-runtime-options", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        items: [{
          providerId: "codex",
          label: "Codex",
          executionClasses: ["cli-standard", "cli-long-context"],
          surfaces: [{
            runtimeRef: {
              providerId: "provider",
              surfaceId: "openai-default",
              api: { protocol: "PROTOCOL_OPENAI_COMPATIBLE" },
            },
            label: "OpenAI Default",
            models: ["gpt-5", "gpt-5-mini"],
          }],
        }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const options = await listSessionRuntimeOptions();

    expect(options.items[0]?.providerId).toBe("codex");
    expect(options.items[0]?.executionClasses).toEqual(["cli-standard", "cli-long-context"]);
    expect(options.items[0]?.surfaces[0]?.models).toEqual(["gpt-5", "gpt-5-mini"]);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/chats/session-runtime-options");
  });
});
