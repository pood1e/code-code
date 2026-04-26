import { MCPTransportKind, type MCPServer } from "@code-code/agent-contract/platform/mcp/v1";
import type { MCPServerListItem, RuleListItem, SkillListItem } from "@code-code/agent-contract/platform/management/v1";
import type { Rule } from "@code-code/agent-contract/platform/rule/v1";
import type { Skill } from "@code-code/agent-contract/platform/skill/v1";
import type { MCPResourceDraft, MCPResourceSummary, TextResourceDraft, TextResourceSummary } from "./types";

export function emptyMCPDraft(): MCPResourceDraft {
  return { id: "", name: "New MCP", transport: "stdio", command: "npx", args: "", env: "", endpoint: "", headers: "" };
}

export function emptyTextResourceDraft(kind: "skill" | "rule"): TextResourceDraft {
  return { id: "", name: kind === "skill" ? "New Skill" : "New Rule", description: "", content: "" };
}

export function mcpListItemToSummary(item: MCPServerListItem): MCPResourceSummary {
  return {
    id: item.mcpId,
    name: item.name,
    transport: item.transportKind === MCPTransportKind.MCP_TRANSPORT_KIND_STDIO ? "stdio" : "streamable-http",
    summary: item.transportSummary
  };
}

export function mcpToDraft(item: MCPServer): MCPResourceDraft {
  if (item.transport.case === "stdio") {
    const transport = item.transport.value;
    return {
      id: item.mcpId,
      name: item.name,
      transport: "stdio",
      command: transport.command,
      args: transport.args.join("\n"),
      env: transport.env.map((entry) => `${entry.name}=${entry.value}`).join("\n"),
      endpoint: "",
      headers: ""
    };
  }
  if (item.transport.case !== "streamableHttp") {
    return emptyMCPDraft();
  }
  const transport = item.transport.value;
  return {
    id: item.mcpId,
    name: item.name,
    transport: "streamable-http",
    command: "",
    args: "",
    env: "",
    endpoint: transport.endpointUrl,
    headers: transport.headers.map((entry) => `${entry.name}: ${entry.value}`).join("\n")
  };
}

export function draftToMCPRequest(draft: MCPResourceDraft) {
  return draft.transport === "stdio"
    ? {
        mcpId: draft.id,
        name: draft.name.trim(),
        transport: {
          case: "stdio" as const,
          value: { command: draft.command.trim(), args: splitLines(draft.args), env: parseKeyValueLines(draft.env, "=") }
        }
      }
    : {
        mcpId: draft.id,
        name: draft.name.trim(),
        transport: {
          case: "streamableHttp" as const,
          value: { endpointUrl: draft.endpoint.trim(), headers: parseKeyValueLines(draft.headers, ":") }
        }
      };
}

export function skillListItemToSummary(item: SkillListItem): TextResourceSummary {
  return { id: item.skillId, name: item.name, description: item.description };
}

export function ruleListItemToSummary(item: RuleListItem): TextResourceSummary {
  return { id: item.ruleId, name: item.name, description: item.description };
}

export function skillToDraft(item: Skill): TextResourceDraft {
  return { id: item.skillId, name: item.name, description: item.description, content: item.content };
}

export function ruleToDraft(item: Rule): TextResourceDraft {
  return { id: item.ruleId, name: item.name, description: item.description, content: item.content };
}

export function draftToSkillRequest(draft: TextResourceDraft) {
  return { skillId: draft.id, name: draft.name.trim(), description: draft.description.trim(), content: draft.content.trim() };
}

export function draftToRuleRequest(draft: TextResourceDraft) {
  return { ruleId: draft.id, name: draft.name.trim(), description: draft.description.trim(), content: draft.content.trim() };
}

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function parseKeyValueLines(value: string, separator: ":" | "=") {
  return splitLines(value).map((line) => {
    const index = line.indexOf(separator);
    if (index < 0) {
      return { name: line.trim(), value: "" };
    }
    return { name: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
  });
}
