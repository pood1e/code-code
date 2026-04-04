import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateSessionFormValues } from '@/pages/projects/project-sessions.form';
import type { UseFormReturn } from 'react-hook-form';
import type { ChatSummary, ProfileDetail } from '@agent-workbench/shared';
import { createChat } from '@/api/chats';
import { buildCreateSessionPayload } from '@/pages/projects/project-sessions.form';
import {
  normalizeRunnerConfigValues,
  type RunnerConfigField,
  type SupportedRunnerConfigSchema
} from '@/lib/runner-config-schema';
import { buildStructuredMessagePayload } from '@/features/chat/runtime/assistant-ui/input-schema';
import { parseSessionInputText } from '@/features/chat/runtime/assistant-ui/input-payload';
import { queryKeys } from '@/query/query-keys';

type UseCreateSessionMutationArgs = {
  projectId: string;
  form: UseFormReturn<CreateSessionFormValues>;
  sessionConfigSchema: SupportedRunnerConfigSchema;
  structuredInputSchema:
    | Extract<SupportedRunnerConfigSchema, { supported: true }>
    | undefined;
  structuredRuntimeSchema: SupportedRunnerConfigSchema | undefined;
  primaryInputField: RunnerConfigField | undefined;
  supportsStructuredInitialInput: boolean;
  profileDetail: ProfileDetail | undefined;
  onCreated: (chat: ChatSummary) => void;
};

export function useCreateSessionMutation({
  projectId,
  form,
  sessionConfigSchema,
  structuredInputSchema,
  structuredRuntimeSchema,
  primaryInputField,
  supportsStructuredInitialInput,
  profileDetail,
  onCreated
}: UseCreateSessionMutationArgs) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CreateSessionFormValues) => {
      let runnerSessionConfig = values.runnerSessionConfig;
      if (sessionConfigSchema.supported) {
        const normalized = normalizeRunnerConfigValues(
          sessionConfigSchema.fields,
          values.runnerSessionConfig
        );
        const validationResult =
          sessionConfigSchema.validationSchema.safeParse(normalized);
        if (!validationResult.success) {
          for (const issue of validationResult.error.issues) {
            const fieldName = issue.path[0];
            if (typeof fieldName === 'string') {
              form.setError(
                `runnerSessionConfig.${fieldName}` as `runnerSessionConfig.${string}`,
                {
                  message: issue.message
                }
              );
            }
          }
          throw new Error('Session 配置校验失败');
        }

        runnerSessionConfig = validationResult.data;
      }

      const initialMessageTextValue = values.initialMessageText?.trim() ?? '';
      const initialRawInputValue = values.initialRawInput?.trim() ?? '';
      const initialMessage = supportsStructuredInitialInput
        ? initialMessageTextValue.length > 0
          ? buildStructuredMessagePayload({
              schema: structuredInputSchema!,
              runtimeSchema: structuredRuntimeSchema ?? {
                supported: false as const,
                reason: '不支持'
              },
              primaryField: primaryInputField!,
              composerText: initialMessageTextValue,
              additionalValues: values.initialInputConfig,
              runtimeValues: values.initialRuntimeConfig
            })
          : undefined
        : initialRawInputValue.length > 0
          ? (() => {
              const parsed = parseSessionInputText(initialRawInputValue);
              if (!parsed.data) {
                form.setError('initialRawInput', {
                  message: parsed.error ?? '首条消息输入校验失败'
                });
                throw new Error('首条消息输入校验失败');
              }
              let runtimeConfig: Record<string, unknown> | undefined =
                undefined;
              if (
                structuredRuntimeSchema?.supported &&
                structuredRuntimeSchema.fields.length > 0
              ) {
                const normalized = normalizeRunnerConfigValues(
                  structuredRuntimeSchema.fields,
                  values.initialRuntimeConfig
                );
                const validRuntime =
                  structuredRuntimeSchema.validationSchema.safeParse(
                    normalized
                  );
                if (!validRuntime.success) {
                  for (const issue of validRuntime.error.issues) {
                    const fieldName = issue.path[0];
                    if (typeof fieldName === 'string') {
                      form.setError(
                        `initialRuntimeConfig.${fieldName}` as `initialRuntimeConfig.${string}`,
                        {
                          message: issue.message
                        }
                      );
                    }
                  }
                  throw new Error('首条消息运行时参数校验失败');
                }
                runtimeConfig = validRuntime.data;
              }
              return { input: parsed.data.input, runtimeConfig };
            })()
          : undefined;

      return createChat(
        buildCreateSessionPayload(
          projectId,
          {
            ...values,
            runnerSessionConfig
          },
          profileDetail,
          initialMessage
        )
      );
    },
    onSuccess: async (chat) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chats.list(projectId)
      });
      queryClient.setQueryData(queryKeys.chats.detail(chat.id), chat);
      onCreated(chat);
    }
  });
}
