import React from 'react';
import {
  ActionBarPrimitive,
  MessagePrimitive,
  useAuiState
} from '@assistant-ui/react';
import { RotateCcw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import {
  ThreadConfigContext,
  formatDomainMessageStatus,
  useCurrentMessageMetadata
} from '../context';
import {
  AssistantTextPart,
  AssistantReasoningPart,
  AssistantToolPart,
  AssistantEmptyPart
} from './AssistantMessageContent';

function MessageHeader({ isUser }: { isUser: boolean }) {
  const { assistantName } = React.useContext(ThreadConfigContext);

  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[14px] font-semibold text-foreground/80">
        {isUser ? 'You' : (assistantName || 'Assistant')}
      </span>
    </div>
  );
}

function AssistantMessageFooterInfo() {
  const isLast = useAuiState((state) => state.message.isLast);
  const createdAt = useAuiState((state) => state.message.createdAt);
  const metadata = useCurrentMessageMetadata();
  const usage = metadata?.usage;
  
  const statusLabel = metadata?.cancelledAt
    ? '已中止'
    : metadata
      ? formatDomainMessageStatus(metadata.domainStatus)
      : null;

  const tokens = [];
  if (usage) {
    if (usage.inputTokens) tokens.push(`In: ${usage.inputTokens}`);
    if (usage.outputTokens) tokens.push(`Out: ${usage.outputTokens}`);
    if (usage.costUsd) tokens.push(`$${usage.costUsd}`);
    if (usage.modelId) tokens.push(usage.modelId);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <div className="flex items-center gap-x-3 text-[11px] text-muted-foreground/50">
        <span>{createdAt.toLocaleTimeString()}</span>
        {statusLabel ? <span>{statusLabel}</span> : null}
        {tokens.length > 0 ? <span>{tokens.join(' · ')}</span> : null}
      </div>
      {isLast ? (
        <div className="opacity-0 transition-opacity group-hover:opacity-100 flex items-center">
          <ActionBarPrimitive.Reload asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-6 text-muted-foreground/50 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              title="重跑"
            >
              <RotateCcw className="size-3" />
            </Button>
          </ActionBarPrimitive.Reload>
        </div>
      ) : null}
    </div>
  );
}

function MessageErrorAlert() {
  const metadata = useCurrentMessageMetadata();
  const isLast = useAuiState((state) => state.message.isLast);

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
      <div className="flex w-full items-start justify-between">
        <div className="flex flex-col gap-1">
          <AlertTitle>{errorPayload?.code}</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{errorPayload?.message}</p>
            <p className="opacity-80">
              {isRecoverable ? '可恢复错误' : '严重终端错误'}
            </p>
          </AlertDescription>
        </div>
        {isLast ? (
          <ActionBarPrimitive.Reload asChild>
            <Button
              variant={isRecoverable ? 'outline' : 'default'}
              size="sm"
              className={isRecoverable ? 'border-amber-400 bg-transparent hover:bg-amber-100' : ''}
            >
              <RotateCcw className="mr-2 size-3" />
              重试操作
            </Button>
          </ActionBarPrimitive.Reload>
        ) : null}
      </div>
    </Alert>
  );
}

export function AssistantMessageBubble() {
  return (
    <MessagePrimitive.Root className="group flex w-full flex-col py-6">
      <div className="flex w-full max-w-4xl mx-auto flex-col items-start gap-1 px-4 sm:px-0">
        <MessageHeader isUser={false} />
        <div className="mt-1 pl-8 w-full [&>*+*]:mt-4">
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
        <div className="pl-8 w-full">
          <MessageErrorAlert />
          <AssistantMessageFooterInfo />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}
