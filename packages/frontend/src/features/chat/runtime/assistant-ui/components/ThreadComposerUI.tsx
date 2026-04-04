import React, { useEffect } from 'react';
import { ComposerPrimitive, useAui, useAuiState } from '@assistant-ui/react';
import { Square, SendHorizontal } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  MessageComposerFooterActions,
  MessageComposerFooterMeta,
  MessageComposerInputArea,
  MessageComposerShell
} from '@/components/app/MessageComposer';
import type { RunnerConfigField } from '@/lib/runner-config-schema';

import { ThreadConfigContext } from '../context';

import {
  AdditionalInputFields,
  ThreadComposerRuntimeFields,
  type ThreadComposerDiscoveredOptions,
  useThreadComposerConfigState
} from './thread-composer.config';

const rawJsonTemplate = '{\n  "prompt": ""\n}';

export function RawJsonTemplateSync({ enabled }: { enabled: boolean }) {
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

export { AdditionalInputFields } from './thread-composer.config';

export function ThreadComposerUI({
  mode,
  additionalFields,
  initialAdditionalValues,
  runtimeFields,
  initialRuntimeValues,
  disabledHint,
  recoveryAction,
  composerError,
  discoveredOptions,
  onAdditionalValueChange,
  onRuntimeValueChange
}: {
  mode: 'text' | 'raw-json';
  additionalFields: RunnerConfigField[];
  initialAdditionalValues: Record<string, unknown>;
  runtimeFields: RunnerConfigField[];
  initialRuntimeValues: Record<string, unknown>;
  disabledHint?: string | null;
  recoveryAction?: {
    label: string;
    onClick: () => void;
  };
  composerError: string | null;
  discoveredOptions?: ThreadComposerDiscoveredOptions;
  onAdditionalValueChange: (fieldName: string, value: unknown) => void;
  onRuntimeValueChange: (fieldName: string, value: unknown) => void;
}) {
  const {
    additionalValues,
    handleAdditionalValueChange,
    handleRuntimeValueChange,
    runtimeValues
  } = useThreadComposerConfigState({
    initialAdditionalValues,
    initialRuntimeValues,
    onAdditionalValueChange,
    onRuntimeValueChange
  });

  const isRunning = useAuiState((state) => state.thread.isRunning);
  const isDisabled = useAuiState((state) => state.thread.isDisabled);
  const composerText = useAuiState((state) => state.composer.text);
  const sendDisabled =
    isRunning || isDisabled || composerText.trim().length === 0;
  const { assistantName } = React.useContext(ThreadConfigContext);
  const showRecoveryAction = Boolean(recoveryAction) && isDisabled && !isRunning;
  const showFooterControls = !showRecoveryAction;
  const footerRecoveryAction = showRecoveryAction ? recoveryAction : null;

  return (
    <div className="w-full bg-gradient-to-t from-background via-background to-transparent pb-4 pt-3">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 sm:px-0">
        {composerError ? (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>发送失败</AlertTitle>
            <AlertDescription>{composerError}</AlertDescription>
          </Alert>
        ) : null}

        <ComposerPrimitive.Root>
          <RawJsonTemplateSync enabled={mode === 'raw-json'} />
          <MessageComposerShell
            footer={
              <>
                <MessageComposerFooterMeta>
                  {showFooterControls ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ThreadComposerRuntimeFields
                        disabled={isDisabled}
                        discoveredOptions={discoveredOptions}
                        fields={runtimeFields}
                        onChange={handleRuntimeValueChange}
                        values={runtimeValues}
                      />

                      {mode === 'text' && additionalFields.length > 0 ? (
                        <AdditionalInputFields
                          fields={additionalFields}
                          values={additionalValues}
                          disabled={isDisabled}
                          onChange={handleAdditionalValueChange}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </MessageComposerFooterMeta>

                <MessageComposerFooterActions>
                  {isDisabled && !isRunning ? (
                    <span className="mr-2 text-xs text-muted-foreground">
                      {disabledHint ?? '会话暂不可用'}
                    </span>
                  ) : null}
                  {footerRecoveryAction ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full px-3"
                      onClick={footerRecoveryAction.onClick}
                    >
                      <span>{footerRecoveryAction.label}</span>
                    </Button>
                  ) : null}
                  {isRunning ? (
                    <ComposerPrimitive.Cancel asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full px-3"
                        title="中止"
                      >
                        <Square className="size-3" fill="currentColor" />
                        <span>中止</span>
                      </Button>
                    </ComposerPrimitive.Cancel>
                  ) : null}
                  {footerRecoveryAction ? null : (
                    <ComposerPrimitive.Send asChild>
                      <Button
                        type="submit"
                        disabled={sendDisabled}
                        size="sm"
                        className="h-8 rounded-full px-3 transition-transform active:scale-95"
                        title="发送"
                      >
                        <SendHorizontal className="size-4" />
                        <span>发送</span>
                      </Button>
                    </ComposerPrimitive.Send>
                  )}
                </MessageComposerFooterActions>
              </>
            }
          >
            <MessageComposerInputArea
              hint={
                mode === 'text'
                  ? 'Enter 发送，Shift+Enter 换行'
                  : '使用发送按钮提交，Enter 仅换行'
              }
              className="pb-0"
            >
                <ComposerPrimitive.Input
                className="w-full resize-none border-none bg-transparent px-3 py-3.5 pb-7 text-[15px] leading-7 outline-none placeholder:text-muted-foreground/75 focus:ring-0"
                placeholder={
                  mode === 'text'
                    ? `给 ${assistantName || 'AI'} 发送消息...`
                    : '输入 JSON'
                }
                minRows={mode === 'text' ? 1 : 4}
                maxRows={14}
                submitMode="enter"
              />
            </MessageComposerInputArea>
          </MessageComposerShell>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
}
