import { create, fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import { MessageSchema } from "@ag-ui/core";
import { AgentSessionActionStateSchema, type AgentSessionActionState } from "@code-code/agent-contract/platform/agent-session-action/v1";
import {
  ListAgentProfilesResponseSchema,
  type AgentProfileListItem,
} from "@code-code/agent-contract/platform/management/v1";
import { GetSessionRuntimeOptionsResponseSchema } from "@code-code/agent-contract/platform/chat/v1";
import { AgentResourcesSchema } from "@code-code/agent-contract/agent/v1/cap";
import { AgentSessionRuntimeConfigSchema } from "@code-code/agent-contract/platform/agent-session/v1";
import { jsonRequest, protobufJsonReadOptions } from "@code-code/console-web-ui";
import type { ChatListView, ChatMessage, ChatSetupRequest, ChatView } from "./types";
import type { SessionRuntimeOptions } from "./session-runtime-options";

const apiBaseUrl = (import.meta.env.VITE_CONSOLE_API_BASE_URL?.trim() || "").replace(/\/$/, "");
const chatsPath = "/api/chats";

export async function createChat(request: ChatSetupRequest): Promise<ChatView> {
  const data = await jsonRequest<JsonValue>(chatsPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildCreateChatBody(request)),
  });
  return parseChatView(data);
}

export async function getChat(chatId: string): Promise<ChatView> {
  const data = await jsonRequest<JsonValue>(chatPath(chatId));
  return parseChatView(data);
}

export async function getChatOrNull(chatId: string): Promise<ChatView | null> {
  const response = await fetch(`${apiBaseUrl}${chatPath(chatId)}`, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return parseChatView(JSON.parse(await response.text()) as JsonValue);
}

export async function listChats(): Promise<ChatListView> {
  const data = await jsonRequest<JsonValue>(chatsPath);
  const value = data as Record<string, unknown>;
  return {
    items: objectArray(value.items).map((item) => ({
      id: stringValue(item.id),
      displayName: stringValue(item.displayName) || undefined,
      sessionId: stringValue(item.sessionId) || undefined,
    })),
    nextPageToken: stringValue(value.nextPageToken) || undefined,
  };
}

export async function listChatMessages(chatId: string): Promise<ChatMessage[]> {
  const data = await jsonRequest<JsonValue>(`${chatPath(chatId)}/messages`);
  const value = data as Record<string, unknown>;
  return MessageSchema.array().parse(Array.isArray(value.messages) ? value.messages : []);
}

export async function putChat(chatId: string, request: ChatSetupRequest): Promise<ChatView> {
  const body = buildSessionSetupBody(request);
  const data = await jsonRequest<JsonValue>(chatPath(chatId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseChatView(data);
}

export async function renameChat(chatId: string, displayName: string): Promise<ChatView> {
  const data = await jsonRequest<JsonValue>(`${chatPath(chatId)}:rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  return parseChatView(data);
}

export async function listAgentProfiles(): Promise<AgentProfileListItem[]> {
  const data = await jsonRequest<JsonValue>("/api/agent-profiles");
  return fromJson(ListAgentProfilesResponseSchema, data, protobufJsonReadOptions).items;
}

export async function listSessionRuntimeOptions(): Promise<SessionRuntimeOptions> {
  const data = await jsonRequest<JsonValue>("/api/chats/session-runtime-options");
  const response = fromJson(GetSessionRuntimeOptionsResponseSchema, data, protobufJsonReadOptions);
  return {
    items: response.items
      .map((item) => ({
        providerId: item.providerId,
        label: item.label,
        executionClasses: [...item.executionClasses],
        surfaces: item.surfaces.flatMap((surface) => surface.runtimeRef
          ? [{
              runtimeRef: surface.runtimeRef,
              label: surface.label,
              models: [...surface.models],
            }]
          : []),
      })),
  };
}

export async function resetChatWarmState(chatId: string, actionId?: string): Promise<AgentSessionActionState> {
  const data = await jsonRequest<JsonValue>(`${chatPath(chatId)}:reset-warm-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: actionId ? JSON.stringify({ actionId }) : undefined,
  });
  return fromJson(AgentSessionActionStateSchema, data, protobufJsonReadOptions);
}

export async function retryTurn(chatId: string, turnId: string, newTurnId: string): Promise<AgentSessionActionState> {
  const data = await jsonRequest<JsonValue>(`${chatPath(chatId)}/turns/${encodeURIComponent(turnId)}:retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newTurnId }),
  });
  return fromJson(AgentSessionActionStateSchema, data, protobufJsonReadOptions);
}

function chatPath(chatId: string) {
  return `${chatsPath}/${encodeURIComponent(chatId)}`;
}

function parseChatView(data: JsonValue): ChatView {
  const value = data as Record<string, unknown>;
  const session = (value.session ?? {}) as Record<string, unknown>;
  const setup = (session.sessionSetup ?? {}) as Record<string, unknown>;
  return {
    id: stringValue(value.id),
    displayName: stringValue(value.displayName) || undefined,
    session: {
      id: stringValue(session.id),
      sessionSetup: {
        mode: stringValue(setup.mode) as ChatView["session"]["sessionSetup"]["mode"],
        profileId: stringValue(setup.profileId),
        providerId: stringValue(setup.providerId),
        executionClass: stringValue(setup.executionClass),
        editable: Boolean(setup.editable),
        runtimeConfig: setup.runtimeConfig
          ? fromJson(AgentSessionRuntimeConfigSchema, setup.runtimeConfig as JsonValue, protobufJsonReadOptions)
          : undefined,
        resourceConfig: setup.resourceConfig
          ? fromJson(AgentResourcesSchema, setup.resourceConfig as JsonValue, protobufJsonReadOptions)
          : undefined,
      },
      state: parseChatSection(session.state),
    },
  };
}

function buildCreateChatBody(request: ChatSetupRequest) {
  const displayName = request.displayName?.trim();
  return { displayName, ...buildSessionSetupBody(request) };
}

function buildSessionSetupBody(request: ChatSetupRequest) {
  return request.mode === "profile"
    ? { sessionSetup: { mode: "profile", profileId: request.profileId } }
    : {
        sessionSetup: {
          mode: "inline",
          inline: {
            providerId: request.inline.providerId,
            executionClass: request.inline.executionClass,
            runtimeConfig: toJson(AgentSessionRuntimeConfigSchema, create(AgentSessionRuntimeConfigSchema, request.inline.runtimeConfig)),
            resourceConfig: toJson(AgentResourcesSchema, create(AgentResourcesSchema, request.inline.resourceConfig)),
          },
        },
      };
}

function parseChatSection(value: unknown) {
  const section = parseOptionalSection(value);
  return section || {};
}

function parseOptionalSection(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objectArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

async function readError(response: Response) {
  try {
    const payload = await response.json() as { error_detail?: string; error_code?: string; message?: string; code?: string };
    return payload.error_detail || payload.error_code || payload.message || payload.code || `HTTP Error ${response.status}`;
  } catch {
    return `HTTP Error ${response.status}`;
  }
}
