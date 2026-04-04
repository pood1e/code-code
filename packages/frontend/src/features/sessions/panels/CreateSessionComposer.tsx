import { ChevronDown, LoaderCircle, SlidersHorizontal } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import type { AgentRunnerSummary, Profile } from '@agent-workbench/shared';

import {
  MessageComposerError,
  MessageComposerFooterActions,
  MessageComposerField,
  MessageComposerInputArea,
  MessageComposerShell
} from '@/components/app/MessageComposer';
import { Button } from '@/components/ui/button';
import { CompactNativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CreateSessionFormValues } from '@/pages/projects/project-sessions.form';

export function CreateSessionComposer({
  form,
  runners,
  profiles,
  selectedRunnerId,
  selectedProfileId,
  supportsStructuredInitialInput,
  hasInitialMessageDraft,
  advancedOpen,
  submitError,
  canCancel,
  isCreating,
  onToggleAdvanced,
  onCancel,
  onSubmit,
  onPromptKeyDown
}: {
  form: UseFormReturn<CreateSessionFormValues>;
  runners: AgentRunnerSummary[];
  profiles: Profile[];
  selectedRunnerId: string;
  selectedProfileId?: string;
  supportsStructuredInitialInput: boolean;
  hasInitialMessageDraft: boolean;
  advancedOpen: boolean;
  submitError: string | null;
  canCancel: boolean;
  isCreating: boolean;
  onToggleAdvanced: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <div className="flex flex-1 flex-col px-2 py-2 sm:px-4 sm:py-4">
      {submitError ? (
        <MessageComposerError title="创建失败" message={submitError} />
      ) : null}

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col pt-4 sm:pt-6">
        <MessageComposerShell
          header={
            <CreateSessionComposerHeader
              runners={runners}
              profiles={profiles}
              selectedRunnerId={selectedRunnerId}
              selectedProfileId={selectedProfileId}
              advancedOpen={advancedOpen}
              supportsStructuredInitialInput={supportsStructuredInitialInput}
              onToggleAdvanced={onToggleAdvanced}
              onRunnerChange={(runnerId) => form.setValue('runnerId', runnerId)}
              onProfileChange={(profileId) =>
                form.setValue('profileId', profileId)
              }
            />
          }
          footer={
            <MessageComposerFooterActions className="pl-0">
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
          }
          className="border-border/40 bg-background/95 shadow-[0_28px_80px_-36px_hsl(var(--foreground)/0.18)]"
        >
          <div className="space-y-4 pb-1">
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
    </div>
  );
}

function CreateSessionComposerHeader({
  runners,
  profiles,
  selectedRunnerId,
  selectedProfileId,
  advancedOpen,
  supportsStructuredInitialInput,
  onToggleAdvanced,
  onRunnerChange,
  onProfileChange
}: {
  runners: AgentRunnerSummary[];
  profiles: Profile[];
  selectedRunnerId: string;
  selectedProfileId?: string;
  advancedOpen: boolean;
  supportsStructuredInitialInput: boolean;
  onToggleAdvanced: () => void;
  onRunnerChange: (runnerId: string) => void;
  onProfileChange: (profileId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CompactNativeSelect
          aria-label="选择 AgentRunner"
          containerClassName="min-w-[8.75rem]"
          className="w-full whitespace-nowrap bg-background/70"
          value={selectedRunnerId}
          onChange={(event) => onRunnerChange(event.target.value)}
        >
          {runners.map((runner) => (
            <option key={runner.id} value={runner.id}>
              {runner.name}
            </option>
          ))}
        </CompactNativeSelect>

        <CompactNativeSelect
          aria-label="选择 Profile"
          containerClassName="min-w-[8.25rem]"
          className="w-full whitespace-nowrap bg-background/70"
          value={selectedProfileId ?? ''}
          onChange={(event) => onProfileChange(event.target.value)}
        >
          <option value="">Profile</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </CompactNativeSelect>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 rounded-full px-3 text-xs text-muted-foreground whitespace-nowrap',
            advancedOpen && 'bg-accent text-foreground'
          )}
          onClick={onToggleAdvanced}
        >
          <SlidersHorizontal />
          高级设置
          <ChevronDown
            className={cn(
              'size-3 transition-transform duration-200',
              advancedOpen && 'rotate-180'
            )}
          />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {supportsStructuredInitialInput
          ? '发送后会创建会话并提交首条消息'
          : '请填写完整 JSON 后再发送'}
      </p>
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
      error={form.formState.errors.initialMessageText?.message}
    >
      <MessageComposerInputArea hint="Enter 发送，Shift+Enter 换行">
        <Textarea
          aria-label="首条消息"
          rows={9}
          autoFocus
          placeholder="输入首条消息..."
          className="min-h-40 resize-none border-0 bg-transparent px-3 py-3 pb-8 text-[15px] leading-7 shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-44"
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
      error={form.formState.errors.initialRawInput?.message}
    >
      <MessageComposerInputArea hint="使用发送按钮提交，Enter 仅换行">
        <Textarea
          aria-label="首条消息 JSON"
          rows={10}
          autoFocus
          placeholder={'{\n  "prompt": ""\n}'}
          className="min-h-36 resize-none border-0 bg-transparent px-3 py-3 pb-8 font-mono text-sm shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-40"
          onKeyDown={onPromptKeyDown}
          {...form.register('initialRawInput')}
        />
      </MessageComposerInputArea>
    </MessageComposerField>
  );
}
