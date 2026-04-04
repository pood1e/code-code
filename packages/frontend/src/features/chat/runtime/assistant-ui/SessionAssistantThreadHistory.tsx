import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type {
  MessageStatus,
  SessionMessagePart
} from '@agent-workbench/shared';
import { Check, Copy, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type {
  SessionAssistantMessageRecord,
  SessionUsageData
} from './thread-adapter';
import {
  getSessionMessagePromptText,
  toAssistantToolArgs
} from './message-converters';
import { ThreadConfigContext, formatDomainMessageStatus } from './context';
import {
  AssistantEmptyPart,
  AssistantReasoningPart,
  AssistantTextPart,
  AssistantToolPart
} from './components/AssistantMessageContent';

const VirtuosoScroller = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>((props, ref) => {
  return (
    <div
      {...props}
      ref={ref}
      role="log"
      aria-label="会话消息列表"
      className="scrollbar-hide min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      style={{
        ...props.style,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    />
  );
});
VirtuosoScroller.displayName = 'VirtuosoScroller';

export function SessionAssistantThreadHistory({
  records,
  firstItemIndex,
  onLoadMore,
  onReload
}: {
  records: SessionAssistantMessageRecord[];
  firstItemIndex: number;
  onLoadMore?: () => void;
  onReload: () => Promise<void>;
}) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const lastMessageId = records.at(-1)?.message.id;
  const previousLastMessageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!virtuosoRef.current || !lastMessageId || records.length === 0) {
      return;
    }

    if (previousLastMessageIdRef.current === undefined) {
      previousLastMessageIdRef.current = lastMessageId;
      virtuosoRef.current.scrollToIndex({
        index: 0,
        align: 'start',
        behavior: 'auto'
      });
      return;
    }

    if (previousLastMessageIdRef.current === lastMessageId) {
      return;
    }

    previousLastMessageIdRef.current = lastMessageId;
    virtuosoRef.current.scrollToIndex({
      index: records.length - 1,
      align: 'end',
      behavior: 'auto'
    });
  }, [firstItemIndex, lastMessageId, records.length]);

  return (
    <Virtuoso
      ref={virtuosoRef}
      className="min-h-0 flex-1"
      followOutput="auto"
      firstItemIndex={firstItemIndex}
      totalCount={records.length}
      initialTopMostItemIndex={0}
      startReached={onLoadMore}
      computeItemKey={(index) =>
        records[index - firstItemIndex]?.message.id ?? `pending-${index}`
      }
      components={{
        Scroller: VirtuosoScroller,
        Header: () => (
          <div className="px-4 pt-4 sm:px-5">
            {onLoadMore ? (
              <div className="flex justify-center pb-2">
                <Button variant="ghost" size="sm" onClick={onLoadMore}>
                  加载更早消息
                </Button>
              </div>
            ) : null}
          </div>
        ),
        Footer: () => <div className="h-5" />
      }}
      itemContent={(index) => {
        const relativeIndex = index - firstItemIndex;
        const record = records[relativeIndex];

        if (!record) {
          return <div className="px-4 pb-1 sm:px-5" />;
        }

        return (
          <div className="px-4 pb-1 sm:px-5">
            <SessionMessageBubble
              record={record}
              isLast={relativeIndex === records.length - 1}
              onReload={onReload}
            />
          </div>
        );
      }}
    />
  );
}

function SessionMessageBubble({
  record,
  isLast,
  onReload
}: {
  record: SessionAssistantMessageRecord;
  isLast: boolean;
  onReload: () => Promise<void>;
}) {
  if (record.message.role === 'user') {
    return <SessionUserMessageBubble record={record} />;
  }

  return (
    <SessionAssistantMessageBubble
      record={record}
      isLast={isLast}
      onReload={onReload}
    />
  );
}

function SessionUserMessageBubble({
  record
}: {
  record: SessionAssistantMessageRecord;
}) {
  const messageText = getSessionMessagePromptText(record.message);
  const { copied, handleCopy } = useCopyAction(messageText);

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
            onClick={() => {
              void handleCopy();
            }}
          >
            {copied ? <Check /> : <Copy />}
          </HistoryIconButton>
        </div>
      </div>
    </div>
  );
}

function SessionAssistantMessageBubble({
  record,
  isLast,
  onReload
}: {
  record: SessionAssistantMessageRecord;
  isLast: boolean;
  onReload: () => Promise<void>;
}) {
  const { assistantName } = React.useContext(ThreadConfigContext);
  const { message, runtime } = record;
  const [isReloading, setIsReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const contentParts = useMemo(
    () => buildRenderableAssistantContentParts(record),
    [record]
  );
  const { copied, handleCopy } = useCopyAction(
    contentPartsToCopyText(contentParts)
  );
  const usage = runtime?.usage;
  const statusLabel = getMessageStatusLabel(
    message.status,
    runtime?.cancelledAt ?? message.cancelledAt ?? undefined
  );
  const usageText = formatUsageText(usage);
  const showRunningPlaceholder =
    contentParts.length === 0 && message.status === 'streaming';

  return (
    <div className="group flex w-full flex-col py-3">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-1 px-4 sm:px-0">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[14px] font-semibold text-foreground/80">
            {assistantName || 'Assistant'}
          </span>
        </div>

        <div className="mt-1 w-full pl-8 [&>*+*]:mt-4">
          {contentParts.map((part, index) => {
            if (part.type === 'thinking') {
              return (
                <AssistantReasoningPart
                  key={`thinking-${index}`}
                  text={part.text}
                />
              );
            }

            if (part.type === 'text') {
              return (
                <AssistantTextPart key={`text-${index}`} text={part.text} />
              );
            }

            return (
              <AssistantToolPart
                key={`tool-${part.toolCallId}-${index}`}
                toolKind={part.toolKind ?? 'fallback'}
                toolName={part.toolName}
                args={toAssistantToolArgs(part.args)}
                result={part.result}
                isError={part.isError}
              />
            );
          })}

          {showRunningPlaceholder ? (
            <AssistantEmptyPart status={{ type: 'running' }} />
          ) : null}
        </div>

        <div className="w-full pl-8">
          {message.errorPayload ? (
            <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm font-medium text-destructive">
                {message.errorPayload.code}
              </p>
              <p className="mt-1 text-sm text-destructive/80">
                {message.errorPayload.message}
              </p>
            </div>
          ) : null}
          {reloadError ? (
            <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{reloadError}</p>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex items-center gap-x-3 text-[11px] text-muted-foreground/50">
              <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
              {statusLabel ? <span>{statusLabel}</span> : null}
              {usageText ? <span>{usageText}</span> : null}
            </div>

            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <HistoryIconButton
                label={copied ? '已复制 assistant 消息' : '复制 assistant 消息'}
                onClick={() => {
                  void handleCopy();
                }}
              >
                {copied ? <Check /> : <Copy />}
              </HistoryIconButton>

              {isLast ? (
                <HistoryIconButton
                  label="重跑"
                  disabled={isReloading}
                  onClick={() => {
                    void (async () => {
                      setReloadError(null);
                      setIsReloading(true);

                      try {
                        await onReload();
                      } catch (error) {
                        setReloadError(
                          error instanceof Error ? error.message : '重跑失败'
                        );
                      } finally {
                        setIsReloading(false);
                      }
                    })();
                  }}
                >
                  <RotateCcw />
                </HistoryIconButton>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryIconButton({
  label,
  children,
  disabled = false,
  onClick
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
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

function useCopyAction(text: string) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return { copied, handleCopy };
}

function contentPartsToCopyText(contentParts: SessionMessagePart[]) {
  return contentParts
    .flatMap((part) => {
      if (part.type === 'text' || part.type === 'thinking') {
        return [part.text];
      }

      if (part.type === 'tool_call') {
        const lines = [`[tool] ${part.toolName}`];
        if (part.args !== undefined) {
          lines.push(JSON.stringify(part.args, null, 2));
        }
        if (part.result !== undefined) {
          lines.push(JSON.stringify(part.result, null, 2));
        }
        return [lines.join('\n')];
      }

      return [];
    })
    .join('\n\n')
    .trim();
}

function buildRenderableAssistantContentParts(
  record: SessionAssistantMessageRecord
) {
  const runtimeThinkingText = record.runtime?.thinkingText?.trim()
    ? record.runtime.thinkingText
    : undefined;
  const nextParts: SessionMessagePart[] = [];
  let hasThinkingPart = false;

  for (const part of record.message.contentParts) {
    if (part.type !== 'thinking') {
      nextParts.push(part);
      continue;
    }

    nextParts.push({
      ...part,
      text:
        !hasThinkingPart && runtimeThinkingText
          ? runtimeThinkingText
          : part.text
    });
    hasThinkingPart = true;
  }

  if (!hasThinkingPart && runtimeThinkingText) {
    return [
      {
        type: 'thinking',
        text: runtimeThinkingText
      },
      ...nextParts
    ] satisfies SessionMessagePart[];
  }

  return nextParts;
}

function getMessageStatusLabel(status: MessageStatus, cancelledAt?: string) {
  if (cancelledAt) {
    return '已中止';
  }

  return formatDomainMessageStatus(status);
}

function formatUsageText(usage?: SessionUsageData) {
  if (!usage) {
    return null;
  }

  const tokens: string[] = [];
  if (usage.inputTokens) tokens.push(`In: ${usage.inputTokens}`);
  if (usage.outputTokens) tokens.push(`Out: ${usage.outputTokens}`);
  if (usage.costUsd) tokens.push(`$${usage.costUsd}`);
  if (usage.modelId) tokens.push(usage.modelId);

  return tokens.length > 0 ? tokens.join(' · ') : null;
}
