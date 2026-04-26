import { create, fromJson, type JsonValue } from "@bufbuild/protobuf";
import { AgentResourcesSchema, InstructionKind, ToolKind } from "@code-code/agent-contract/agent/v1/cap";
import { ProviderRuntimeRefSchema } from "@code-code/agent-contract/provider/v1";
import { AgentProfileSchema, type AgentFallbackCandidate } from "@code-code/agent-contract/platform/agent-profile/v1";
import {
  AgentSessionRuntimeFallbackCandidateSchema,
  AgentSessionRuntimeConfigSchema,
  AgentSessionRuntimeModelSelectorSchema,
  type AgentSessionRuntimeFallbackCandidate,
  type AgentSessionRuntimeModelSelector,
} from "@code-code/agent-contract/platform/agent-session/v1";
import { MCPServerSchema } from "@code-code/agent-contract/platform/mcp/v1";
import { RuleSchema } from "@code-code/agent-contract/platform/rule/v1";
import { SkillSchema } from "@code-code/agent-contract/platform/skill/v1";
import { jsonRequest, protobufJsonReadOptions } from "@code-code/console-web-ui";
import {
  PROVIDER_MODEL_SELECTOR_CASE,
  createProviderFallbackModelSelector,
  createProviderModelSelector,
} from "./runtime-model-selector";
import type { ChatInlineSetup } from "./types";

export async function importInlineSetupFromProfile(profileId: string): Promise<ChatInlineSetup> {
  const profile = fromJson(
    AgentProfileSchema,
    await jsonRequest<JsonValue>(`/api/agent-profiles/${encodeURIComponent(profileId)}`),
    protobufJsonReadOptions,
  );
  const selection = profile.selectionStrategy;
  const primary = selection?.fallbacks[0];
  if (!selection || !primary?.providerRuntimeRef) {
    throw new Error("Selected profile is missing a primary runtime candidate.");
  }

  const [rules, skills, mcps] = await Promise.all([
    Promise.all((profile.ruleIds || []).map(loadRule)),
    Promise.all((profile.skillIds || []).map(loadSkill)),
    Promise.all((profile.mcpIds || []).map(loadMCP)),
  ]);

  return {
    providerId: selection.providerId,
    executionClass: selection.executionClass,
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      providerRuntimeRef: create(ProviderRuntimeRefSchema, primary.providerRuntimeRef),
      primaryModelSelector: runtimeModelSelector(primary),
      fallbacks: selection.fallbacks.slice(1).map(runtimeFallbackCandidate),
    }),
    resourceConfig: create(AgentResourcesSchema, {
      instructions: [
        ...rules.map((rule) => ({
          kind: InstructionKind.RULE,
          name: displayName(rule.name, rule.ruleId),
          content: rule.content,
        })),
        ...skills.map((skill) => ({
          kind: InstructionKind.SKILL,
          name: displayName(skill.name, skill.skillId),
          content: skill.content,
        })),
      ],
      toolBindings: mcps.map((mcp) => ({
        name: displayName(mcp.name, mcp.mcpId),
        kind: ToolKind.MCP,
        target: `mcp://${mcp.mcpId}`,
      })),
    }),
  };
}

async function loadRule(ruleId: string) {
  return fromJson(
    RuleSchema,
    await jsonRequest<JsonValue>(`/api/rules/${encodeURIComponent(ruleId)}`),
    protobufJsonReadOptions,
  );
}

async function loadSkill(skillId: string) {
  return fromJson(
    SkillSchema,
    await jsonRequest<JsonValue>(`/api/skills/${encodeURIComponent(skillId)}`),
    protobufJsonReadOptions,
  );
}

async function loadMCP(mcpId: string) {
  return fromJson(
    MCPServerSchema,
    await jsonRequest<JsonValue>(`/api/mcps/${encodeURIComponent(mcpId)}`),
    protobufJsonReadOptions,
  );
}

function runtimeModelSelector(candidate: AgentFallbackCandidate): AgentSessionRuntimeModelSelector | undefined {
  switch (candidate.modelSelector.case) {
    case "modelRef":
      return create(AgentSessionRuntimeModelSelectorSchema, {
        selector: { case: "modelRef", value: candidate.modelSelector.value },
      });
    case PROVIDER_MODEL_SELECTOR_CASE:
      return createProviderModelSelector(candidate.modelSelector.value);
    default:
      return undefined;
  }
}

function runtimeFallbackCandidate(candidate: AgentFallbackCandidate): AgentSessionRuntimeFallbackCandidate {
  if (candidate.modelSelector.case === "modelRef") {
    return create(AgentSessionRuntimeFallbackCandidateSchema, {
      providerRuntimeRef: create(ProviderRuntimeRefSchema, candidate.providerRuntimeRef),
      modelSelector: { case: "modelRef", value: candidate.modelSelector.value },
    });
  }
  return create(AgentSessionRuntimeFallbackCandidateSchema, {
    providerRuntimeRef: create(ProviderRuntimeRefSchema, candidate.providerRuntimeRef),
    modelSelector: createProviderFallbackModelSelector(candidate.modelSelector.value || ""),
  });
}

function displayName(name: string, fallback: string) {
  return name.trim() || fallback.trim();
}
