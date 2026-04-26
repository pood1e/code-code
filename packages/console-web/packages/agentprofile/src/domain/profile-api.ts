import { create, fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import { AgentProfileSchema } from "@code-code/agent-contract/platform/agent-profile/v1";
import {
  ListAgentProfilesResponseSchema,
  UpsertAgentProfileRequestSchema,
  type AgentProfileListItem
} from "@code-code/agent-contract/platform/management/v1";
import useSWR, { mutate } from "swr";
import { jsonFetcher, jsonRequest, protobufJsonReadOptions } from "@code-code/console-web-ui";
import type { AgentProfile } from "@code-code/agent-contract/platform/agent-profile/v1";
import type { AgentProfileDraft } from "./types";
import { draftToAgentProfileRequest } from "./profile-adapters";

const agentProfilesPath = "/api/agent-profiles";

export function useAgentProfiles() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(agentProfilesPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListAgentProfilesResponseSchema, data, protobufJsonReadOptions) : undefined;
  return {
    profiles: response?.items || ([] as AgentProfileListItem[]),
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}

export function useAgentProfile(profileId?: string) {
  const key = profileId ? `${agentProfilesPath}/${encodeURIComponent(profileId)}` : null;
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(key, jsonFetcher<JsonValue>);
  return {
    profile: data ? fromJson(AgentProfileSchema, data, protobufJsonReadOptions) : undefined,
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}

export async function createAgentProfile(draft: AgentProfileDraft): Promise<AgentProfile> {
  return writeAgentProfile(agentProfilesPath, "POST", draft);
}

export async function updateAgentProfile(profileId: string, draft: AgentProfileDraft): Promise<AgentProfile> {
  return writeAgentProfile(`${agentProfilesPath}/${encodeURIComponent(profileId)}`, "PUT", draft);
}

export async function deleteAgentProfile(profileId: string) {
  await jsonRequest<void>(`${agentProfilesPath}/${encodeURIComponent(profileId)}`, { method: "DELETE" });
}

export function mutateAgentProfiles() {
  return mutate((key) => typeof key === "string" && key.startsWith(agentProfilesPath));
}

async function writeAgentProfile(path: string, method: "POST" | "PUT", draft: AgentProfileDraft) {
  const request = create(UpsertAgentProfileRequestSchema, draftToAgentProfileRequest(draft));
  const data = await jsonRequest<JsonValue>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toJson(UpsertAgentProfileRequestSchema, request))
  });
  return fromJson(AgentProfileSchema, data, protobufJsonReadOptions);
}
