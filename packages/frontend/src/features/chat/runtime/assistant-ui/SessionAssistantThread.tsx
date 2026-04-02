import { useMemo, useState, useRef } from 'react';
import {
  ThreadPrimitive
} from '@assistant-ui/react';
import type {
  RunnerTypeResponse,
  SendSessionMessageInput,
  SessionDetail,
  SessionMessageDetail
} from '@agent-workbench/shared';
import React from 'react';

import {
  parseRunnerConfigSchema
} from '@/lib/runner-config-schema';
import {
  parseSessionInputText
} from '@/features/chat/runtime/assistant-ui/input-payload';

import {
  buildAdditionalInputInitialValues,
  buildStructuredMessagePayload,
  getAdditionalInputFields,
  getPrimaryInputField,
  omitPrimaryFieldValue
} from './input-schema';
import { SessionAssistantRuntimeProvider } from './SessionAssistantRuntimeProvider';

import type {
  SessionMessageRuntimeMap
} from './thread-adapter';
import { buildSessionAssistantMessageRecords } from './thread-adapter';

import { ThreadConfigContext } from './context';
import { UserMessageBubble, UserMessageEditComposer } from './components/UserMessage';
import { AssistantMessageBubble } from './components/AssistantMessage';
import { ThreadComposerUI } from './components/ThreadComposerUI';

export function SessionAssistantThread({
  session,
  messages,
  runnerType,
  runtimeState,
  onSend,
  onCancel,
  onReload,
  onEdit
}: {
  session: SessionDetail;
  messages: SessionMessageDetail[];
  runnerType: RunnerTypeResponse | undefined;
  runtimeState: SessionMessageRuntimeMap;
  onSend: (payload: SendSessionMessageInput) => Promise<void>;
  onCancel: () => Promise<void>;
  onReload: () => Promise<void>;
  onEdit: (messageId: string, payload: SendSessionMessageInput) => Promise<void>;
}) {
  const inputSchema = useMemo(
    () => parseRunnerConfigSchema(runnerType?.inputSchema),
    [runnerType]
  );
  const structuredInputSchema = inputSchema.supported ? inputSchema : undefined;
  const primaryInputField = useMemo(() => {
    if (!structuredInputSchema) {
      return undefined;
    }

    return getPrimaryInputField(structuredInputSchema.fields);
  }, [structuredInputSchema]);
  const additionalInputFields = useMemo(() => {
    if (!structuredInputSchema) {
      return [];
    }

    return getAdditionalInputFields(structuredInputSchema, primaryInputField);
  }, [primaryInputField, structuredInputSchema]);
  const initialAdditionalInputValues = useMemo(
    () => buildAdditionalInputInitialValues(additionalInputFields),
    [additionalInputFields]
  );
  
  const runtimeSchema = useMemo(
    () => parseRunnerConfigSchema(runnerType?.runtimeConfigSchema),
    [runnerType]
  );
  const structuredRuntimeSchema = runtimeSchema.supported ? runtimeSchema : undefined;
  const runtimeFields = useMemo(() => structuredRuntimeSchema?.fields ?? [], [structuredRuntimeSchema]);
  
  const initialRuntimeValues = useMemo(() => {
    const defaults = buildAdditionalInputInitialValues(runtimeFields);
    return session.defaultRuntimeConfig
      ? { ...defaults, ...session.defaultRuntimeConfig }
      : defaults;
  }, [runtimeFields, session.defaultRuntimeConfig]);

  const additionalValuesRef = useRef<Record<string, unknown>>(initialAdditionalInputValues);
  const runtimeValuesRef = useRef<Record<string, unknown>>(initialRuntimeValues);
  const [composerKey, setComposerKey] = useState(0);
  const [composerError, setComposerError] = useState<string | null>(null);
  const supportsTextComposer = Boolean(structuredInputSchema && primaryInputField);
  const composerMode = !runnerType ? 'text' : supportsTextComposer ? 'text' : 'raw-json';
  
  const runtimeMessages = useMemo(
    () => buildSessionAssistantMessageRecords(messages, runtimeState),
    [messages, runtimeState]
  );

  const configContextValue = useMemo(
    () => ({ assistantName: runnerType?.name || 'Agent' }),
    [runnerType?.name]
  );

  return (
    <SessionAssistantRuntimeProvider
      messages={runtimeMessages}
      status={session.status}
      onNew={async (composerText) => {
        setComposerError(null);

        try {
          const payload = supportsTextComposer
            ? buildStructuredMessagePayload({
                schema: structuredInputSchema!,
                runtimeSchema: structuredRuntimeSchema ?? { supported: false as const, reason: '不支持' },
                primaryField: primaryInputField!,
                composerText,
                additionalValues: additionalValuesRef.current,
                runtimeValues: runtimeValuesRef.current
              })
            : (() => {
                const parsed = parseSessionInputText(composerText);
                if (!parsed.data) {
                  throw new Error(parsed.error ?? '消息输入校验失败');
                }
                return parsed.data;
              })();

          await onSend(payload);
          if (supportsTextComposer) {
            additionalValuesRef.current = initialAdditionalInputValues;
            setComposerKey(k => k + 1);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : '发送消息失败';
          setComposerError(message);
          throw error;
        }
      }}
      onCancel={onCancel}
      onReload={onReload}
      onEdit={async (messageId, composerText) => {
        const originalMessage = messages.find((message) => message.id === messageId);
        if (!originalMessage) {
          throw new Error('编辑目标消息不存在');
        }

        const payload = supportsTextComposer
          ? buildStructuredMessagePayload({
              schema: structuredInputSchema!,
              runtimeSchema: structuredRuntimeSchema ?? { supported: false as const, reason: '不支持' },
              primaryField: primaryInputField!,
              composerText,
              additionalValues: omitPrimaryFieldValue(
                originalMessage.inputContent,
                primaryInputField?.name
              ),
              runtimeValues: runtimeValuesRef.current
            })
          : (() => {
              const parsed = parseSessionInputText(composerText);
              if (!parsed.data) {
                throw new Error(parsed.error ?? '消息输入校验失败');
              }
              return parsed.data;
            })();

        await onEdit(messageId, payload);
      }}
    >
      <ThreadConfigContext.Provider value={configContextValue}>
        <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
          <ThreadPrimitive.Viewport
            className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
            autoScroll
          >
            {messages.length === 0 ? (
              <div className="flex min-h-[18rem] flex-col items-center justify-center gap-2 text-center">
                <p className="text-base font-medium text-foreground">开始对话</p>
                <p className="text-sm text-muted-foreground">消息会显示在这里</p>
              </div>
            ) : (
              <div className="space-y-3">
                <ThreadPrimitive.Messages
                  components={{
                    UserMessage: UserMessageBubble,
                    UserEditComposer: UserMessageEditComposer,
                    AssistantMessage: AssistantMessageBubble
                  }}
                />
              </div>
            )}
          </ThreadPrimitive.Viewport>

          <ThreadComposerUI
            key={composerKey}
            mode={composerMode}
            additionalFields={additionalInputFields}
            initialAdditionalValues={initialAdditionalInputValues}
            runtimeFields={runtimeFields}
            initialRuntimeValues={initialRuntimeValues}
            composerError={composerError}
            onAdditionalValueChange={(fieldName: string, value: unknown) => {
              additionalValuesRef.current = {
                ...additionalValuesRef.current,
                [fieldName]: value
              };
            }}
            onRuntimeValueChange={(fieldName: string, value: unknown) => {
              runtimeValuesRef.current = {
                ...runtimeValuesRef.current,
                [fieldName]: value
              };
            }}
          />
        </ThreadPrimitive.Root>
      </ThreadConfigContext.Provider>
    </SessionAssistantRuntimeProvider>
  );
}
