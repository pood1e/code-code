import type {
  CreateSessionInput,
  ProfileDetail,
  SendSessionMessageInput,
  SessionWorkspaceResourceKind
} from '@agent-workbench/shared';
import {
  createSessionInputSchema,
  sendSessionMessageInputSchema,
  SessionWorkspaceResourceKind as SessionWorkspaceResourceKindEnum
} from '@agent-workbench/shared';
import { z } from 'zod';

export const createSessionFormSchema = z.object({
  runnerId: z.string().trim().min(1, '请选择 AgentRunner'),
  profileId: z.string().trim().optional(),
  workspaceResources: z.array(z.nativeEnum(SessionWorkspaceResourceKindEnum)),
  skillIds: z.array(z.string()),
  ruleIds: z.array(z.string()),
  mcpIds: z.array(z.string()),
  runnerSessionConfig: z.record(z.string(), z.unknown()),
  initialMessageText: z.string().trim().optional(),
  initialInputConfig: z.record(z.string(), z.unknown()),
  initialRuntimeConfig: z.record(z.string(), z.unknown()),
  initialRawInput: z.string().optional()
});

export const sessionTextInputSchema = z.object({
  prompt: z.string().trim().min(1, '请输入消息内容')
});

export type CreateSessionFormValues = z.infer<typeof createSessionFormSchema>;
export type SessionTextInputValues = z.infer<typeof sessionTextInputSchema>;

export function buildCreateSessionFormValues(): CreateSessionFormValues {
  return {
    runnerId: '',
    profileId: '',
    workspaceResources: [],
    skillIds: [],
    ruleIds: [],
    mcpIds: [],
    runnerSessionConfig: {},
    initialMessageText: '',
    initialInputConfig: {},
    initialRuntimeConfig: {},
    initialRawInput: ''
  };
}

export function buildCreateSessionPayload(
  scopeId: string,
  values: CreateSessionFormValues,
  profileDetail?: ProfileDetail,
  initialMessage?: SendSessionMessageInput
): CreateSessionInput {
  return createSessionInputSchema.parse({
    scopeId,
    runnerId: values.runnerId,
    workspaceResources:
      values.workspaceResources as SessionWorkspaceResourceKind[],
    skillIds: values.skillIds,
    ruleIds: values.ruleIds,
    mcps: values.mcpIds.map((resourceId) => ({
      resourceId,
      configOverride: getProfileMcpOverride(profileDetail, resourceId)
    })),
    runnerSessionConfig: values.runnerSessionConfig,
    initialMessage
  });
}

export function buildTextMessagePayload(
  values: SessionTextInputValues
): SendSessionMessageInput {
  return sendSessionMessageInputSchema.parse({
    input: {
      prompt: values.prompt.trim()
    }
  });
}

function getProfileMcpOverride(
  profileDetail: ProfileDetail | undefined,
  resourceId: string
) {
  return profileDetail?.mcps.find((item) => item.id === resourceId)?.configOverride;
}
