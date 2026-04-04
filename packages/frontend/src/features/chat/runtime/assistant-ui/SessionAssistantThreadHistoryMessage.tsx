import React, { useMemo, useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useClipboardCopy } from '@/hooks/use-clipboard-copy';

import {
  AssistantEmptyPart,
  AssistantReasoningPart,
  AssistantTextPart,
  AssistantToolPart
} from './components/AssistantMessageContent';
import { ThreadConfigContext } from './context';
import {
  getSessionMessagePromptText,
  toAssistantToolArgs
} from './message-converters';
import {
  buildRenderableAssistantContentParts,
  contentPartsToCopyText,
  formatUsageText,
  getMessageStatusLabel
} from './session-thread-history.utils';
import type { SessionAssistantMessageRecord } from './thread-adapter';

export function SessionMessageBubble({
  canReload,
  isLast,
  onReload,
  record
}: {
  canReload: boolean;
  isLast: boolean;
  onReload: () => Promise<void>;
  record: SessionAssistantMessageRecord;
}) {
  if (record.message.role === 'user') {
    return <SessionUserMessageBubble record={record} />;
  }

  return (
    <SessionAssistantMessageBubble
      canReload={canReload}
      isLast={isLast}
      onReload={onReload}
      record={record}
    />
  );
}

function SessionUserMessageBubble({
  record
}: {
  record: SessionAssistantMessageRecord;
}) {
  const messageText = getSessionMessagePromptText(record.message);
  const { copied, copy } = useClipboardCopy();

  return (
    <div className="group flex w-full flex-col py-3">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-end gap-1 px-4 sm:px-0">
        <div className="mb-1 flex items-center justify-end gap-2">
          <span className="mr-1 text-xs font-medium text-muted-foreground/80">
            You
          </span>
        </div>

        <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-muted/80 px-5 py-3 text-[14px] leading-relaxed text-foreground sm:max-w-[80%]">
          <div className="whitespace-pre-wrap font-sans">{messageText}</div>
        </div>
        <div className="mt-1.5 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
          <HistoryIconButton
            label={copied ? '已复制用户消息' : '复制用户消息'}
            onClick={() => void copy(messageText)}
          >
            {copied ? <Check /> : <Copy />}
          </HistoryIconButton>
        </div>
      </div>
    </div>
  );
}

function SessionAssistantMessageBubble({
  canReload,
  isLast,
  onReload,
  record
}: {
  canReload: boolean;
  isLast: boolean;
  onReload: () => Promise<void>;
  record: SessionAssistantMessageRecord;
}) {
  const { assistantName } = React.useContext(ThreadConfigContext);
  const { message, runtime } = record;
  const [isReloading, setIsReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const contentParts = useMemo(
    () => buildRenderableAssistantContentParts(record),
    [record]
  );
  const { copied, copy } = useClipboardCopy();
  const statusLabel = getMessageStatusLabel(
    message.status,
    runtime?.cancelledAt ?? message.cancelledAt ?? undefined
  );
  const usageText = formatUsageText(runtime?.usage);
  const showRunningPlaceholder =
    contentParts.length === 0 && message.status === 'streaming';

  const handleReload = async () => {
    setReloadError(null);
    setIsReloading(true);

    try {
      await onReload();
    } catch (error) {
      setReloadError(error instanceof Error ? error.message : '重跑失败');
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <div className="group flex w-full flex-col py-3">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-1 px-4 sm:px-0">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[14px] font-semibold text-foreground/80">
            {assistantName || 'Assistant'}
          </span>
        </div>

        <div className="mt-1 w-full pl-8 [&>*+*]:mt-4">
          {contentParts.map((part, index) => (
            <SessionAssistantMessagePart
              key={getAssistantMessagePartKey(part, index)}
              part={part}
            />
          ))}

          {showRunningPlaceholder ? (
            <AssistantEmptyPart status={{ type: 'running' }} />
          ) : null}
        </div>

        <div className="w-full pl-8">
          <AssistantMessageErrors
            errorPayload={message.errorPayload}
            reloadError={reloadError}
          />

          <AssistantMessageMetaRow
            copied={copied}
            createdAt={message.createdAt}
            canReload={canReload}
            isLast={isLast}
            isReloading={isReloading}
            onCopy={() => void copy(contentPartsToCopyText(contentParts))}
            onReload={() => void handleReload()}
            statusLabel={statusLabel}
            usageText={usageText}
          />
        </div>
      </div>
    </div>
  );
}

function SessionAssistantMessagePart({
  part
}: {
  part: ReturnType<typeof buildRenderableAssistantContentParts>[number];
}) {
  if (part.type === 'thinking') {
    return <AssistantReasoningPart text={part.text} />;
  }

  if (part.type === 'text') {
    return <AssistantTextPart text={part.text} />;
  }

  return (
    <AssistantToolPart
      toolKind={part.toolKind ?? 'fallback'}
      toolName={part.toolName}
      args={toAssistantToolArgs(part.args)}
      result={part.result}
      isError={part.isError}
    />
  );
}

function AssistantMessageErrors({
  errorPayload,
  reloadError
}: {
  errorPayload: SessionAssistantMessageRecord['message']['errorPayload'];
  reloadError: string | null;
}) {
  return (
    <>
      {errorPayload ? (
        <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            {errorPayload.code}
          </p>
          <p className="mt-1 text-sm text-destructive/80">
            {errorPayload.message}
          </p>
        </div>
      ) : null}

      {reloadError ? (
        <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{reloadError}</p>
        </div>
      ) : null}
    </>
  );
}

function AssistantMessageMetaRow({
  canReload,
  copied,
  createdAt,
  isLast,
  isReloading,
  onCopy,
  onReload,
  statusLabel,
  usageText
}: {
  canReload: boolean;
  copied: boolean;
  createdAt: string;
  isLast: boolean;
  isReloading: boolean;
  onCopy: () => void;
  onReload: () => void;
  statusLabel: string | null;
  usageText: string | null;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <div className="flex items-center gap-x-3 text-[11px] text-muted-foreground/50">
        <span>{new Date(createdAt).toLocaleTimeString()}</span>
        {statusLabel ? <span>{statusLabel}</span> : null}
        {usageText ? <span>{usageText}</span> : null}
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <HistoryIconButton
          label={copied ? '已复制 assistant 消息' : '复制 assistant 消息'}
          onClick={onCopy}
        >
          {copied ? <Check /> : <Copy />}
        </HistoryIconButton>

        {canReload && isLast ? (
          <HistoryIconButton
            label="重跑"
            disabled={isReloading}
            onClick={onReload}
          >
            <RotateCcw />
          </HistoryIconButton>
        ) : null}
      </div>
    </div>
  );
}

function HistoryIconButton({
  children,
  disabled = false,
  label,
  onClick
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      aria-label={label}
      title={label}
      className="text-muted-foreground/60 hover:bg-accent hover:text-foreground"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function getAssistantMessagePartKey(
  part: ReturnType<typeof buildRenderableAssistantContentParts>[number],
  index: number
) {
  if (part.type === 'tool_call') {
    return `tool-${part.toolCallId}-${index}`;
  }

  return `${part.type}-${index}`;
}
