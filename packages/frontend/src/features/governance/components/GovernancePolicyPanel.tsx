import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  type AgentRunnerSummary,
  DEFAULT_GOVERNANCE_AGENT_STRATEGY,
  DEFAULT_GOVERNANCE_SOURCE_SELECTION,
  GovernanceAgentMergeStrategy,
  type GovernanceAgentStrategy,
  type GovernancePolicy,
  type GovernanceStageAgentStrategy,
  updateGovernancePolicyInputSchema
} from '@agent-workbench/shared';

import { toApiRequestError } from '@/api/client';
import { FormField } from '@/components/app/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const STAGE_FIELDS = [
  { key: 'discovery', label: 'Discovery' },
  { key: 'triage', label: 'Triage' },
  { key: 'planning', label: 'Planning' },
  { key: 'execution', label: 'Execution' }
] as const satisfies ReadonlyArray<{
  key: Exclude<keyof GovernanceAgentStrategy, 'defaultRunnerIds'>;
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
  const sourceSelection =
    parsedPolicy?.sourceSelection ?? DEFAULT_GOVERNANCE_SOURCE_SELECTION;
  const agentStrategy =
    parsedPolicy?.agentStrategy ?? DEFAULT_GOVERNANCE_AGENT_STRATEGY;
  const editorDisabled = !parsedPolicy || isPending;

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
      className="space-y-4 rounded-lg border bg-muted/20 p-3"
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
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Repo Branch" htmlFor="governance-policy-repo-branch">
          <Input
            id="governance-policy-repo-branch"
            value={sourceSelection.repoBranch ?? ''}
            disabled={editorDisabled}
            placeholder="默认分支"
            onChange={(event) =>
              updatePolicyJson(form, parsedPolicy, (policyInput) => ({
                ...policyInput,
                sourceSelection: {
                  ...DEFAULT_GOVERNANCE_SOURCE_SELECTION,
                  ...(policyInput.sourceSelection ?? {}),
                  repoBranch: event.target.value.trim() || null
                }
              }))
            }
          />
        </FormField>

        <FormField label="Doc Branch" htmlFor="governance-policy-doc-branch">
          <Input
            id="governance-policy-doc-branch"
            value={sourceSelection.docBranch ?? ''}
            disabled={editorDisabled}
            placeholder="默认文档分支"
            onChange={(event) =>
              updatePolicyJson(form, parsedPolicy, (policyInput) => ({
                ...policyInput,
                sourceSelection: {
                  ...DEFAULT_GOVERNANCE_SOURCE_SELECTION,
                  ...(policyInput.sourceSelection ?? {}),
                  docBranch: event.target.value.trim() || null
                }
              }))
            }
          />
        </FormField>
      </div>

      <PolicyRunnerPoolField
        label="Default Runner Pool"
        runners={runners}
        selectedRunnerIds={agentStrategy.defaultRunnerIds}
        disabled={editorDisabled}
        onToggle={(runnerId, checked) =>
          updatePolicyJson(form, parsedPolicy, (policyInput) => ({
            ...policyInput,
            agentStrategy: {
              ...DEFAULT_GOVERNANCE_AGENT_STRATEGY,
              ...(policyInput.agentStrategy ?? {}),
              defaultRunnerIds: toggleRunnerId(
                policyInput.agentStrategy?.defaultRunnerIds ?? [],
                runnerId,
                checked
              )
            }
          }))
        }
      />

      <div className="grid gap-3 xl:grid-cols-2">
        {STAGE_FIELDS.map((stage) => (
          <StageAgentStrategyField
            key={stage.key}
            label={stage.label}
            stageKey={stage.key}
            strategy={agentStrategy[stage.key] as GovernanceStageAgentStrategy | null}
            runners={runners}
            disabled={editorDisabled}
            onChange={(nextStrategy) =>
              updatePolicyJson(form, parsedPolicy, (policyInput) => ({
                ...policyInput,
                agentStrategy: {
                  ...DEFAULT_GOVERNANCE_AGENT_STRATEGY,
                  ...(policyInput.agentStrategy ?? {}),
                  [stage.key]: nextStrategy
                }
              }))
            }
          />
        ))}
      </div>

      {!parsedPolicy ? (
        <p className="text-[11px] text-amber-600">
          先修正下面的 Policy JSON，才能编辑分支和 runner 策略。
        </p>
      ) : null}

      {runners.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          当前还没有可选 Runner。
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

type PolicyRunnerPoolFieldProps = {
  label: string;
  runners: AgentRunnerSummary[];
  selectedRunnerIds: string[];
  disabled: boolean;
  onToggle: (runnerId: string, checked: boolean) => void;
};

function PolicyRunnerPoolField({
  label,
  runners,
  selectedRunnerIds,
  disabled,
  onToggle
}: PolicyRunnerPoolFieldProps) {
  return (
    <div className="space-y-2 rounded-md border bg-background/70 p-3">
      <p className="text-xs font-medium">{label}</p>
      <RunnerCheckboxList
        runners={runners}
        selectedRunnerIds={selectedRunnerIds}
        disabled={disabled}
        onToggle={onToggle}
      />
    </div>
  );
}

type StageAgentStrategyFieldProps = {
  label: string;
  stageKey: Exclude<keyof GovernanceAgentStrategy, 'defaultRunnerIds'>;
  strategy: GovernanceStageAgentStrategy | null;
  runners: AgentRunnerSummary[];
  disabled: boolean;
  onChange: (strategy: GovernanceStageAgentStrategy | null) => void;
};

function StageAgentStrategyField({
  label,
  stageKey,
  strategy,
  runners,
  disabled,
  onChange
}: StageAgentStrategyFieldProps) {
  const effectiveStrategy = strategy ?? createDefaultStageStrategy();
  const isExecution = stageKey === 'execution';

  return (
    <div className="space-y-3 rounded-md border bg-background/70 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">{label}</p>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={strategy !== null}
            disabled={disabled}
            onChange={(event) =>
              onChange(event.target.checked ? createDefaultStageStrategy() : null)
            }
          />
          Override
        </label>
      </div>

      <RunnerCheckboxList
        runners={runners}
        selectedRunnerIds={effectiveStrategy.runnerIds}
        disabled={disabled || strategy === null}
        onToggle={(runnerId, checked) =>
          onChange({
            ...effectiveStrategy,
            runnerIds: toggleRunnerId(effectiveStrategy.runnerIds, runnerId, checked)
          })
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label={`${label} Fanout`}
          htmlFor={`governance-stage-fanout-${stageKey}`}
        >
          <Input
            id={`governance-stage-fanout-${stageKey}`}
            type="number"
            min={1}
            value={String(effectiveStrategy.fanoutCount)}
            disabled={disabled || strategy === null || isExecution}
            onChange={(event) =>
              onChange({
                ...effectiveStrategy,
                fanoutCount: Math.max(1, Number.parseInt(event.target.value || '1', 10))
              })
            }
          />
        </FormField>

        <FormField
          label="Merge Strategy"
          htmlFor={`governance-stage-merge-${stageKey}`}
        >
          <NativeSelect
            id={`governance-stage-merge-${stageKey}`}
            aria-label={`${label} Merge Strategy`}
            value={isExecution ? GovernanceAgentMergeStrategy.Single : effectiveStrategy.mergeStrategy}
            disabled={disabled || strategy === null || isExecution}
            onChange={(event) =>
              onChange({
                ...effectiveStrategy,
                mergeStrategy: event.target.value as GovernanceAgentMergeStrategy
              })
            }
          >
            <option value={GovernanceAgentMergeStrategy.Single}>single</option>
            <option value={GovernanceAgentMergeStrategy.BestOfN}>best_of_n</option>
            <option value={GovernanceAgentMergeStrategy.UnionDedup}>union_dedup</option>
          </NativeSelect>
        </FormField>
      </div>

      {isExecution ? (
        <p className="text-[11px] text-muted-foreground">
          Execution 只使用单写者。
        </p>
      ) : null}
    </div>
  );
}

type RunnerCheckboxListProps = {
  runners: AgentRunnerSummary[];
  selectedRunnerIds: string[];
  disabled: boolean;
  onToggle: (runnerId: string, checked: boolean) => void;
};

function RunnerCheckboxList({
  runners,
  selectedRunnerIds,
  disabled,
  onToggle
}: RunnerCheckboxListProps) {
  if (runners.length === 0) {
    return <p className="text-[11px] text-muted-foreground">暂无 Runner</p>;
  }

  return (
    <div className="grid gap-2">
      {runners.map((runner) => (
        <label
          key={runner.id}
          className="flex items-center gap-2 text-[11px] text-foreground"
        >
          <input
            type="checkbox"
            checked={selectedRunnerIds.includes(runner.id)}
            disabled={disabled}
            onChange={(event) => onToggle(runner.id, event.target.checked)}
          />
          <span>
            {runner.name} ({runner.type})
          </span>
        </label>
      ))}
    </div>
  );
}

function buildEditablePolicyJson(policy: GovernancePolicy) {
  return {
    priorityPolicy: policy.priorityPolicy,
    autoActionPolicy: policy.autoActionPolicy,
    deliveryPolicy: policy.deliveryPolicy,
    sourceSelection: policy.sourceSelection,
    agentStrategy: policy.agentStrategy
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

function updatePolicyJson(
  form: UseFormReturn<z.infer<typeof policyJsonFormSchema>>,
  parsedPolicy: z.infer<typeof updateGovernancePolicyInputSchema> | null,
  updater: (
    policy: z.infer<typeof updateGovernancePolicyInputSchema>
  ) => z.infer<typeof updateGovernancePolicyInputSchema>
) {
  if (!parsedPolicy) {
    return;
  }

  form.setValue('policyJson', JSON.stringify(updater(parsedPolicy), null, 2), {
    shouldDirty: true,
    shouldValidate: true
  });
}

function createDefaultStageStrategy(): GovernanceStageAgentStrategy {
  return {
    runnerIds: [],
    fanoutCount: 1,
    mergeStrategy: GovernanceAgentMergeStrategy.Single
  };
}

function toggleRunnerId(
  selectedRunnerIds: string[],
  runnerId: string,
  checked: boolean
) {
  if (checked) {
    return Array.from(new Set([...selectedRunnerIds, runnerId]));
  }

  return selectedRunnerIds.filter((value) => value !== runnerId);
}
