import { useEffect, useMemo, useState } from 'react';
import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState
} from '@assistant-ui/react';
import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import type {
  MessageStatus,
  RunnerTypeResponse,
  SendSessionMessageInput,
  SessionDetail,
  SessionMessageDetail
} from '@agent-workbench/shared';
import { MessageStatus as MessageStatusEnum } from '@agent-workbench/shared';
import {
  LoaderCircle,
  Pencil,
  RotateCcw,
  SendHorizontal,
  Square
} from 'lucide-react';
import React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  getRunnerConfigFieldValue,
  parseRunnerConfigSchema,
  type RunnerConfigField
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
import type { SessionAssistantMessageMetadata } from './message-converters';
import type {
  SessionMessageRuntimeMap
} from './thread-adapter';
import { buildSessionAssistantMessageRecords } from './thread-adapter';

const rawJsonTemplate = '{\n  "prompt": ""\n}';

const ThreadConfigContext = React.createContext<{ assistantName?: string }>({});

function formatDomainMessageStatus(status: MessageStatus) {
  switch (status) {
    case MessageStatusEnum.Sent:
      return '已发送';
    case MessageStatusEnum.Streaming:
      return '输出中';
    case MessageStatusEnum.Complete:
      return '完成';
    case MessageStatusEnum.Error:
      return '异常';
    default:
      return status;
  }
}

function isSessionAssistantMessageMetadata(
  value: unknown
): value is SessionAssistantMessageMetadata {
  return typeof value === 'object' && value !== null;
}

function stringifyValue(value: unknown) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    if (value instanceof Error) {
      return value.message;
    }

    return Object.prototype.toString.call(value);
  }
}

function useCurrentMessageMetadata() {
  const customMetadata = useAuiState((state) => state.message.metadata.custom);
  return isSessionAssistantMessageMetadata(customMetadata)
    ? customMetadata
    : undefined;
}

function MessageHeader({ isUser }: { isUser: boolean }) {
  const createdAt = useAuiState((state) => state.message.createdAt);
  const metadata = useCurrentMessageMetadata();
  const { assistantName } = React.useContext(ThreadConfigContext);
  const statusLabel = metadata?.cancelledAt
    ? '已中止'
    : metadata
      ? formatDomainMessageStatus(metadata.domainStatus)
      : null;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-sm bg-foreground/10 text-[10px] font-bold">
          {isUser ? 'ME' : 'AI'}
        </div>
        <span className="text-sm font-semibold text-foreground">
          {isUser ? 'You' : (assistantName || 'Assistant')}
        </span>
        <span className="text-xs text-muted-foreground">
          {createdAt.toLocaleString()}
        </span>
      </div>
      {statusLabel ? (
        <span className="text-xs text-muted-foreground/60">{statusLabel}</span>
      ) : null}
    </div>
  );
}

function MessageUsageFooter() {
  const metadata = useCurrentMessageMetadata();
  const usage = metadata?.usage;

  if (!usage) {
    return null;
  }

  const tokens = [
    usage.inputTokens ? `Input ${usage.inputTokens}` : null,
    usage.outputTokens ? `Output ${usage.outputTokens}` : null,
    usage.cacheReadTokens ? `Cache Read ${usage.cacheReadTokens}` : null,
    usage.cacheWriteTokens ? `Cache Write ${usage.cacheWriteTokens}` : null,
    usage.costUsd ? `Cost $${usage.costUsd}` : null,
    usage.modelId ? usage.modelId : null
  ].filter(Boolean);

  if (tokens.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
      {tokens.join(' · ')}
    </div>
  );
}

function MessageErrorAlert() {
  const metadata = useCurrentMessageMetadata();

  if (!metadata?.recoverableError && !metadata?.nonRecoverableError) {
    return null;
  }

  const errorPayload = metadata?.recoverableError ?? metadata?.nonRecoverableError;
  const isRecoverable = Boolean(metadata?.recoverableError);

  return (
    <Alert
      variant={isRecoverable ? 'default' : 'destructive'}
      className={
        isRecoverable
          ? 'mt-3 border-amber-300/70 bg-amber-50/70 text-amber-950'
          : 'mt-3'
      }
    >
      <AlertTitle>{errorPayload?.code}</AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{errorPayload?.message}</p>
        <p>
          {isRecoverable ? '可恢复错误' : '不可恢复错误'}
        </p>
      </AlertDescription>
    </Alert>
  );
}

function MessageCancelledNotice() {
  const metadata = useCurrentMessageMetadata();

  if (!metadata?.cancelledAt) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline">已中止</Badge>
      <span>{new Date(metadata.cancelledAt).toLocaleString()}</span>
    </div>
  );
}

function AssistantTextPart({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">{text}</p>
  );
}

function AssistantReasoningPart({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/40 bg-muted/25 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Thinking
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

function AssistantToolPart({
  toolName,
  toolCallId,
  args,
  result,
  isError
}: ToolCallMessagePartProps) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Tool Use
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{toolName}</p>
        </div>
        {toolCallId ? (
          <span className="text-xs text-muted-foreground">{toolCallId}</span>
        ) : null}
      </div>

      <div className="mt-3 space-y-3 text-xs text-foreground">
        <div>
          <p className="mb-1 font-medium text-muted-foreground">Args</p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background/80 p-2">
            {stringifyValue(args)}
          </pre>
        </div>
        {result != null ? (
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Result</p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background/80 p-2">
              {stringifyValue(result)}
            </pre>
          </div>
        ) : null}
        {isError ? (
          <Badge variant="destructive" className="rounded-md">
            Tool Error
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function AssistantEmptyPart({
  status
}: {
  status: { type: string };
}) {
  if (status.type !== 'running') {
    return null;
  }

  return (
    <p className="text-sm leading-6 text-muted-foreground">等待输出...</p>
  );
}

function UserMessageBubble() {
  return (
    <MessagePrimitive.Root className="group flex w-full flex-col items-center py-6">
      <div className="flex w-full max-w-3xl flex-col gap-1 px-4 sm:px-0">
        <MessageHeader isUser />
        <div className="mt-1 pl-8">
          <MessagePrimitive.Parts
            components={{
              Text: AssistantTextPart
            }}
          />
        </div>
        <div className="mt-2 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
          <ActionBarPrimitive.Edit asChild>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
              <Pencil className="mr-1.5 size-3" />
              编辑
            </Button>
          </ActionBarPrimitive.Edit>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function UserMessageEditComposer() {
  const aui = useAui();
  const value = useAuiState((state) => state.message.composer.text);

  return (
    <MessagePrimitive.Root className="flex w-full flex-col items-center py-6">
      <div className="flex w-full max-w-3xl flex-col gap-3 px-4 sm:px-0">
        <MessageHeader isUser />
        <div className="pl-8">
          <Textarea
            className="min-h-24 resize-y rounded-xl border border-input bg-background/50 p-3 text-[15px] focus-visible:ring-1 focus-visible:ring-ring"
            rows={4}
            value={value}
            onChange={(event) => {
              aui.message().composer().setText(event.target.value);
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                aui.message().composer().cancel();
              }}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => {
                aui.message().composer().send();
              }}
            >
              保存并重跑
            </Button>
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessageBubble() {
  const isLast = useAuiState((state) => state.message.isLast);

  return (
    <MessagePrimitive.Root className="group flex w-full flex-col items-center py-6">
      <div className="flex w-full max-w-3xl flex-col gap-1 px-4 sm:px-0">
        <MessageHeader isUser={false} />
        <div className="mt-1 pl-8 [&>*+*]:mt-4">
          <MessagePrimitive.Parts
            components={{
              Text: AssistantTextPart,
              Reasoning: AssistantReasoningPart,
              tools: {
                Fallback: AssistantToolPart
              },
              Empty: AssistantEmptyPart
            }}
          />
        </div>
        <div className="pl-8">
          <MessageCancelledNotice />
          <MessageErrorAlert />
          <MessageUsageFooter />
        </div>
        {isLast ? (
          <div className="mt-2 flex justify-start pl-8 opacity-0 transition-opacity group-hover:opacity-100">
            <ActionBarPrimitive.Reload asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                <RotateCcw className="mr-1.5 size-3" />
                重跑
              </Button>
            </ActionBarPrimitive.Reload>
          </div>
        ) : null}
      </div>
    </MessagePrimitive.Root>
  );
}

function RawJsonTemplateSync({ enabled }: { enabled: boolean }) {
  const aui = useAui();
  const composerText = useAuiState((state) =>
    state.composer.isEditing ? state.composer.text : ''
  );

  useEffect(() => {
    if (!enabled || composerText.trim().length > 0) {
      return;
    }

    const composer = aui.composer();
    if (!composer.getState().isEditing) {
      return;
    }

    composer.setText(rawJsonTemplate);
  }, [aui, composerText, enabled]);

  return null;
}

function AdditionalInputFields({
  fields,
  values,
  disabled,
  onChange
}: {
  fields: RunnerConfigField[];
  values: Record<string, unknown>;
  disabled: boolean;
  onChange: (fieldName: string, value: unknown) => void;
}) {
  if (fields.length === 0) {
    return null;
  }
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground">
        高级输入
      </summary>
      <div className="absolute bottom-full left-0 z-10 mb-2 w-80 max-h-80 overflow-y-auto rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur group-open:animate-in group-open:fade-in-0 group-open:zoom-in-95">
        <div className="space-y-4">
        {fields.map((field) => {
          if (field.kind === 'boolean') {
            return (
              <label
                key={field.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/70 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{field.label}</p>
                  {field.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  ) : null}
                </div>
                <input
                  type="checkbox"
                  className="size-4"
                  checked={Boolean(values[field.name])}
                  disabled={disabled}
                  onChange={(event) => onChange(field.name, event.target.checked)}
                />
              </label>
            );
          }

          if (field.kind === 'enum') {
            return (
              <div key={field.name} className="space-y-2">
                <p className="text-sm font-medium text-foreground">{field.label}</p>
                {field.description ? (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                ) : null}
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                  value={getRunnerConfigFieldValue(field, values[field.name])}
                  disabled={disabled}
                  onChange={(event) => onChange(field.name, event.target.value)}
                >
                  {!field.required ? <option value="">未设置</option> : null}
                  {field.enumOptions?.map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          const value = getRunnerConfigFieldValue(field, values[field.name]);
          const isMultiline = field.kind === 'string';

          return (
            <div key={field.name} className="space-y-2">
              <p className="text-sm font-medium text-foreground">{field.label}</p>
              {field.description ? (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              ) : null}
              {isMultiline ? (
                <Textarea
                  rows={3}
                  value={value}
                  disabled={disabled}
                  onChange={(event) => onChange(field.name, event.target.value)}
                />
              ) : (
                <Input
                  type={
                    field.kind === 'url'
                      ? 'url'
                      : field.kind === 'number' || field.kind === 'integer'
                        ? 'number'
                        : 'text'
                  }
                  value={value}
                  disabled={disabled}
                  onChange={(event) => onChange(field.name, event.target.value)}
                />
              )}
            </div>
          );
        })}
        </div>
      </div>
    </details>
  );
}

function ThreadComposer({
  mode,
  additionalFields,
  additionalValues,
  runtimeFields,
  runtimeValues,
  composerError,
  onAdditionalValueChange,
  onRuntimeValueChange
}: {
  mode: 'text' | 'raw-json';
  additionalFields: RunnerConfigField[];
  additionalValues: Record<string, unknown>;
  runtimeFields: RunnerConfigField[];
  runtimeValues: Record<string, unknown>;
  composerError: string | null;
  onAdditionalValueChange: (fieldName: string, value: unknown) => void;
  onRuntimeValueChange: (fieldName: string, value: unknown) => void;
}) {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const isDisabled = useAuiState((state) => state.thread.isDisabled);
  const { assistantName } = React.useContext(ThreadConfigContext);

  return (
    <div className="w-full bg-gradient-to-t from-background via-background to-transparent pb-6 pt-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 sm:px-0">
        {isRunning ? (
          <div className="mb-3 flex justify-center">
            <Badge variant="secondary" className="shadow-sm">
              <LoaderCircle className="mr-1.5 size-3 animate-spin" />
              正在生成...
            </Badge>
          </div>
        ) : null}

        {composerError ? (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>发送失败</AlertTitle>
            <AlertDescription>{composerError}</AlertDescription>
          </Alert>
        ) : null}

        <ComposerPrimitive.Root className="relative flex flex-col rounded-[1.5rem] border border-input bg-background shadow-sm transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
          <RawJsonTemplateSync enabled={mode === 'raw-json'} />
          <ComposerPrimitive.Input
            className="w-full resize-none border-none bg-transparent px-5 py-4 text-[15px] outline-none placeholder:text-muted-foreground/75 focus:ring-0"
            placeholder={mode === 'text' ? `给 ${assistantName || 'AI'} 发送消息...` : '输入 JSON'}
            minRows={mode === 'text' ? 1 : 4}
            maxRows={14}
            submitMode="enter"
          />

          <div className="flex items-end justify-between px-3 pb-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {runtimeFields.length > 0 ? (
                <>
                  {runtimeFields.map((field) => {
                    if (field.kind === 'enum') {
                      const val = getRunnerConfigFieldValue(field, runtimeValues[field.name]);
                      return (
                        <select
                          key={field.name}
                          value={val}
                          disabled={isDisabled}
                          onChange={(e) => onRuntimeValueChange(field.name, e.target.value)}
                          className="h-8 max-w-[140px] cursor-pointer appearance-none rounded-full bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          title={field.label}
                        >
                          {!field.required ? <option value="">{field.label}</option> : null}
                          {field.enumOptions?.map((option) => (
                            <option key={String(option.value)} value={String(option.value)}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      );
                    }
                    
                    const val = getRunnerConfigFieldValue(field, runtimeValues[field.name]);
                    return (
                      <Input
                        key={field.name}
                        placeholder={field.label}
                        value={val}
                        disabled={isDisabled}
                        onChange={(e) => onRuntimeValueChange(field.name, e.target.value)}
                        className="h-8 max-w-[120px] rounded-full border-none bg-muted/30 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    );
                  })}
                </>
              ) : null}

              {mode === 'text' && additionalFields.length > 0 ? (
                <AdditionalInputFields
                  fields={additionalFields}
                  values={additionalValues}
                  disabled={isDisabled}
                  onChange={onAdditionalValueChange}
                />
              ) : null}
            </div>

            <div className="flex items-center gap-2 pl-2">
              {isDisabled && !isRunning ? (
                <span className="mr-2 text-xs text-muted-foreground">会话暂不可用</span>
              ) : null}
              {isRunning ? (
                <ComposerPrimitive.Cancel asChild>
                  <Button variant="outline" size="icon" className="size-8 rounded-full" title="中止">
                    <Square className="size-3" fill="currentColor" />
                  </Button>
                </ComposerPrimitive.Cancel>
              ) : null}
              <ComposerPrimitive.Send asChild>
                <Button 
                  type="submit" 
                  disabled={isDisabled}
                  size="icon"
                  className="size-8 rounded-full transition-transform active:scale-95"
                  title="发送"
                >
                  <SendHorizontal className="size-4" />
                </Button>
              </ComposerPrimitive.Send>
            </div>
          </div>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
}

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

  const [additionalInputValues, setAdditionalInputValues] =
    useState<Record<string, unknown>>(initialAdditionalInputValues);
  const [runtimeValues, setRuntimeValues] = 
    useState<Record<string, unknown>>(initialRuntimeValues);
    
  const [composerError, setComposerError] = useState<string | null>(null);
  const supportsTextComposer = Boolean(structuredInputSchema && primaryInputField);
  const composerMode = !runnerType ? 'text' : supportsTextComposer ? 'text' : 'raw-json';
  
  const runtimeMessages = useMemo(
    () => buildSessionAssistantMessageRecords(messages, runtimeState),
    [messages, runtimeState]
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
                additionalValues: additionalInputValues,
                runtimeValues
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
            setAdditionalInputValues(initialAdditionalInputValues);
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
              runtimeValues
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
      <ThreadConfigContext.Provider value={{ assistantName: runnerType?.name || 'Agent' }}>
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

          <ThreadComposer
            mode={composerMode}
            additionalFields={additionalInputFields}
            additionalValues={additionalInputValues}
            runtimeFields={runtimeFields}
            runtimeValues={runtimeValues}
            composerError={composerError}
            onAdditionalValueChange={(fieldName, value) => {
              setAdditionalInputValues((current) => ({
                ...current,
                [fieldName]: value
              }));
            }}
            onRuntimeValueChange={(fieldName, value) => {
              setRuntimeValues((current) => ({
                ...current,
                [fieldName]: value
              }));
            }}
          />
        </ThreadPrimitive.Root>
      </ThreadConfigContext.Provider>
    </SessionAssistantRuntimeProvider>
  );
}
