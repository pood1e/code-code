import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ThreadPrimitive } from '@assistant-ui/react';
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import type {
  RunnerTypeResponse,
  SendSessionMessageInput,
  SessionDetail,
  SessionMessageDetail
} from '@agent-workbench/shared';

import { probeAgentRunnerContext } from '@/api/agent-runners';
import { queryKeys } from '@/query/query-keys';
import { parseRunnerConfigSchema } from '@/lib/runner-config-schema';
import { parseSessionInputText } from '@/features/chat/runtime/assistant-ui/input-payload';

import {
  buildAdditionalInputInitialValues,
  buildStructuredMessagePayload,
  getAdditionalInputFields,
  getPrimaryInputField,
  omitPrimaryFieldValue
} from './input-schema';
import { SessionAssistantRuntimeProvider } from './SessionAssistantRuntimeProvider';
import type {
  SessionMessageRuntimeMap,
  SessionAssistantMessageRecord
} from './thread-adapter';
import { buildSessionAssistantMessageRecords } from './thread-adapter';
import { ThreadConfigContext } from './context';
import { ThreadComposerUI } from './components/ThreadComposerUI';

const SessionAssistantThreadHistory = lazy(async () => {
  const module = await import('./SessionAssistantThreadHistory');
  return { default: module.SessionAssistantThreadHistory };
});

function buildFallbackTextPayload(composerText: string): SendSessionMessageInput {
  return {
    input: {
      prompt: composerText.trim()
    }
  };
}

function buildRawJsonComposerPayload(composerText: string): SendSessionMessageInput {
  const parsed = parseSessionInputText(composerText);
  if (!parsed.data) {
    throw new Error(parsed.error ?? '消息输入校验失败');
  }

  return parsed.data;
}

export function SessionAssistantThread({
  session,
  messages,
  messagesReady,
  runnerType,
  runtimeState,
  onSend,
  onCancel,
  onReload,
  onEdit,
  onLoadMore
}: {
  session: SessionDetail;
  messages: SessionMessageDetail[];
  messagesReady: boolean;
  runnerType: RunnerTypeResponse | undefined;
  runtimeState: SessionMessageRuntimeMap;
  onSend: (payload: SendSessionMessageInput) => Promise<void>;
  onCancel: () => Promise<void>;
  onReload: () => Promise<void>;
  onEdit: (
    messageId: string,
    payload: SendSessionMessageInput
  ) => Promise<void>;
  onLoadMore?: () => void;
}) {
  const [firstItemIndex, setFirstItemIndex] = useState(100_000);
  const prevFirstIdRef = useRef<string | undefined>(undefined);
  const prevMessagesLengthRef = useRef<number>(0);

  useEffect(() => {
    if (messages.length > 0 && messages[0]?.id !== prevFirstIdRef.current) {
      if (prevFirstIdRef.current !== undefined) {
        const oldFirstIndex = messages.findIndex(
          (message) => message.id === prevFirstIdRef.current
        );

        setFirstItemIndex((current) =>
          current -
          (oldFirstIndex > 0
            ? oldFirstIndex
            : Math.max(0, messages.length - prevMessagesLengthRef.current))
        );
      }

      prevFirstIdRef.current = messages[0]?.id;
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

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
  const structuredRuntimeSchema = runtimeSchema.supported
    ? runtimeSchema
    : undefined;
  const runtimeFields = useMemo(
    () => structuredRuntimeSchema?.fields ?? [],
    [structuredRuntimeSchema]
  );

  const initialRuntimeValues = useMemo(() => {
    const defaults = buildAdditionalInputInitialValues(runtimeFields);
    return session.defaultRuntimeConfig
      ? { ...defaults, ...session.defaultRuntimeConfig }
      : defaults;
  }, [runtimeFields, session.defaultRuntimeConfig]);

  const additionalValuesRef = useRef<Record<string, unknown>>(
    initialAdditionalInputValues
  );
  const runtimeValuesRef =
    useRef<Record<string, unknown>>(initialRuntimeValues);
  const [composerKey, setComposerKey] = useState(0);
  const [composerError, setComposerError] = useState<string | null>(null);
  const supportsTextComposer = Boolean(
    structuredInputSchema && primaryInputField
  );
  const composerMode = !runnerType
    ? 'text'
    : supportsTextComposer
      ? 'text'
      : 'raw-json';

  const previousRecordsRef = useRef<SessionAssistantMessageRecord[]>([]);
  const runtimeMessages = useMemo(() => {
    return buildSessionAssistantMessageRecords(
      messages,
      runtimeState,
      previousRecordsRef.current
    );
  }, [messages, runtimeState]);

  useEffect(() => {
    previousRecordsRef.current = runtimeMessages;
  }, [runtimeMessages]);

  const configContextValue = useMemo(
    () => ({ assistantName: runnerType?.name || 'Agent' }),
    [runnerType?.name]
  );

  const { data: runnerContext } = useQuery({
    queryKey: queryKeys.agentRunners.context(session.runnerId),
    queryFn: () => probeAgentRunnerContext(session.runnerId),
    staleTime: 60 * 1000
  });

  return (
    <SessionAssistantRuntimeProvider
      messages={runtimeMessages}
      messagesReady={messagesReady}
      status={session.status}
      onNew={async (composerText) => {
        setComposerError(null);

        try {
          const payload = supportsTextComposer
            ? buildStructuredMessagePayload({
                schema: structuredInputSchema!,
                runtimeSchema: structuredRuntimeSchema ?? {
                  supported: false as const,
                  reason: '不支持'
                },
                primaryField: primaryInputField!,
                composerText,
                additionalValues: additionalValuesRef.current,
                runtimeValues: runtimeValuesRef.current
              })
            : !runnerType
              ? buildFallbackTextPayload(composerText)
              : buildRawJsonComposerPayload(composerText);

          await onSend(payload);
          if (supportsTextComposer) {
            additionalValuesRef.current = initialAdditionalInputValues;
            setComposerKey((k) => k + 1);
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
        const originalMessage = messages.find(
          (message) => message.id === messageId
        );
        if (!originalMessage) {
          throw new Error('编辑目标消息不存在');
        }

        const payload = supportsTextComposer
          ? buildStructuredMessagePayload({
              schema: structuredInputSchema!,
              runtimeSchema: structuredRuntimeSchema ?? {
                supported: false as const,
                reason: '不支持'
              },
              primaryField: primaryInputField!,
              composerText,
              additionalValues: omitPrimaryFieldValue(
                originalMessage.inputContent,
                primaryInputField?.name
              ),
              runtimeValues: runtimeValuesRef.current
            })
          : !runnerType
            ? buildFallbackTextPayload(composerText)
            : buildRawJsonComposerPayload(composerText);

        await onEdit(messageId, payload);
      }}
    >
      <ThreadConfigContext.Provider value={configContextValue}>
        <SessionAssistantThreadBody
          records={runtimeMessages}
          messagesReady={messagesReady}
          firstItemIndex={firstItemIndex}
          onLoadMore={onLoadMore}
          onReload={onReload}
          composerKey={composerKey}
          composerMode={composerMode}
          additionalInputFields={additionalInputFields}
          initialAdditionalInputValues={initialAdditionalInputValues}
          runtimeFields={runtimeFields}
          initialRuntimeValues={initialRuntimeValues}
          composerError={composerError}
          runnerContext={runnerContext}
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
      </ThreadConfigContext.Provider>
    </SessionAssistantRuntimeProvider>
  );
}

function SessionAssistantThreadBody({
  records,
  messagesReady,
  firstItemIndex,
  onLoadMore,
  onReload,
  composerKey,
  composerMode,
  additionalInputFields,
  initialAdditionalInputValues,
  runtimeFields,
  initialRuntimeValues,
  composerError,
  runnerContext,
  onAdditionalValueChange,
  onRuntimeValueChange
}: {
  records: SessionAssistantMessageRecord[];
  messagesReady: boolean;
  firstItemIndex: number;
  onLoadMore?: () => void;
  onReload: () => Promise<void>;
  composerKey: number;
  composerMode: 'text' | 'raw-json';
  additionalInputFields: ReturnType<typeof getAdditionalInputFields>;
  initialAdditionalInputValues: Record<string, unknown>;
  runtimeFields: ReturnType<typeof getAdditionalInputFields>;
  initialRuntimeValues: Record<string, unknown>;
  composerError: string | null;
  runnerContext:
    | Record<string, Array<{ label: string; value: string } | string>>
    | undefined;
  onAdditionalValueChange: (fieldName: string, value: unknown) => void;
  onRuntimeValueChange: (fieldName: string, value: unknown) => void;
}) {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      {records.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-0">
          {messagesReady ? (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-2 text-center">
              <p className="text-base font-medium text-foreground">开始对话</p>
              <p className="text-sm text-muted-foreground">
                消息会显示在这里
              </p>
            </div>
          ) : (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin" />
              <p className="text-sm">正在加载历史消息...</p>
            </div>
          )}
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-0">
              <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <LoaderCircle className="size-5 animate-spin" />
                <p className="text-sm">正在渲染消息...</p>
              </div>
            </div>
          }
        >
          <SessionAssistantThreadHistory
            records={records}
            firstItemIndex={firstItemIndex}
            onLoadMore={onLoadMore}
            onReload={onReload}
          />
        </Suspense>
      )}

      <ThreadComposerUI
        key={composerKey}
        mode={composerMode}
        additionalFields={additionalInputFields}
        initialAdditionalValues={initialAdditionalInputValues}
        runtimeFields={runtimeFields}
        initialRuntimeValues={initialRuntimeValues}
        composerError={composerError}
        discoveredOptions={runnerContext}
        onAdditionalValueChange={onAdditionalValueChange}
        onRuntimeValueChange={onRuntimeValueChange}
      />
    </ThreadPrimitive.Root>
  );
}
