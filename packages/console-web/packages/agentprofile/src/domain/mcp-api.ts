import { create, fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import { MCPServerSchema } from "@code-code/agent-contract/platform/mcp/v1";
import {
  ListMCPServersResponseSchema,
  UpsertMCPServerRequestSchema,
  type MCPServerListItem
} from "@code-code/agent-contract/platform/management/v1";
import useSWR, { mutate } from "swr";
import { jsonFetcher, jsonRequest, protobufJsonReadOptions } from "@code-code/console-web-ui";
import type { MCPServer } from "@code-code/agent-contract/platform/mcp/v1";
import type { MCPResourceDraft } from "./types";
import { draftToMCPRequest } from "./resource-adapters";

const mcpsPath = "/api/mcps";

export function useMCPServers() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(mcpsPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListMCPServersResponseSchema, data, protobufJsonReadOptions) : undefined;
  return {
    mcps: response?.items || ([] as MCPServerListItem[]),
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}

export function useMCPServer(mcpId?: string) {
  const key = mcpId ? `${mcpsPath}/${encodeURIComponent(mcpId)}` : null;
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(key, jsonFetcher<JsonValue>);
  return {
    mcp: data ? fromJson(MCPServerSchema, data, protobufJsonReadOptions) : undefined,
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}

export async function getMCPServer(mcpId: string): Promise<MCPServer> {
  const data = await jsonRequest<JsonValue>(`${mcpsPath}/${encodeURIComponent(mcpId)}`);
  return fromJson(MCPServerSchema, data, protobufJsonReadOptions);
}

export async function createMCPServer(draft: MCPResourceDraft): Promise<MCPServer> {
  return writeMCPServer(mcpsPath, "POST", draft);
}

export async function updateMCPServer(mcpId: string, draft: MCPResourceDraft): Promise<MCPServer> {
  return writeMCPServer(`${mcpsPath}/${encodeURIComponent(mcpId)}`, "PUT", draft);
}

export async function deleteMCPServer(mcpId: string) {
  await jsonRequest<void>(`${mcpsPath}/${encodeURIComponent(mcpId)}`, { method: "DELETE" });
}

export function mutateMCPServers() {
  return mutate((key) => typeof key === "string" && key.startsWith(mcpsPath));
}

async function writeMCPServer(path: string, method: "POST" | "PUT", draft: MCPResourceDraft) {
  const request = create(UpsertMCPServerRequestSchema, draftToMCPRequest(draft));
  const data = await jsonRequest<JsonValue>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toJson(UpsertMCPServerRequestSchema, request))
  });
  return fromJson(MCPServerSchema, data, protobufJsonReadOptions);
}
