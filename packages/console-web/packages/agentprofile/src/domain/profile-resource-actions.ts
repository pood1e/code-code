import {
  createMCPServer,
  deleteMCPServer,
  getMCPServer,
  mutateMCPServers,
  updateMCPServer,
} from "./mcp-api";
import { mutateAgentProfiles } from "./profile-api";
import { mcpToDraft, ruleToDraft, skillToDraft } from "./resource-adapters";
import {
  createRule,
  createSkill,
  deleteRule,
  deleteSkill,
  getRule,
  getSkill,
  mutateRules,
  mutateSkills,
  updateRule,
  updateSkill,
} from "./text-resource-api";
import type { MCPResourceDraft, TextResourceDraft } from "./types";

export async function loadMCPResourceDraft(id: string) {
  return mcpToDraft(await getMCPServer(id));
}

export async function saveMCPResourceDraft(item: MCPResourceDraft) {
  if (item.id) {
    await updateMCPServer(item.id, item);
  } else {
    await createMCPServer(item);
  }
  await Promise.all([mutateMCPServers(), mutateAgentProfiles()]);
}

export async function deleteMCPResourceDraft(id: string) {
  await deleteMCPServer(id);
  await Promise.all([mutateMCPServers(), mutateAgentProfiles()]);
}

export async function loadSkillResourceDraft(id: string) {
  return skillToDraft(await getSkill(id));
}

export async function saveSkillResourceDraft(item: TextResourceDraft) {
  if (item.id) {
    await updateSkill(item.id, item);
  } else {
    await createSkill(item);
  }
  await Promise.all([mutateSkills(), mutateAgentProfiles()]);
}

export async function deleteSkillResourceDraft(id: string) {
  await deleteSkill(id);
  await Promise.all([mutateSkills(), mutateAgentProfiles()]);
}

export async function loadRuleResourceDraft(id: string) {
  return ruleToDraft(await getRule(id));
}

export async function saveRuleResourceDraft(item: TextResourceDraft) {
  if (item.id) {
    await updateRule(item.id, item);
  } else {
    await createRule(item);
  }
  await Promise.all([mutateRules(), mutateAgentProfiles()]);
}

export async function deleteRuleResourceDraft(id: string) {
  await deleteRule(id);
  await Promise.all([mutateRules(), mutateAgentProfiles()]);
}
