import { create, fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import { RuleSchema } from "@code-code/agent-contract/platform/rule/v1";
import { SkillSchema } from "@code-code/agent-contract/platform/skill/v1";
import {
  ListRulesResponseSchema,
  ListSkillsResponseSchema,
  UpsertRuleRequestSchema,
  UpsertSkillRequestSchema,
  type RuleListItem,
  type SkillListItem
} from "@code-code/agent-contract/platform/management/v1";
import useSWR, { mutate } from "swr";
import { jsonFetcher, jsonRequest, protobufJsonReadOptions } from "@code-code/console-web-ui";
import type { Rule } from "@code-code/agent-contract/platform/rule/v1";
import type { Skill } from "@code-code/agent-contract/platform/skill/v1";
import type { TextResourceDraft } from "./types";
import { draftToRuleRequest, draftToSkillRequest } from "./resource-adapters";

const skillsPath = "/api/skills";
const rulesPath = "/api/rules";

export function useSkills() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(skillsPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListSkillsResponseSchema, data, protobufJsonReadOptions) : undefined;
  return { skills: response?.items || ([] as SkillListItem[]), isLoading, isError: Boolean(error), error, mutate };
}

export function useSkill(skillId?: string) {
  const key = skillId ? `${skillsPath}/${encodeURIComponent(skillId)}` : null;
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(key, jsonFetcher<JsonValue>);
  return { skill: data ? fromJson(SkillSchema, data, protobufJsonReadOptions) : undefined, isLoading, isError: Boolean(error), error, mutate };
}

export async function getSkill(skillId: string): Promise<Skill> {
  const data = await jsonRequest<JsonValue>(`${skillsPath}/${encodeURIComponent(skillId)}`);
  return fromJson(SkillSchema, data, protobufJsonReadOptions);
}

export function useRules() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(rulesPath, jsonFetcher<JsonValue>);
  const response = data ? fromJson(ListRulesResponseSchema, data, protobufJsonReadOptions) : undefined;
  return { rules: response?.items || ([] as RuleListItem[]), isLoading, isError: Boolean(error), error, mutate };
}

export function useRule(ruleId?: string) {
  const key = ruleId ? `${rulesPath}/${encodeURIComponent(ruleId)}` : null;
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(key, jsonFetcher<JsonValue>);
  return { rule: data ? fromJson(RuleSchema, data, protobufJsonReadOptions) : undefined, isLoading, isError: Boolean(error), error, mutate };
}

export async function getRule(ruleId: string): Promise<Rule> {
  const data = await jsonRequest<JsonValue>(`${rulesPath}/${encodeURIComponent(ruleId)}`);
  return fromJson(RuleSchema, data, protobufJsonReadOptions);
}

export async function createSkill(draft: TextResourceDraft): Promise<Skill> {
  return writeSkill(skillsPath, "POST", draft);
}

export async function updateSkill(skillId: string, draft: TextResourceDraft): Promise<Skill> {
  return writeSkill(`${skillsPath}/${encodeURIComponent(skillId)}`, "PUT", draft);
}

export async function deleteSkill(skillId: string) {
  await jsonRequest<void>(`${skillsPath}/${encodeURIComponent(skillId)}`, { method: "DELETE" });
}

export function mutateSkills() {
  return mutate((key) => typeof key === "string" && key.startsWith(skillsPath));
}

export async function createRule(draft: TextResourceDraft): Promise<Rule> {
  return writeRule(rulesPath, "POST", draft);
}

export async function updateRule(ruleId: string, draft: TextResourceDraft): Promise<Rule> {
  return writeRule(`${rulesPath}/${encodeURIComponent(ruleId)}`, "PUT", draft);
}

export async function deleteRule(ruleId: string) {
  await jsonRequest<void>(`${rulesPath}/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
}

export function mutateRules() {
  return mutate((key) => typeof key === "string" && key.startsWith(rulesPath));
}

async function writeSkill(path: string, method: "POST" | "PUT", draft: TextResourceDraft) {
  const request = create(UpsertSkillRequestSchema, draftToSkillRequest(draft));
  const data = await jsonRequest<JsonValue>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toJson(UpsertSkillRequestSchema, request))
  });
  return fromJson(SkillSchema, data, protobufJsonReadOptions);
}

async function writeRule(path: string, method: "POST" | "PUT", draft: TextResourceDraft) {
  const request = create(UpsertRuleRequestSchema, draftToRuleRequest(draft));
  const data = await jsonRequest<JsonValue>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toJson(UpsertRuleRequestSchema, request))
  });
  return fromJson(RuleSchema, data, protobufJsonReadOptions);
}
