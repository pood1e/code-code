import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ThreadPrimitive
} from '@assistant-ui/react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type {
  RunnerTypeResponse,
  SendSessionMessageInput,
  SessionDetail,
  SessionMessageDetail
} from '@agent-workbench/shared';
import React from 'react';

import { probeAgentRunnerContext } from '@/api/agent-runners';
import { queryKeys } from '@/query/query-keys';
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
  SessionMessageRuntimeMap,
  SessionAssistantMessageRecord
} from './thread-adapter';
import { buildSessionAssistantMessageRecords } from './thread-adapter';

import { ThreadConfigContext } from './context';
import { UserMessageBubble, UserMessageEditComposer } from './components/UserMessage';
import { AssistantMessageBubble } from './components/AssistantMessage';
import { ThreadComposerUI } from './components/ThreadComposerUI';

const VirtuosoScroller = React.forwardRef<HTMLDivElement, any>((props, ref) => {
  return (
    <>
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      <ThreadPrimitive.Viewport
        {...props}
        ref={ref}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto w-full scrollbar-hide"
        style={{ ...props.style, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      />
    </>
  );
});
VirtuosoScroller.displayName = 'VirtuosoScroller';

export function SessionAssistantThread({
  session,
  messages,
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
  runnerType: RunnerTypeResponse | undefined;
  runtimeState: SessionMessageRuntimeMap;
  onSend: (payload: SendSessionMessageInput) => Promise<void>;
  onCancel: () => Promise<void>;
  onReload: () => Promise<void>;
  onEdit: (messageId: string, payload: SendSessionMessageInput) => Promise<void>;
  onLoadMore?: () => void;
}) {
  const [firstItemIndex, setFirstItemIndex] = useState(100_000);
  const [prevFirstId, setPrevFirstId] = useState<string | undefined>(undefined);
  const [prevMessagesLength, setPrevMessagesLength] = useState<number>(0);

  if (messages.length > 0 && messages[0]?.id !== prevFirstId) {
    if (prevFirstId !== undefined) {
      const oldFirstIndex = messages.findIndex(m => m.id === prevFirstId);
      if (oldFirstIndex > 0) {
        setFirstItemIndex(prev => prev - oldFirstIndex);
      } else {
        setFirstItemIndex(prev => prev - Math.max(0, messages.length - prevMessagesLength));
      }
    }
    setPrevFirstId(messages[0]?.id);
  }
  if (messages.length !== prevMessagesLength) {
    setPrevMessagesLength(messages.length);
  }

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
  
  const previousRecordsRef = useRef<SessionAssistantMessageRecord[]>([]);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

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
            {messages.length === 0 ? (
              <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-0">
                <div className="flex min-h-[18rem] flex-col items-center justify-center gap-2 text-center">
                  <p className="text-base font-medium text-foreground">开始对话</p>
                  <p className="text-sm text-muted-foreground">消息会显示在这里</p>
                </div>
              </ThreadPrimitive.Viewport>
            ) : (
              <Virtuoso
                ref={virtuosoRef}
                className="min-h-0 flex-1 w-full"
                data={messages}
                firstItemIndex={firstItemIndex}
                initialTopMostItemIndex={messages.length > 0 ? firstItemIndex + messages.length - 1 : 0}
                alignToBottom={true}
                computeItemKey={(index, message) => message.id}
                startReached={onLoadMore}
                followOutput="smooth"
                components={{
                  Scroller: VirtuosoScroller,
                  Header: () => <div className="h-5" />,
                  Footer: () => <div className="h-5" />
                }}
                itemContent={(index, message) => {
                  const relativeIndex = index - firstItemIndex;
                  if (relativeIndex >= messages.length || relativeIndex < 0) {
                    return <div className="pb-3 px-4 sm:px-5 text-red-500">Error: Index bounds {index} - {firstItemIndex} = {relativeIndex} vs {messages.length}</div>;
                  }
                  return (
                    <div className="pb-3 px-4 sm:px-5">
                      <ThreadPrimitive.MessageByIndex 
                        index={relativeIndex} 
                        components={{
                          UserMessage: UserMessageBubble,
                          UserEditComposer: UserMessageEditComposer,
                          AssistantMessage: AssistantMessageBubble
                        }}
                      />
                    </div>
                  );
                }}
              />
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
