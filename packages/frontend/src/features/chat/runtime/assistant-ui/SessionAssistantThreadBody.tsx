import { lazy, Suspense } from 'react';
import { ThreadPrimitive } from '@assistant-ui/react';
import { LoaderCircle } from 'lucide-react';

import { ThreadComposerUI } from './components/ThreadComposerUI';
import type { useSessionAssistantThreadState } from './use-session-assistant-thread-state';

const SessionAssistantThreadHistory = lazy(async () => {
  const module = await import('./SessionAssistantThreadHistory');
  return { default: module.SessionAssistantThreadHistory };
});

export function SessionAssistantThreadBody({
  additionalInputFields,
  canReload,
  composerDisabledHint,
  composerRecoveryAction,
  composerError,
  composerKey,
  composerMode,
  firstItemIndex,
  handleAdditionalValueChange,
  handleRuntimeValueChange,
  initialAdditionalInputValues,
  initialRuntimeValues,
  messagesReady,
  onLoadMore,
  onReload,
  runtimeMessages,
  runnerContext,
  runtimeFields
}: ReturnType<typeof useSessionAssistantThreadState> & {
  canReload: boolean;
  composerDisabledHint: string | null;
  composerRecoveryAction?: {
    label: string;
    onClick: () => void;
  };
  messagesReady: boolean;
  onLoadMore?: () => void;
  onReload: () => Promise<void>;
}) {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <style>{'.scrollbar-hide::-webkit-scrollbar { display: none; }'}</style>
      {runtimeMessages.length === 0 ? (
        <SessionThreadEmptyState messagesReady={messagesReady} />
      ) : (
        <Suspense fallback={<SessionThreadHistoryFallback />}>
          <SessionAssistantThreadHistory
            canReload={canReload}
            records={runtimeMessages}
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
        disabledHint={composerDisabledHint}
        recoveryAction={composerRecoveryAction}
        composerError={composerError}
        discoveredOptions={runnerContext}
        onAdditionalValueChange={handleAdditionalValueChange}
        onRuntimeValueChange={handleRuntimeValueChange}
      />
    </ThreadPrimitive.Root>
  );
}

function SessionThreadEmptyState({
  messagesReady
}: {
  messagesReady: boolean;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-0">
      {messagesReady ? (
        <div className="flex min-h-[18rem] flex-col items-center justify-end gap-2 pb-6 pt-8 text-center">
          <p className="text-base font-medium text-foreground">开始对话</p>
          <p className="text-sm text-muted-foreground">消息会显示在这里</p>
        </div>
      ) : (
        <div className="flex min-h-[18rem] flex-col items-center justify-end gap-3 pb-6 pt-8 text-center text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
          <p className="text-sm">正在加载历史消息...</p>
        </div>
      )}
    </div>
  );
}

function SessionThreadHistoryFallback() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-0">
      <div className="flex min-h-[18rem] flex-col items-center justify-end gap-3 pb-6 pt-8 text-center text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        <p className="text-sm">正在渲染消息...</p>
      </div>
    </div>
  );
}
