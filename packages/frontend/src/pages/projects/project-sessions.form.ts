import type {
  CreateSessionInput,
  OutputChunk,
  ProfileDetail,
  SendSessionMessageInput,
  SessionMessageDetail,
  SessionMessagePart,
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
  const upsertToolCallPart = (
    parts: SessionMessagePart[],
    toolChunk: Extract<OutputChunk, { kind: 'tool_use' }>
  ) => {
    const toolCallId = toolChunk.data.callId ?? String(toolChunk.eventId);
    const existingIndex = parts.findIndex(
      (part) =>
        part.type === 'tool_call' &&
        (part.toolCallId === toolCallId ||
          (!toolChunk.data.callId &&
            part.toolName === toolChunk.data.toolName &&
            part.result === undefined))
    );

    if (existingIndex === -1) {
      return [
        ...parts,
        {
          type: 'tool_call' as const,
          toolCallId,
          toolKind: toolChunk.data.toolKind,
          toolName: toolChunk.data.toolName,
          args: toolChunk.data.args,
          result: toolChunk.data.result,
          isError:
            toolChunk.data.error !== undefined ? true : undefined
        }
      ];
    }

    const existing = parts[existingIndex];
    if (existing.type !== 'tool_call') {
      return parts;
    }

    const nextParts = [...parts];
    nextParts[existingIndex] = {
      ...existing,
      toolKind: toolChunk.data.toolKind,
      args: toolChunk.data.args ?? existing.args,
      result: toolChunk.data.result ?? existing.result,
      isError:
        toolChunk.data.error !== undefined
          ? true
          : existing.isError
    };
    return nextParts;
  };

  const upsertToolUse = (
    message: SessionMessageDetail,
    toolChunk: Extract<OutputChunk, { kind: 'tool_use' }>
  ) => {
    const toolCallId = toolChunk.data.callId ?? null;
    const existingIndex = message.toolUses.findIndex(
      (toolUse) =>
        (toolCallId && toolUse.callId === toolCallId) ||
        (!toolCallId &&
          toolUse.toolName === toolChunk.data.toolName &&
          toolUse.result == null &&
          toolUse.error == null)
    );

    if (existingIndex === -1) {
      return [
        ...message.toolUses.filter(
          (toolUse) => toolUse.eventId !== toolChunk.eventId
        ),
        {
          id: `event_${toolChunk.eventId}`,
          eventId: toolChunk.eventId,
          callId: toolCallId,
          toolKind: toolChunk.data.toolKind,
          toolName: toolChunk.data.toolName,
          args: toolChunk.data.args,
          result: toolChunk.data.result ?? null,
          error: toolChunk.data.error ?? null,
          createdAt: new Date(toolChunk.timestampMs).toISOString()
        }
      ];
    }

    const nextToolUses = [...message.toolUses];
    const existing = nextToolUses[existingIndex];
    nextToolUses[existingIndex] = {
      ...existing,
      eventId: toolChunk.eventId,
      toolKind: toolChunk.data.toolKind,
      args: toolChunk.data.args ?? existing.args,
      result: toolChunk.data.result ?? existing.result ?? null,
      error: toolChunk.data.error ?? existing.error ?? null,
      createdAt: new Date(toolChunk.timestampMs).toISOString()
    };
    return nextToolUses;
  };

  const getNextPartsForChunk = (
    parts: SessionMessagePart[] | undefined,
    message: SessionMessageDetail
  ) => {
    const currentParts = parts ?? [];
    if (chunk.kind === 'thinking_delta' || chunk.kind === 'message_delta') {
      const isThinking = chunk.kind === 'thinking_delta';
      const currentText = isThinking ? message.thinkingText : message.outputText;
      const derivedDelta = chunk.data.accumulatedText
        ? chunk.data.accumulatedText.slice(currentText?.length || 0)
        : '';
      const actualDelta = derivedDelta || chunk.data.deltaText;
      if (!actualDelta) return currentParts;
      const type = isThinking ? 'thinking' : 'text';
      const lastPart = currentParts[currentParts.length - 1];
      const newParts = [...currentParts];
      if (lastPart?.type === type) {
        newParts[newParts.length - 1] = {
          ...lastPart,
          text: lastPart.text + actualDelta
        };
      } else {
        newParts.push({ type, text: actualDelta });
      }
      return newParts;
    }
    if (chunk.kind === 'tool_use') {
      return upsertToolCallPart(currentParts, chunk);
    }
    return currentParts;
  };

  switch (chunk.kind) {
    case 'thinking_delta':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              status: MessageStatusEnum.Streaming,
              contentParts: getNextPartsForChunk(message.contentParts, message),
              thinkingText:
                chunk.data.accumulatedText !== undefined
                  ? chunk.data.accumulatedText
                  : `${message.thinkingText ?? ''}${chunk.data.deltaText ?? ''}`
            }
          : message
      );
    case 'message_delta':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              status: MessageStatusEnum.Streaming,
              contentParts: getNextPartsForChunk(message.contentParts, message),
              outputText:
                chunk.data.accumulatedText !== undefined
                  ? chunk.data.accumulatedText
                  : `${message.outputText ?? ''}${chunk.data.deltaText ?? ''}`
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
              contentParts: getNextPartsForChunk(message.contentParts, message),
              toolUses: upsertToolUse(message, chunk)
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
