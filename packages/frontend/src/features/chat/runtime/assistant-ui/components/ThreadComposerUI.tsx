import React, { useEffect } from 'react';
import { ComposerPrimitive, useAui, useAuiState } from '@assistant-ui/react';
import { LoaderCircle, Square, SendHorizontal } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MessageComposerFooterActions,
  MessageComposerFooterMeta,
  MessageComposerInputArea,
  MessageComposerShell
} from '@/components/app/MessageComposer';
import { Input } from '@/components/ui/input';
import { CompactNativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

import {
  type RunnerConfigField,
  getRunnerConfigFieldValue,
  getRunnerConfigSelectOptions,
  shouldRenderEmptyEnumOption
} from '@/lib/runner-config-schema';

import { ThreadConfigContext } from '../context';

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

export function AdditionalInputFields({
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
            const fieldId = `composer-additional-${field.name}`;

            if (field.kind === 'boolean') {
              return (
                <label
                  key={field.name}
                  htmlFor={fieldId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/70 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {field.label}
                    </p>
                    {field.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {field.description}
                      </p>
                    ) : null}
                  </div>
                  <input
                    id={fieldId}
                    type="checkbox"
                    className="size-4"
                    checked={Boolean(values[field.name])}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange(field.name, event.target.checked)
                    }
                  />
                </label>
              );
            }

            if (field.kind === 'enum') {
              const optionsToRender = getRunnerConfigSelectOptions(field);

              return (
                <div key={field.name} className="space-y-2">
                  <label
                    htmlFor={fieldId}
                    className="block text-sm font-medium text-foreground"
                  >
                    {field.label}
                  </label>
                  {field.description ? (
                    <p className="text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  ) : null}
                  <select
                    id={fieldId}
                    aria-label={field.label}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                    value={getRunnerConfigFieldValue(field, values[field.name])}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange(field.name, event.target.value)
                    }
                  >
                    {shouldRenderEmptyEnumOption(field) ? (
                      <option value="">未设置</option>
                    ) : null}
                    {optionsToRender.map((option) => (
                      <option key={option.value} value={option.value}>
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
                <label
                  htmlFor={fieldId}
                  className="block text-sm font-medium text-foreground"
                >
                  {field.label}
                </label>
                {field.description ? (
                  <p className="text-xs text-muted-foreground">
                    {field.description}
                  </p>
                ) : null}
                {isMultiline ? (
                  <Textarea
                    id={fieldId}
                    aria-label={field.label}
                    rows={3}
                    value={value}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange(field.name, event.target.value)
                    }
                  />
                ) : (
                  <Input
                    id={fieldId}
                    aria-label={field.label}
                    type={
                      field.kind === 'url'
                        ? 'url'
                        : field.kind === 'number' || field.kind === 'integer'
                          ? 'number'
                          : 'text'
                    }
                    value={value}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange(field.name, event.target.value)
                    }
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

export function ThreadComposerUI({
  mode,
  additionalFields,
  initialAdditionalValues,
  runtimeFields,
  initialRuntimeValues,
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
  composerError: string | null;
  discoveredOptions?: Record<
    string,
    Array<{ label: string; value: string } | string>
  >;
  onAdditionalValueChange: (fieldName: string, value: unknown) => void;
  onRuntimeValueChange: (fieldName: string, value: unknown) => void;
}) {
  const [additionalValues, setAdditionalValues] = React.useState(
    initialAdditionalValues
  );
  const [runtimeValues, setRuntimeValues] =
    React.useState(initialRuntimeValues);

  useEffect(() => {
    setAdditionalValues(initialAdditionalValues);
  }, [initialAdditionalValues]);

  useEffect(() => {
    setRuntimeValues(initialRuntimeValues);
  }, [initialRuntimeValues]);

  const handleAdditionalValueChange = (fieldName: string, value: unknown) => {
    setAdditionalValues((current) => ({ ...current, [fieldName]: value }));
    onAdditionalValueChange(fieldName, value);
  };

  const handleRuntimeValueChange = (fieldName: string, value: unknown) => {
    setRuntimeValues((current) => ({ ...current, [fieldName]: value }));
    onRuntimeValueChange(fieldName, value);
  };

  const isRunning = useAuiState((state) => state.thread.isRunning);
  const isDisabled = useAuiState((state) => state.thread.isDisabled);
  const composerText = useAuiState((state) => state.composer.text);
  const sendDisabled =
    isRunning || isDisabled || composerText.trim().length === 0;
  const { assistantName } = React.useContext(ThreadConfigContext);

  return (
    <div className="w-full bg-gradient-to-t from-background via-background to-transparent pb-6 pt-4">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 sm:px-0">
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

        <ComposerPrimitive.Root>
          <RawJsonTemplateSync enabled={mode === 'raw-json'} />
          <MessageComposerShell
            footer={
              <>
                <MessageComposerFooterMeta>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {runtimeFields.length > 0
                      ? runtimeFields.map((field) => {
                          const discoveredEnumList =
                            field.contextKey && discoveredOptions
                              ? discoveredOptions[field.contextKey]
                              : undefined;
                          const hasDiscoveredEnums =
                            Array.isArray(discoveredEnumList) &&
                            discoveredEnumList.length > 0;

                          if (field.kind === 'enum' || hasDiscoveredEnums) {
                            const val = getRunnerConfigFieldValue(
                              field,
                              runtimeValues[field.name]
                            );
                            const optionsToRender =
                              getRunnerConfigSelectOptions(
                                field,
                                discoveredEnumList
                              );

                            return (
                              <CompactNativeSelect
                                key={field.name}
                                aria-label={field.label}
                                value={val}
                                disabled={isDisabled}
                                onChange={(e) =>
                                  handleRuntimeValueChange(
                                    field.name,
                                    e.target.value
                                  )
                                }
                                containerClassName="max-w-[148px]"
                                className="h-8 w-full bg-muted/25 text-muted-foreground hover:text-foreground"
                                title={field.label}
                              >
                                {shouldRenderEmptyEnumOption(field) ? (
                                  <option value="">未设置</option>
                                ) : null}
                                {optionsToRender.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </CompactNativeSelect>
                            );
                          }

                          const val = getRunnerConfigFieldValue(
                            field,
                            runtimeValues[field.name]
                          );
                          return (
                            <Input
                              key={field.name}
                              aria-label={field.label}
                              placeholder={field.label}
                              value={val}
                              disabled={isDisabled}
                              onChange={(e) =>
                                handleRuntimeValueChange(
                                  field.name,
                                  e.target.value
                                )
                              }
                              className="h-8 max-w-[120px] rounded-full border-none bg-muted/30 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          );
                        })
                      : null}

                    {mode === 'text' && additionalFields.length > 0 ? (
                      <AdditionalInputFields
                        fields={additionalFields}
                        values={additionalValues}
                        disabled={isDisabled}
                        onChange={handleAdditionalValueChange}
                      />
                    ) : null}
                  </div>
                </MessageComposerFooterMeta>

                <MessageComposerFooterActions>
                  {isDisabled && !isRunning ? (
                    <span className="mr-2 text-xs text-muted-foreground">
                      会话暂不可用
                    </span>
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
                className="w-full resize-none border-none bg-transparent px-3 py-4 pb-8 text-[15px] leading-7 outline-none placeholder:text-muted-foreground/75 focus:ring-0"
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
