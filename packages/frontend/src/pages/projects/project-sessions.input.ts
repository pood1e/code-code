import type {
  CreateSessionInput,
  ProfileDetail,
  SendSessionMessageInput,
  SessionWorkspaceResourceConfig,
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
  useCustomRunDirectory: z.boolean(),
  customRunDirectory: z.string().trim().optional(),
  workspaceResources: z.array(z.nativeEnum(SessionWorkspaceResourceKindEnum)),
  workspaceResourceConfig: z
    .object({
      code: z
        .object({
          branch: z.string().trim().optional()
        })
        .optional(),
      doc: z
        .object({
          branch: z.string().trim().optional()
        })
        .optional()
    })
    .optional(),
  skillIds: z.array(z.string()),
  ruleIds: z.array(z.string()),
  mcpIds: z.array(z.string()),
  runnerSessionConfig: z.record(z.string(), z.unknown()),
  initialMessageText: z.string().trim().optional(),
  initialInputConfig: z.record(z.string(), z.unknown()),
  initialRuntimeConfig: z.record(z.string(), z.unknown()),
  initialRawInput: z.string().optional()
}).superRefine((value, context) => {
  if (!value.useCustomRunDirectory) {
    return;
  }

  const customRunDirectory = value.customRunDirectory?.trim() ?? '';
  if (customRunDirectory.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customRunDirectory'],
      message: '请输入运行目录'
    });
    return;
  }

  if (customRunDirectory.startsWith('/')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customRunDirectory'],
      message: '运行目录必须是相对路径'
    });
  }

  if (customRunDirectory.split('/').some((segment) => segment === '..')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customRunDirectory'],
      message: '运行目录必须位于 Session 目录内'
    });
  }
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
    useCustomRunDirectory: false,
    customRunDirectory: '',
    workspaceResources: [],
    workspaceResourceConfig: {},
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
    customRunDirectory:
      values.useCustomRunDirectory && values.customRunDirectory?.trim()
        ? values.customRunDirectory.trim()
        : undefined,
    workspaceResources:
      values.workspaceResources as SessionWorkspaceResourceKind[],
    workspaceResourceConfig: buildWorkspaceResourceConfig(values),
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

function buildWorkspaceResourceConfig(
  values: CreateSessionFormValues
): SessionWorkspaceResourceConfig {
  const resourceConfig: SessionWorkspaceResourceConfig = {};

  if (values.workspaceResources.includes(SessionWorkspaceResourceKindEnum.Code)) {
    const branch = values.workspaceResourceConfig?.code?.branch?.trim();
    if (branch) {
      resourceConfig.code = { branch };
    }
  }

  if (values.workspaceResources.includes(SessionWorkspaceResourceKindEnum.Doc)) {
    const branch = values.workspaceResourceConfig?.doc?.branch?.trim();
    if (branch) {
      resourceConfig.doc = { branch };
    }
  }

  return resourceConfig;
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
