import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  type AgentRunnerSummary,
  type GovernanceRunnerSelection,
  type GovernancePolicy,
  updateGovernancePolicyInputSchema
} from '@agent-workbench/shared';

import { toApiRequestError } from '@/api/client';
import { FormField } from '@/components/app/FormField';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

const policyJsonFormSchema = z.object({
  policyJson: z
    .string()
    .trim()
    .min(1, '请输入 policy JSON')
    .superRefine((value, ctx) => {
      try {
        const parsed = JSON.parse(value) as unknown;
        const result = updateGovernancePolicyInputSchema.safeParse(parsed);
        if (!result.success) {
          const firstIssue = result.error.issues[0];
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: firstIssue?.message ?? 'Policy JSON 不合法'
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Policy JSON 解析失败'
        });
      }
    })
});

const RUNNER_SELECTION_FIELDS = [
  { key: 'defaultRunnerId', label: 'Default Runner' },
  { key: 'discoveryRunnerId', label: 'Discovery Runner' },
  { key: 'triageRunnerId', label: 'Triage Runner' },
  { key: 'planningRunnerId', label: 'Planning Runner' },
  { key: 'executionRunnerId', label: 'Execution Runner' }
] as const satisfies ReadonlyArray<{
  key: keyof GovernanceRunnerSelection;
  label: string;
}>;

type GovernancePolicyPanelProps = {
  policy: GovernancePolicy | undefined;
  runners: AgentRunnerSummary[];
  isLoading: boolean;
  isPending: boolean;
  onSubmit: (payload: z.infer<typeof updateGovernancePolicyInputSchema>) => Promise<void>;
};

export function GovernancePolicyPanel({
  policy,
  runners,
  isLoading,
  isPending,
  onSubmit
}: GovernancePolicyPanelProps) {
  const form = useForm<z.infer<typeof policyJsonFormSchema>>({
    resolver: zodResolver(policyJsonFormSchema),
    defaultValues: {
      policyJson: ''
    }
  });
  const policyJson = form.watch('policyJson');
  const parsedPolicy = parsePolicyJson(policyJson);
  const runnerSelection = parsedPolicy?.runnerSelection ?? null;
  const runnerSelectionDisabled = !parsedPolicy;

  useEffect(() => {
    if (!policy) {
      return;
    }

    form.reset({
      policyJson: JSON.stringify(buildEditablePolicyJson(policy), null, 2)
    });
  }, [form, policy]);

  if (isLoading && !policy) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
        加载 policy...
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border bg-muted/20 p-3"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          const parsed = updateGovernancePolicyInputSchema.parse(
            JSON.parse(values.policyJson) as unknown
          );
          await onSubmit(parsed);
        } catch (error) {
          form.setError('policyJson', {
            message: toApiRequestError(error).message
          });
        }
      })}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Policy
        </p>
        <p className="text-[11px] text-muted-foreground">
          项目级 priority / auto-action / delivery / runner 策略
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {RUNNER_SELECTION_FIELDS.map((field) => (
          <FormField
            key={field.key}
            label={field.label}
            htmlFor={`governance-runner-${field.key}`}
          >
            <NativeSelect
              id={`governance-runner-${field.key}`}
              aria-label={field.label}
              value={runnerSelection?.[field.key] ?? ''}
              disabled={runnerSelectionDisabled || isPending}
              onChange={(event) =>
                updateRunnerSelectionField({
                  field: field.key,
                  runnerId: event.target.value || null,
                  parsedPolicy,
                  setPolicyJson: (nextPolicyJson) =>
                    form.setValue('policyJson', nextPolicyJson, {
                      shouldDirty: true,
                      shouldValidate: true
                    })
                })
              }
            >
              <option value="">未配置</option>
              {runners.map((runner) => (
                <option key={runner.id} value={runner.id}>
                  {runner.name} ({runner.type})
                </option>
              ))}
            </NativeSelect>
          </FormField>
        ))}
      </div>

      {runnerSelectionDisabled ? (
        <p className="text-[11px] text-amber-600">
          先修正下面的 Policy JSON，才能编辑 runner 选择。
        </p>
      ) : null}

      {runners.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          当前还没有可选的 Agent Runner。先在 Agent Runners 页面创建，再回这里绑定。
        </p>
      ) : null}

      <FormField
        label="Policy JSON"
        htmlFor="governance-policy-json"
        error={form.formState.errors.policyJson?.message}
      >
        <Textarea
          id="governance-policy-json"
          rows={16}
          className="font-mono text-[11px]"
          {...form.register('policyJson')}
        />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          Save Policy
        </Button>
      </div>
    </form>
  );
}

function buildEditablePolicyJson(policy: GovernancePolicy) {
  return {
    priorityPolicy: policy.priorityPolicy,
    autoActionPolicy: policy.autoActionPolicy,
    deliveryPolicy: policy.deliveryPolicy,
    runnerSelection: policy.runnerSelection
  };
}

function parsePolicyJson(policyJson: string) {
  try {
    const parsed = JSON.parse(policyJson) as unknown;
    const result = updateGovernancePolicyInputSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function updateRunnerSelectionField(input: {
  field: keyof GovernanceRunnerSelection;
  runnerId: string | null;
  parsedPolicy: z.infer<typeof updateGovernancePolicyInputSchema> | null;
  setPolicyJson: (policyJson: string) => void;
}) {
  if (!input.parsedPolicy) {
    return;
  }

  const nextPolicy = {
    ...input.parsedPolicy,
    runnerSelection: {
      defaultRunnerId: null,
      discoveryRunnerId: null,
      triageRunnerId: null,
      planningRunnerId: null,
      executionRunnerId: null,
      ...(input.parsedPolicy.runnerSelection ?? {}),
      [input.field]: input.runnerId
    }
  };

  input.setPolicyJson(JSON.stringify(nextPolicy, null, 2));
}
