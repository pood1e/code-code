import { z } from 'zod';
import {
  GovernanceAutoActionEligibility,
  GovernancePriority,
  GovernanceResolutionType,
  GovernanceSeverity
} from '@agent-workbench/shared';

export const resolutionFormSchema = z
  .object({
    resolution: z.nativeEnum(GovernanceResolutionType),
    reason: z.string().trim().min(1, '请输入处理原因'),
    deferUntil: z.string().optional(),
    primaryIssueId: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (
      value.resolution === GovernanceResolutionType.Duplicate &&
      !value.primaryIssueId?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryIssueId'],
        message: 'duplicate 需要填写主 issue ID'
      });
    }
  });

const emptyStringToUndefined = <TSchema extends z.ZodTypeAny>(schema: TSchema) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    schema.optional()
  );

export const assessmentOverrideFormSchema = z
  .object({
    reviewer: z.string().trim().min(1, '请输入 reviewer'),
    severity: emptyStringToUndefined(z.nativeEnum(GovernanceSeverity)),
    priority: emptyStringToUndefined(z.nativeEnum(GovernancePriority)),
    autoActionEligibility: emptyStringToUndefined(
      z.nativeEnum(GovernanceAutoActionEligibility)
    ),
    comment: z.string().optional()
  })
  .refine(
    (value) =>
      Boolean(
        value.severity || value.priority || value.autoActionEligibility
      ),
    '至少覆盖一个 assessment 字段'
  );

export const findingDismissFormSchema = z.object({
  reviewer: z.string().trim().min(1, '请输入 reviewer'),
  findingId: z.string().trim().min(1, '请选择 finding'),
  comment: z.string().optional()
});

export const changePlanReviewFormSchema = z.object({
  reviewer: z.string().trim().min(1, '请输入 reviewer'),
  comment: z.string().optional()
});

export const changeUnitReviewFormSchema = z.object({
  reviewer: z.string().trim().min(1, '请输入 reviewer'),
  changeUnitId: z.string().trim().min(1, '请选择 Change Unit'),
  comment: z.string().optional()
});

export const deliveryReviewFormSchema = z.object({
  reviewer: z.string().trim().min(1, '请输入 reviewer'),
  comment: z.string().optional()
});

export type ResolutionFormValues = z.infer<typeof resolutionFormSchema>;
export type AssessmentOverrideFormInput = z.input<
  typeof assessmentOverrideFormSchema
>;
export type AssessmentOverrideFormValues = z.output<
  typeof assessmentOverrideFormSchema
>;
export type FindingDismissFormValues = z.infer<typeof findingDismissFormSchema>;
export type ChangePlanReviewFormValues = z.infer<typeof changePlanReviewFormSchema>;
export type ChangeUnitReviewFormValues = z.infer<typeof changeUnitReviewFormSchema>;
export type DeliveryReviewFormValues = z.infer<typeof deliveryReviewFormSchema>;
