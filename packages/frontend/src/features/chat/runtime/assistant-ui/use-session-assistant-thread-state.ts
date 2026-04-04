import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  RunnerTypeResponse,
  SendSessionMessageInput,
  SessionDetail,
  SessionMessageDetail
} from '@agent-workbench/shared';

import { probeAgentRunnerContext } from '@/api/agent-runners';
import { parseSessionInputText } from '@/features/chat/runtime/assistant-ui/input-payload';
import { parseRunnerConfigSchema } from '@/lib/runner-config-schema';
import { queryKeys } from '@/query/query-keys';

import {
  buildAdditionalInputInitialValues,
  buildStructuredMessagePayload,
  getAdditionalInputFields,
  getPrimaryInputField,
  omitPrimaryFieldValue
} from './input-schema';
import type { SessionMessageRuntimeMap } from './thread-adapter';
import { buildSessionAssistantMessageRecords } from './thread-adapter';

export function useSessionAssistantThreadState({
  messages,
  onEdit,
  onSend,
  runnerType,
  runtimeState,
  session
}: {
  messages: SessionMessageDetail[];
  onEdit: (
    messageId: string,
    payload: SendSessionMessageInput
  ) => Promise<void>;
  onSend: (payload: SendSessionMessageInput) => Promise<void>;
  runnerType: RunnerTypeResponse | undefined;
  runtimeState: SessionMessageRuntimeMap;
  session: SessionDetail;
}) {
  const firstItemIndex = useSessionMessageFirstItemIndex(messages);
  const composerSchemaState = useComposerSchemaState(runnerType, session);
  const previousRecordsRef = useRef(
    buildSessionAssistantMessageRecords([], {}, [])
  );
  const runtimeMessages = useMemo(
    () =>
      buildSessionAssistantMessageRecords(
        messages,
        runtimeState,
        previousRecordsRef.current
      ),
    [messages, runtimeState]
  );
  const [composerKey, setComposerKey] = useState(0);
  const [composerError, setComposerError] = useState<string | null>(null);
  const composerDraftState = useComposerDraftState({
    initialAdditionalValues: composerSchemaState.initialAdditionalInputValues,
    initialRuntimeValues: composerSchemaState.initialRuntimeValues
  });
  const { data: runnerContext } = useQuery({
    queryKey: queryKeys.agentRunners.context(session.runnerId),
    queryFn: () => probeAgentRunnerContext(session.runnerId),
    staleTime: 60 * 1000
  });

  useEffect(() => {
    previousRecordsRef.current = runtimeMessages;
  }, [runtimeMessages]);

  const sendMessage = useCallback(async (composerText: string) => {
    setComposerError(null);

    try {
      const payload = buildComposerPayload({
        additionalValues: composerDraftState.additionalValuesRef.current,
        composerText,
        composerSchemaState,
        fallbackToText: !runnerType,
        runtimeValues: composerDraftState.runtimeValuesRef.current
      });

      await onSend(payload);
      if (composerSchemaState.supportsTextComposer) {
        composerDraftState.additionalValuesRef.current =
          composerSchemaState.initialAdditionalInputValues;
        setComposerKey((current) => current + 1);
      }
    } catch (error) {
      setComposerError(
        error instanceof Error ? error.message : '发送消息失败'
      );
      throw error;
    }
  }, [composerDraftState, composerSchemaState, onSend, runnerType]);

  const editMessage = useCallback(async (messageId: string, composerText: string) => {
    const originalMessage = messages.find((message) => message.id === messageId);
    if (!originalMessage) {
      throw new Error('编辑目标消息不存在');
    }

    await onEdit(
      messageId,
      buildComposerPayload({
        additionalValues: composerSchemaState.supportsTextComposer
          ? omitPrimaryFieldValue(
              originalMessage.inputContent,
              composerSchemaState.primaryInputField?.name
            )
          : {},
        composerText,
        composerSchemaState,
        fallbackToText: !runnerType,
        runtimeValues: composerDraftState.runtimeValuesRef.current
      })
    );
  }, [composerDraftState, composerSchemaState, messages, onEdit, runnerType]);

  return {
    additionalInputFields: composerSchemaState.additionalInputFields,
    composerError,
    composerKey,
    composerMode: composerSchemaState.composerMode,
    firstItemIndex,
    initialAdditionalInputValues:
      composerSchemaState.initialAdditionalInputValues,
    initialRuntimeValues: composerSchemaState.initialRuntimeValues,
    runtimeFields: composerSchemaState.runtimeFields,
    runnerContext,
    runtimeMessages,
    editMessage,
    handleAdditionalValueChange: composerDraftState.updateAdditionalValue,
    handleRuntimeValueChange: composerDraftState.updateRuntimeValue,
    sendMessage
  };
}

function useComposerDraftState({
  initialAdditionalValues,
  initialRuntimeValues
}: {
  initialAdditionalValues: Record<string, unknown>;
  initialRuntimeValues: Record<string, unknown>;
}) {
  const additionalValuesRef = useRef<Record<string, unknown>>(
    initialAdditionalValues
  );
  const runtimeValuesRef = useRef<Record<string, unknown>>(initialRuntimeValues);

  useEffect(() => {
    additionalValuesRef.current = initialAdditionalValues;
  }, [initialAdditionalValues]);

  useEffect(() => {
    runtimeValuesRef.current = initialRuntimeValues;
  }, [initialRuntimeValues]);

  const updateAdditionalValue = useCallback((fieldName: string, value: unknown) => {
    additionalValuesRef.current = {
      ...additionalValuesRef.current,
      [fieldName]: value
    };
  }, []);

  const updateRuntimeValue = useCallback((fieldName: string, value: unknown) => {
    runtimeValuesRef.current = {
      ...runtimeValuesRef.current,
      [fieldName]: value
    };
  }, []);

  return {
    additionalValuesRef,
    runtimeValuesRef,
    updateAdditionalValue,
    updateRuntimeValue
  };
}

function useSessionMessageFirstItemIndex(messages: SessionMessageDetail[]) {
  const [firstItemIndex, setFirstItemIndex] = useState(100_000);
  const prevFirstIdRef = useRef<string | undefined>(undefined);
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    const firstMessageId = messages[0]?.id;
    if (messages.length === 0 || firstMessageId === prevFirstIdRef.current) {
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    if (prevFirstIdRef.current !== undefined) {
      const oldFirstIndex = messages.findIndex(
        (message) => message.id === prevFirstIdRef.current
      );

      setFirstItemIndex(
        (current) =>
          current -
          (oldFirstIndex > 0
            ? oldFirstIndex
            : Math.max(0, messages.length - prevMessagesLengthRef.current))
      );
    }

    prevFirstIdRef.current = firstMessageId;
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  return firstItemIndex;
}

function useComposerSchemaState(
  runnerType: RunnerTypeResponse | undefined,
  session: SessionDetail
) {
  const inputSchema = useMemo(
    () => parseRunnerConfigSchema(runnerType?.inputSchema),
    [runnerType]
  );
  const structuredInputSchema = inputSchema.supported
    ? inputSchema
    : undefined;
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
  const supportsTextComposer = Boolean(
    structuredInputSchema && primaryInputField
  );

  return {
    additionalInputFields,
    composerMode:
      !runnerType || supportsTextComposer ? 'text' as const : 'raw-json' as const,
    initialAdditionalInputValues,
    initialRuntimeValues,
    primaryInputField,
    runtimeFields,
    structuredInputSchema,
    structuredRuntimeSchema,
    supportsTextComposer
  };
}

function buildComposerPayload({
  additionalValues,
  composerText,
  composerSchemaState,
  fallbackToText,
  runtimeValues
}: {
  additionalValues: Record<string, unknown>;
  composerText: string;
  composerSchemaState: ReturnType<typeof useComposerSchemaState>;
  fallbackToText: boolean;
  runtimeValues: Record<string, unknown>;
}): SendSessionMessageInput {
  if (composerSchemaState.supportsTextComposer) {
    return buildStructuredMessagePayload({
      schema: composerSchemaState.structuredInputSchema!,
      runtimeSchema: composerSchemaState.structuredRuntimeSchema ?? {
        supported: false as const,
        reason: '不支持'
      },
      primaryField: composerSchemaState.primaryInputField!,
      composerText,
      additionalValues,
      runtimeValues
    });
  }

  if (fallbackToText) {
    return {
      input: {
        prompt: composerText.trim()
      }
    };
  }

  const parsed = parseSessionInputText(composerText);
  if (!parsed.data) {
    throw new Error(parsed.error ?? '消息输入校验失败');
  }

  return parsed.data;
}
