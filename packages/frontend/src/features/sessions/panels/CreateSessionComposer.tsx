import { LoaderCircle } from 'lucide-react';
import {
  type UseFormReturn,
  useWatch
} from 'react-hook-form';

import {
  MessageComposerError,
  MessageComposerFooterActions,
  MessageComposerFooterMeta,
  MessageComposerField,
  MessageComposerInputArea,
  MessageComposerShell
} from '@/components/app/MessageComposer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RunnerConfigField } from '@/lib/runner-config-schema';
import type { CreateSessionFormValues } from '@/pages/projects/project-sessions.form';
import {
  AdditionalInputFields,
  ThreadComposerRuntimeFields,
  type ThreadComposerDiscoveredOptions
} from '@/features/chat/runtime/assistant-ui/components/thread-composer.config';

export function CreateSessionComposer({
  form,
  runtimeFields,
  additionalInputFields,
  runnerContext,
  supportsStructuredInitialInput,
  hasInitialMessageDraft,
  submitError,
  canCancel,
  isCreating,
  onCancel,
  onSubmit,
  onPromptKeyDown
}: {
  form: UseFormReturn<CreateSessionFormValues>;
  runtimeFields: RunnerConfigField[];
  additionalInputFields: RunnerConfigField[];
  runnerContext: ThreadComposerDiscoveredOptions | undefined;
  supportsStructuredInitialInput: boolean;
  hasInitialMessageDraft: boolean;
  submitError: string | null;
  canCancel: boolean;
  isCreating: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  const runtimeValues = useWatch({
    control: form.control,
    name: 'initialRuntimeConfig'
  });
  const additionalInputValues = useWatch({
    control: form.control,
    name: 'initialInputConfig'
  });

  return (
    <div className="flex flex-col gap-3">
      {submitError ? (
        <MessageComposerError title="创建失败" message={submitError} />
      ) : null}

      <MessageComposerShell
        footer={
          <>
            <MessageComposerFooterMeta>
              <div className="flex flex-wrap items-center gap-1.5">
                <ThreadComposerRuntimeFields
                  disabled={isCreating}
                  discoveredOptions={runnerContext}
                  fields={runtimeFields}
                  onChange={(fieldName, value) =>
                    form.setValue(`initialRuntimeConfig.${fieldName}`, value, {
                      shouldDirty: true
                    })
                  }
                  values={runtimeValues ?? {}}
                />

                {supportsStructuredInitialInput &&
                additionalInputFields.length > 0 ? (
                  <AdditionalInputFields
                    disabled={isCreating}
                    fields={additionalInputFields}
                    onChange={(fieldName, value) =>
                      form.setValue(`initialInputConfig.${fieldName}`, value, {
                        shouldDirty: true
                      })
                    }
                    values={additionalInputValues ?? {}}
                  />
                ) : null}
              </div>
            </MessageComposerFooterMeta>

            <MessageComposerFooterActions>
              {canCancel ? (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  取消
                </Button>
              ) : null}
              <Button
                onClick={onSubmit}
                disabled={isCreating || !hasInitialMessageDraft}
                className="h-9 min-w-24 rounded-full px-5 shadow-sm"
              >
                {isCreating ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                发送
              </Button>
            </MessageComposerFooterActions>
          </>
        }
        className="border-border/40 bg-background/95 shadow-[0_22px_64px_-40px_hsl(var(--foreground)/0.16)]"
      >
        <div className="space-y-3 pb-1">
          {supportsStructuredInitialInput ? (
            <CreateSessionPromptField
              form={form}
              onPromptKeyDown={onPromptKeyDown}
            />
          ) : (
            <CreateSessionRawInputField
              form={form}
              onPromptKeyDown={onPromptKeyDown}
            />
          )}
        </div>
      </MessageComposerShell>
    </div>
  );
}

function CreateSessionPromptField({
  form,
  onPromptKeyDown
}: {
  form: UseFormReturn<CreateSessionFormValues>;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <MessageComposerField
      label="首条消息"
      hideLabel
      error={form.formState.errors.initialMessageText?.message}
    >
      <MessageComposerInputArea hint="Enter 发送，Shift+Enter 换行">
        <Textarea
          aria-label="首条消息"
          rows={7}
          autoFocus
          placeholder="输入首条消息..."
          className="min-h-32 resize-none border-0 bg-transparent px-3 py-3 pb-8 text-[15px] leading-7 shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-36"
          onKeyDown={onPromptKeyDown}
          {...form.register('initialMessageText')}
        />
      </MessageComposerInputArea>
    </MessageComposerField>
  );
}

function CreateSessionRawInputField({
  form,
  onPromptKeyDown
}: {
  form: UseFormReturn<CreateSessionFormValues>;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <MessageComposerField
      label="首条消息 JSON"
      hideLabel
      error={form.formState.errors.initialRawInput?.message}
    >
      <MessageComposerInputArea hint="使用发送按钮提交，Enter 仅换行">
        <Textarea
          aria-label="首条消息 JSON"
          rows={8}
          autoFocus
          placeholder={'{\n  "prompt": ""\n}'}
          className="min-h-32 resize-none border-0 bg-transparent px-3 py-3 pb-8 font-mono text-sm shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-36"
          onKeyDown={onPromptKeyDown}
          {...form.register('initialRawInput')}
        />
      </MessageComposerInputArea>
    </MessageComposerField>
  );
}
