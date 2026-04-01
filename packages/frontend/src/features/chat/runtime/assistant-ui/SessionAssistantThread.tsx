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

import { EmptyState } from '@/components/app/EmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  buildTextMessagePayload,
  parseRawInputText
} from '@/pages/projects/project-sessions.utils';
import { parseRunnerConfigSchema } from '@/pages/agent-runners/agent-runner.utils';

import { SessionAssistantRuntimeProvider } from './SessionAssistantRuntimeProvider';
import type { SessionAssistantMessageMetadata } from './message-converters';
import type {
  SessionMessageRuntimeMap
} from './thread-adapter';
import { buildSessionAssistantMessageRecords } from './thread-adapter';

const rawJsonTemplate = '{\n  "prompt": ""\n}';

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
  const statusLabel = metadata?.cancelledAt
    ? '已中止'
    : metadata
      ? formatDomainMessageStatus(metadata.domainStatus)
      : null;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Badge variant={isUser ? 'outline' : 'secondary'}>
          {isUser ? 'User' : 'Assistant'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {createdAt.toLocaleString()}
        </span>
      </div>
      {statusLabel ? (
        <Badge variant="outline">
          {statusLabel}
        </Badge>
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
    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{text}</p>
  );
}

function AssistantReasoningPart({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/25 p-3">
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
    <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
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
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[85%] rounded-[calc(var(--radius)*0.95)] border border-border/70 bg-background/80 p-4">
        <MessageHeader isUser />
        <div className="mt-3 [&>*+*]:mt-3">
          <MessagePrimitive.Parts
            components={{
              Text: AssistantTextPart
            }}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <ActionBarPrimitive.Edit asChild>
            <Button variant="ghost" size="sm">
              <Pencil />
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
    <MessagePrimitive.Root className="flex justify-end">
      <div className="w-full max-w-[85%] rounded-[calc(var(--radius)*0.95)] border border-border/70 bg-background/90 p-4">
        <p className="text-sm font-semibold text-foreground">编辑消息</p>
        <Textarea
          className="mt-3"
          rows={6}
          value={value}
          onChange={(event) => {
            aui.message().composer().setText(event.target.value);
          }}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              aui.message().composer().cancel();
            }}
          >
            取消
          </Button>
          <Button
            onClick={() => {
              aui.message().composer().send();
            }}
          >
            保存并重跑
          </Button>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessageBubble() {
  const isLast = useAuiState((state) => state.message.isLast);

  return (
    <MessagePrimitive.Root className="flex justify-start">
      <div className="max-w-[88%] rounded-[calc(var(--radius)*0.95)] border border-border/70 bg-background/80 p-4">
        <MessageHeader isUser={false} />
        <div className="mt-3 [&>*+*]:mt-3">
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
        <MessageCancelledNotice />
        <MessageErrorAlert />
        <MessageUsageFooter />
        {isLast ? (
          <div className="mt-3 flex justify-end">
            <ActionBarPrimitive.Reload asChild>
              <Button variant="ghost" size="sm">
                <RotateCcw />
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

function ThreadComposer({
  mode,
  hasSystemPrompt,
  systemPrompt,
  composerError,
  onSystemPromptChange
}: {
  mode: 'text' | 'raw-json';
  hasSystemPrompt: boolean;
  systemPrompt: string;
  composerError: string | null;
  onSystemPromptChange: (value: string) => void;
}) {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const isDisabled = useAuiState((state) => state.thread.isDisabled);

  return (
    <ThreadPrimitive.ViewportFooter className="sticky bottom-0 z-10 pt-4">
      <div className="border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div />
          {isRunning ? (
            <Badge variant="secondary">
              <LoaderCircle className="mr-1 size-3 animate-spin" />
              输出中
            </Badge>
          ) : null}
        </div>

        {hasSystemPrompt ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-foreground">System Prompt</p>
            <Textarea
              rows={3}
              value={systemPrompt}
              disabled={isDisabled}
              onChange={(event) => onSystemPromptChange(event.target.value)}
              placeholder="可选"
            />
          </div>
        ) : null}

          {composerError ? (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>发送失败</AlertTitle>
            <AlertDescription>{composerError}</AlertDescription>
          </Alert>
        ) : null}

        <ComposerPrimitive.Root className="mt-4 space-y-3">
          <RawJsonTemplateSync enabled={mode === 'raw-json'} />
          <ComposerPrimitive.Input
            className={cn(
              'flex min-h-28 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50'
            )}
            placeholder={
              mode === 'text'
                ? '输入消息'
                : '输入 JSON'
            }
            minRows={mode === 'text' ? 5 : 8}
            maxRows={16}
            submitMode="enter"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {isDisabled && !isRunning ? '当前 Session 暂不可发送。' : null}
            </div>
            <div className="flex items-center gap-2">
              {isRunning ? (
                <ComposerPrimitive.Cancel asChild>
                  <Button variant="outline" type="button">
                    <Square />
                    中止
                  </Button>
                </ComposerPrimitive.Cancel>
              ) : null}
              <ComposerPrimitive.Send asChild>
                <Button type="submit" disabled={isDisabled}>
                  <SendHorizontal />
                  发送
                </Button>
              </ComposerPrimitive.Send>
            </div>
          </div>
        </ComposerPrimitive.Root>
      </div>
    </ThreadPrimitive.ViewportFooter>
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
  const [systemPrompt, setSystemPrompt] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const inputSchema = useMemo(
    () => parseRunnerConfigSchema(runnerType?.inputSchema),
    [runnerType]
  );
  const supportsTextComposer = useMemo(() => {
    if (!inputSchema.supported) {
      return false;
    }

    const fieldNames = new Set(inputSchema.fields.map((field) => field.name));
    return fieldNames.has('prompt');
  }, [inputSchema]);
  const hasSystemPrompt = useMemo(() => {
    if (!inputSchema.supported) {
      return false;
    }

    return inputSchema.fields.some((field) => field.name === 'systemPrompt');
  }, [inputSchema]);
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
            ? buildTextMessagePayload({
                prompt: composerText,
                systemPrompt: hasSystemPrompt ? systemPrompt : ''
              })
            : (() => {
                const parsed = parseRawInputText(composerText);
                if (!parsed.data) {
                  throw new Error(parsed.error ?? '消息输入校验失败');
                }
                return parsed.data;
              })();

          await onSend(payload);
          if (supportsTextComposer && hasSystemPrompt) {
            setSystemPrompt('');
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
          ? buildTextMessagePayload({
              prompt: composerText,
              systemPrompt:
                typeof originalMessage.inputContent?.systemPrompt === 'string'
                  ? originalMessage.inputContent.systemPrompt
                  : ''
            })
          : (() => {
              const parsed = parseRawInputText(composerText);
              if (!parsed.data) {
                throw new Error(parsed.error ?? '消息输入校验失败');
              }
              return parsed.data;
            })();

        await onEdit(messageId, payload);
      }}
    >
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport
          className="flex-1 overflow-y-auto px-5 py-5"
          autoScroll
        >
          {messages.length === 0 ? (
            <EmptyState
              title="还没有消息"
              description="发送第一条消息"
              className="min-h-[18rem]"
            />
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

          <ThreadComposer
            mode={supportsTextComposer ? 'text' : 'raw-json'}
            hasSystemPrompt={hasSystemPrompt && supportsTextComposer}
            systemPrompt={systemPrompt}
            composerError={composerError}
            onSystemPromptChange={setSystemPrompt}
          />
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </SessionAssistantRuntimeProvider>
  );
}
