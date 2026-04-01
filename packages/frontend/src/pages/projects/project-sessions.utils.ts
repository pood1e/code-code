import type {
  CreateSessionInput,
  OutputChunk,
  ProfileDetail,
  SendSessionMessageInput,
  SessionMessageDetail,
  SessionStatus
} from '@agent-workbench/shared';
import {
  MessageRole as MessageRoleEnum,
  MessageStatus as MessageStatusEnum,
  SessionStatus as SessionStatusEnum,
  createSessionInputSchema,
  sendSessionMessageInputSchema
} from '@agent-workbench/shared';
import { z } from 'zod';

export const createSessionFormSchema = z.object({
  runnerId: z.string().trim().min(1, '请选择 AgentRunner'),
  profileId: z.string().trim().optional(),
  skillIds: z.array(z.string()),
  ruleIds: z.array(z.string()),
  mcpIds: z.array(z.string()),
  runnerSessionConfig: z.record(z.string(), z.unknown())
});

export const sessionTextInputSchema = z.object({
  prompt: z.string().trim().min(1, '请输入消息内容'),
  systemPrompt: z.string().trim().optional()
});

export type CreateSessionFormValues = z.infer<typeof createSessionFormSchema>;
export type SessionTextInputValues = z.infer<typeof sessionTextInputSchema>;

export function buildCreateSessionFormValues(): CreateSessionFormValues {
  return {
    runnerId: '',
    profileId: '',
    skillIds: [],
    ruleIds: [],
    mcpIds: [],
    runnerSessionConfig: {}
  };
}

export function buildCreateSessionPayload(
  scopeId: string,
  values: CreateSessionFormValues,
  profileDetail?: ProfileDetail
): CreateSessionInput {
  const profileMcpOverrides = new Map(
    (profileDetail?.mcps ?? []).map((item) => [item.id, item.configOverride])
  );

  return createSessionInputSchema.parse({
    scopeId,
    runnerId: values.runnerId,
    skillIds: values.skillIds,
    ruleIds: values.ruleIds,
    mcps: values.mcpIds.map((resourceId) => ({
      resourceId,
      configOverride: profileMcpOverrides.get(resourceId)
    })),
    runnerSessionConfig: values.runnerSessionConfig
  });
}

export function buildTextMessagePayload(
  values: SessionTextInputValues
): SendSessionMessageInput {
  return sendSessionMessageInputSchema.parse({
    input: {
      prompt: values.prompt.trim(),
      systemPrompt: values.systemPrompt?.trim() || undefined
    }
  });
}

export function parseRawInputText(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        error: '消息输入必须是 JSON 对象。'
      };
    }

    return {
      data: sendSessionMessageInputSchema.parse({
        input: parsed
      })
    };
  } catch {
    return {
      error: '消息输入不是有效的 JSON。'
    };
  }
}

export function getSessionStatusLabel(status: SessionStatus) {
  switch (status) {
    case SessionStatusEnum.Creating:
      return '创建中';
    case SessionStatusEnum.Ready:
      return '就绪';
    case SessionStatusEnum.Running:
      return '运行中';
    case SessionStatusEnum.Disposing:
      return '销毁中';
    case SessionStatusEnum.Disposed:
      return '已销毁';
    case SessionStatusEnum.Error:
      return '异常';
  }
}

export function getMessagePreview(message: SessionMessageDetail) {
  if (message.role === MessageRoleEnum.User) {
    return (
      getPromptValue(message.inputContent) ??
      JSON.stringify(message.inputContent ?? {})
    );
  }

  if (message.outputText?.trim()) {
    return message.outputText.trim();
  }

  if (message.errorPayload) {
    return message.errorPayload.message;
  }

  return '等待响应...';
}

export function applyOutputChunkToMessages(
  messages: SessionMessageDetail[],
  chunk: OutputChunk
) {
  switch (chunk.kind) {
    case 'message_delta':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              status: MessageStatusEnum.Streaming,
              outputText:
                chunk.data.accumulatedText ?? chunk.data.deltaText ?? message.outputText
            }
          : message
      );
    case 'message_result':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              status: MessageStatusEnum.Complete,
              outputText: chunk.data.text,
              eventId: chunk.eventId
            }
          : message
      );
    case 'error':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              status: MessageStatusEnum.Error,
              errorPayload: chunk.data,
              eventId: chunk.eventId
            }
          : message
      );
    case 'tool_use':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              toolUses: [
                ...message.toolUses.filter(
                  (toolUse) => toolUse.eventId !== chunk.eventId
                ),
                {
                  id: `event_${chunk.eventId}`,
                  eventId: chunk.eventId,
                  callId: chunk.data.callId ?? null,
                  toolName: chunk.data.toolName,
                  args: chunk.data.args,
                  result: chunk.data.result,
                  error: chunk.data.error,
                  createdAt: new Date(chunk.timestampMs).toISOString()
                }
              ]
            }
          : message
      );
    default:
      return messages;
  }
}

export function getPromptValue(input: Record<string, unknown> | null) {
  if (!input) {
    return null;
  }

  return typeof input.prompt === 'string' ? input.prompt : null;
}
