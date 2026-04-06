import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  type GovernancePolicy,
  updateGovernancePolicyInputSchema
} from '@agent-workbench/shared';

import { toApiRequestError } from '@/api/client';
import { FormField } from '@/components/app/FormField';
import { Button } from '@/components/ui/button';
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

type GovernancePolicyPanelProps = {
  policy: GovernancePolicy | undefined;
  isLoading: boolean;
  isPending: boolean;
  onSubmit: (payload: z.infer<typeof updateGovernancePolicyInputSchema>) => Promise<void>;
};

export function GovernancePolicyPanel({
  policy,
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

  useEffect(() => {
    if (!policy) {
      return;
    }

    form.reset({
      policyJson: JSON.stringify(
        {
          priorityPolicy: policy.priorityPolicy,
          autoActionPolicy: policy.autoActionPolicy,
          deliveryPolicy: policy.deliveryPolicy
        },
        null,
        2
      )
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
          项目级 priority / auto-action / delivery 策略
        </p>
      </div>

      <FormField
        label="Policy JSON"
        htmlFor="governance-policy-json"
        error={form.formState.errors.policyJson?.message}
      >
        <Textarea
          id="governance-policy-json"
          rows={14}
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
