import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import {
  GovernanceAutoActionEligibility,
  GovernanceChangeUnitStatus,
  GovernanceExecutionMode,
  GovernanceFindingStatus,
  type GovernancePolicy,
  GovernancePriority,
  GovernanceResolutionType,
  GovernanceReviewDecisionType,
  GovernanceReviewSubjectType,
  GovernanceSeverity,
  type GovernanceIssueDetail,
  GovernanceIssueStatus
} from '@agent-workbench/shared';

import { toApiRequestError } from '@/api/client';
import { EmptyState } from '@/components/app/EmptyState';
import { FormField } from '@/components/app/FormField';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  GovernanceChangeUnitExecutionCard,
  getGovernancePolicyAssessment,
  GovernanceIssueStatusNotice
} from '@/features/governance/components/governance-issue-detail.support';
import {
  useGovernanceResolutionDecisionMutation,
  useGovernanceRetryPlanningMutation,
  useGovernanceReviewDecisionMutation
} from '@/features/governance/hooks/use-governance-mutations';
import { buildProjectGovernancePath } from '@/types/projects';

const resolutionFormSchema = z
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

const assessmentOverrideFormSchema = z
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

const findingDismissFormSchema = z.object({
  reviewer: z.string().trim().min(1, '请输入 reviewer'),
  findingId: z.string().trim().min(1, '请选择 finding'),
  comment: z.string().optional()
});

const changePlanReviewFormSchema = z.object({
  reviewer: z.string().trim().min(1, '请输入 reviewer'),
  comment: z.string().optional()
});

const changeUnitReviewFormSchema = z.object({
  reviewer: z.string().trim().min(1, '请输入 reviewer'),
  changeUnitId: z.string().trim().min(1, '请选择 Change Unit'),
  comment: z.string().optional()
});

const deliveryReviewFormSchema = z.object({
  reviewer: z.string().trim().min(1, '请输入 reviewer'),
  comment: z.string().optional()
});

type ResolutionFormValues = z.infer<typeof resolutionFormSchema>;
type AssessmentOverrideFormInput = z.input<typeof assessmentOverrideFormSchema>;
type AssessmentOverrideFormValues = z.output<
  typeof assessmentOverrideFormSchema
>;
type FindingDismissFormValues = z.infer<typeof findingDismissFormSchema>;
type ChangePlanReviewFormValues = z.infer<typeof changePlanReviewFormSchema>;
type ChangeUnitReviewFormValues = z.infer<typeof changeUnitReviewFormSchema>;
type DeliveryReviewFormValues = z.infer<typeof deliveryReviewFormSchema>;

type GovernanceIssueDetailProps = {
  scopeId: string;
  issueId: string;
  issue: GovernanceIssueDetail | undefined;
  isLoading: boolean;
  policy?: GovernancePolicy;
  selectedStatus?: GovernanceIssueStatus;
};

export function GovernanceIssueDetail({
  scopeId,
  issueId,
  issue,
  isLoading,
  policy,
  selectedStatus
}: GovernanceIssueDetailProps) {
  const resolutionMutation = useGovernanceResolutionDecisionMutation(
    issueId,
    scopeId,
    selectedStatus
  );
  const reviewMutation = useGovernanceReviewDecisionMutation(
    scopeId,
    issueId,
    selectedStatus
  );
  const retryPlanningMutation = useGovernanceRetryPlanningMutation(
    scopeId,
    issueId
  );
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [changePlanError, setChangePlanError] = useState<string | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [changeUnitError, setChangeUnitError] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  const resolutionForm = useForm<ResolutionFormValues>({
    resolver: zodResolver(resolutionFormSchema),
    defaultValues: {
      resolution: GovernanceResolutionType.Fix,
      reason: '',
      deferUntil: '',
      primaryIssueId: ''
    }
  });
  const assessmentOverrideForm = useForm<
    AssessmentOverrideFormInput,
    unknown,
    AssessmentOverrideFormValues
  >({
    resolver: zodResolver(assessmentOverrideFormSchema),
    defaultValues: {
      reviewer: '',
      comment: ''
    }
  });
  const findingDismissForm = useForm<FindingDismissFormValues>({
    resolver: zodResolver(findingDismissFormSchema),
    defaultValues: {
      reviewer: '',
      findingId: '',
      comment: ''
    }
  });
  const changePlanReviewForm = useForm<ChangePlanReviewFormValues>({
    resolver: zodResolver(changePlanReviewFormSchema),
    defaultValues: {
      reviewer: '',
      comment: ''
    }
  });
  const changeUnitReviewForm = useForm<ChangeUnitReviewFormValues>({
    resolver: zodResolver(changeUnitReviewFormSchema),
    defaultValues: {
      reviewer: '',
      changeUnitId: '',
      comment: ''
    }
  });
  const deliveryReviewForm = useForm<DeliveryReviewFormValues>({
    resolver: zodResolver(deliveryReviewFormSchema),
    defaultValues: {
      reviewer: '',
      comment: ''
    }
  });

  const resolution = resolutionForm.watch('resolution');
  const pendingFindings = useMemo(
    () =>
      issue?.relatedFindings.filter(
        (finding) => finding.status === GovernanceFindingStatus.Pending
      ) ??
      [],
    [issue?.relatedFindings]
  );
  const actionableChangeUnits = useMemo(
    () =>
      issue?.changeUnits.filter((changeUnit) =>
        [
          GovernanceChangeUnitStatus.Ready,
          GovernanceChangeUnitStatus.VerificationFailed,
          GovernanceChangeUnitStatus.Exhausted,
          GovernanceChangeUnitStatus.Verified
        ].includes(changeUnit.status)
      ) ?? [],
    [issue?.changeUnits]
  );
  const selectedChangeUnitId = changeUnitReviewForm.watch('changeUnitId');
  const selectedChangeUnit =
    actionableChangeUnits.find((changeUnit) => changeUnit.id === selectedChangeUnitId) ??
    actionableChangeUnits[0] ??
    null;
  const isSelectedChangeUnitManualReady =
    selectedChangeUnit?.status === GovernanceChangeUnitStatus.Ready &&
    selectedChangeUnit.executionMode === GovernanceExecutionMode.Manual;
  const policyDerivedAssessment = useMemo(() => {
    if (!issue) {
      return null;
    }
    return getGovernancePolicyAssessment({ issue, policy });
  }, [issue, policy]);
  const deliveryCommitMode = policy?.deliveryPolicy.commitMode ?? null;

  useEffect(() => {
    setResolutionError(null);
    setAssessmentError(null);
    setDismissError(null);
    setChangePlanError(null);
    setPlanningError(null);
    setChangeUnitError(null);
    setDeliveryError(null);
    resolutionForm.reset({
      resolution: GovernanceResolutionType.Fix,
      reason: '',
      deferUntil: '',
      primaryIssueId: ''
    });
    assessmentOverrideForm.reset({
      reviewer: '',
      severity: undefined,
      priority: undefined,
      autoActionEligibility: undefined,
      comment: ''
    });
    findingDismissForm.reset({
      reviewer: '',
      findingId: pendingFindings[0]?.id ?? '',
      comment: ''
    });
    changePlanReviewForm.reset({
      reviewer: '',
      comment: ''
    });
    changeUnitReviewForm.reset({
      reviewer: '',
      changeUnitId: actionableChangeUnits[0]?.id ?? '',
      comment: ''
    });
    deliveryReviewForm.reset({
      reviewer: '',
      comment: ''
    });
  }, [
    assessmentOverrideForm,
    actionableChangeUnits,
    changePlanReviewForm,
    changeUnitReviewForm,
    deliveryReviewForm,
    findingDismissForm,
    pendingFindings,
    resolutionForm,
    issue?.id
  ]);

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (!issue) {
    return (
      <EmptyState
        title="选择一个 Issue"
        description="从左侧 backlog 选择 Issue 后，这里会展示评估、方案和审批动作。"
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <SurfaceCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge>{issue.status}</Badge>
                <Badge variant="outline">{issue.kind}</Badge>
                {issue.spinOffOfIssueId ? (
                  <Badge variant="secondary">spin-off</Badge>
                ) : null}
                {issue.latestAssessment ? (
                  <>
                    <Badge variant="secondary">
                      {issue.latestAssessment.priority}
                    </Badge>
                    <Badge variant="outline">
                      {issue.latestAssessment.severity}
                    </Badge>
                  </>
                ) : null}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {issue.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {issue.statement}
                </p>
              </div>
            </div>
          </div>

          <GovernanceIssueStatusNotice issue={issue} />

          <div className="grid gap-4 md:grid-cols-2">
            <InfoBlock label="Impact Summary" value={issue.impactSummary} />
            <InfoBlock
              label="Latest Resolution"
              value={
                issue.latestResolutionDecision
                  ? `${issue.latestResolutionDecision.resolution} · ${issue.latestResolutionDecision.reason}`
                  : '尚未决策'
              }
            />
            <InfoBlock
              label="Categories"
              value={issue.categories.join(', ') || '未分类'}
            />
            <InfoBlock
              label="Targets"
              value={
                issue.affectedTargets.map((target) => target.ref).join(', ') ||
                '无'
              }
            />
            {policyDerivedAssessment ? (
              <InfoBlock
                label="Policy"
                value={`priority ${policyDerivedAssessment.priority} · eligibility ${policyDerivedAssessment.autoActionEligibility} · commit ${deliveryCommitMode ?? 'n/a'}`}
              />
            ) : null}
            {issue.spinOffOfIssueId ? (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Spin-off Source
                </p>
                <Link
                  className="mt-2 inline-flex text-sm font-medium text-primary"
                  to={buildProjectGovernancePath(scopeId, issue.spinOffOfIssueId)}
                >
                  {issue.spinOffOfIssueId}
                </Link>
              </div>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Execution & Delivery
            </h3>
            <p className="text-sm text-muted-foreground">
              查看 change unit 执行状态、最近验证结果，以及最终交付审批。
              {deliveryCommitMode ? ` 当前 commit mode: ${deliveryCommitMode}。` : ''}
            </p>
          </div>

          <div className="space-y-3">
            {issue.changeUnits.length > 0 ? (
              issue.changeUnits.map((changeUnit) => (
                <GovernanceChangeUnitExecutionCard
                  key={changeUnit.id}
                  changeUnit={changeUnit}
                  issue={issue}
                  policy={policy}
                />
              ))
            ) : (
              <EmptyState
                size="compact"
                title="暂无 Change Unit"
                description="当前 issue 还没有可执行的变更单元。"
              />
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Change Unit Review
                </p>
                <p className="text-xs text-muted-foreground">
                  对 ready/manual、verification_failed、exhausted、verified 的单元执行继续、重试或提交。
                </p>
              </div>

              {actionableChangeUnits.length > 0 ? (
                <>
                  <FormField
                    label="Reviewer"
                    htmlFor="governance-change-unit-reviewer"
                    error={changeUnitReviewForm.formState.errors.reviewer?.message}
                  >
                    <Input
                      id="governance-change-unit-reviewer"
                      placeholder="reviewer-1"
                      {...changeUnitReviewForm.register('reviewer')}
                    />
                  </FormField>

                  <FormField
                    label="Change Unit"
                    htmlFor="governance-change-unit-select"
                    error={changeUnitReviewForm.formState.errors.changeUnitId?.message}
                  >
                    <NativeSelect
                      id="governance-change-unit-select"
                      {...changeUnitReviewForm.register('changeUnitId')}
                    >
                      <option value="">请选择</option>
                      {actionableChangeUnits.map((changeUnit) => (
                        <option key={changeUnit.id} value={changeUnit.id}>
                          {changeUnit.title} · {changeUnit.status}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>

                  <FormField
                    label="Comment"
                    htmlFor="governance-change-unit-comment"
                  >
                    <Textarea
                      id="governance-change-unit-comment"
                      rows={3}
                      {...changeUnitReviewForm.register('comment')}
                    />
                  </FormField>

                  {changeUnitError ? (
                    <p className="text-sm text-destructive">{changeUnitError}</p>
                  ) : null}

                  {isSelectedChangeUnitManualReady ? (
                    <p className="text-xs text-muted-foreground">
                      这个单元已被 policy 降级为 manual。先在工作区完成修改，再使用
                      Edit &amp; Continue 触发验证。
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {selectedChangeUnit?.status === GovernanceChangeUnitStatus.Verified ? (
                      <Button
                        type="button"
                        onClick={() =>
                          void submitChangeUnitReview({
                            issue,
                            reviewMutation,
                            form: changeUnitReviewForm,
                            decision: GovernanceReviewDecisionType.Approved,
                            setChangeUnitError
                          })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        Approve Unit
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void submitChangeUnitReview({
                          issue,
                          reviewMutation,
                          form: changeUnitReviewForm,
                          decision: GovernanceReviewDecisionType.EditAndContinue,
                          setChangeUnitError
                        })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      Edit & Continue
                    </Button>
                    {selectedChangeUnit &&
                    [
                      GovernanceChangeUnitStatus.VerificationFailed,
                      GovernanceChangeUnitStatus.Exhausted
                    ].includes(selectedChangeUnit.status) ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void submitChangeUnitReview({
                            issue,
                            reviewMutation,
                            form: changeUnitReviewForm,
                            decision: GovernanceReviewDecisionType.Retry,
                            setChangeUnitError
                          })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        Retry
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void submitChangeUnitReview({
                          issue,
                          reviewMutation,
                          form: changeUnitReviewForm,
                          decision: GovernanceReviewDecisionType.Skip,
                          setChangeUnitError
                        })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      Skip
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState
                  size="compact"
                  title="当前没有可审核的 Change Unit"
                  description="等待执行完成或人工重试后，这里会出现可操作单元。"
                />
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Delivery Artifact
                </p>
                <p className="text-xs text-muted-foreground">
                  当所有活跃单元提交完成后，系统会生成 review request。
                </p>
              </div>

              {issue.deliveryArtifact ? (
                <>
                  <div className="space-y-2">
                    <Badge variant="outline">{issue.deliveryArtifact.status}</Badge>
                    <p className="text-sm font-medium text-foreground">
                      {issue.deliveryArtifact.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      linked units: {issue.deliveryArtifact.linkedChangeUnitIds.length} ·
                      linked results: {issue.deliveryArtifact.linkedVerificationResultIds.length}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {issue.deliveryArtifact.body}
                    </p>
                  </div>

                  <FormField
                    label="Reviewer"
                    htmlFor="governance-delivery-reviewer"
                    error={deliveryReviewForm.formState.errors.reviewer?.message}
                  >
                    <Input
                      id="governance-delivery-reviewer"
                      placeholder="lead-1"
                      {...deliveryReviewForm.register('reviewer')}
                    />
                  </FormField>

                  <FormField
                    label="Comment"
                    htmlFor="governance-delivery-comment"
                  >
                    <Textarea
                      id="governance-delivery-comment"
                      rows={3}
                      {...deliveryReviewForm.register('comment')}
                    />
                  </FormField>

                  {deliveryError ? (
                    <p className="text-sm text-destructive">{deliveryError}</p>
                  ) : null}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        void submitDeliveryReview({
                          issue,
                          reviewMutation,
                          form: deliveryReviewForm,
                          decision: GovernanceReviewDecisionType.Approved,
                          setDeliveryError
                        })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      Approve Delivery
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void submitDeliveryReview({
                          issue,
                          reviewMutation,
                          form: deliveryReviewForm,
                          decision: GovernanceReviewDecisionType.Rejected,
                          setDeliveryError
                        })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      Reject Delivery
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState
                  size="compact"
                  title="尚未生成 Delivery Artifact"
                  description="当活跃 change unit 全部提交后，这里会出现交付审批卡片。"
                />
              )}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Automation</h3>
            <p className="text-sm text-muted-foreground">
              查看 planning worker 的最近执行状态，并在需要时重试。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoBlock
              label="Planning Status"
              value={
                issue.latestPlanningAttempt
                  ? `attempt #${issue.latestPlanningAttempt.attemptNo} · ${issue.latestPlanningAttempt.status}`
                  : '尚未开始'
              }
            />
            <InfoBlock
              label="Planning Session"
              value={issue.latestPlanningAttempt?.sessionId ?? '无'}
            />
          </div>

          {issue.latestPlanningAttempt?.failureMessage ? (
            <p className="text-sm text-muted-foreground">
              {issue.latestPlanningAttempt.failureMessage}
            </p>
          ) : null}

          {planningError ? (
            <p className="text-sm text-destructive">{planningError}</p>
          ) : null}

          {issue.latestPlanningAttempt?.status === 'needs_human_review' ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={retryPlanningMutation.isPending}
                onClick={() => {
                  setPlanningError(null);
                  void retryPlanningMutation.mutateAsync().catch((error) => {
                    setPlanningError(toApiRequestError(error).message);
                  });
                }}
              >
                Retry Planning
              </Button>
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Resolution</h3>
            <p className="text-sm text-muted-foreground">
              决定这个 Issue 当前是修、延期、接受风险还是标记重复。
            </p>
          </div>

          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={resolutionForm.handleSubmit(async (values) => {
              setResolutionError(null);
              try {
                await resolutionMutation.mutateAsync({
                  resolution: values.resolution,
                  reason: values.reason,
                  ...(values.deferUntil?.trim()
                    ? { deferUntil: values.deferUntil.trim() }
                    : {}),
                  ...(values.primaryIssueId?.trim()
                    ? { primaryIssueId: values.primaryIssueId.trim() }
                    : {})
                });
                resolutionForm.reset({
                  resolution: values.resolution,
                  reason: '',
                  deferUntil: '',
                  primaryIssueId: ''
                });
              } catch (error) {
                setResolutionError(toApiRequestError(error).message);
              }
            })}
          >
            <FormField
              label="Resolution"
              htmlFor="governance-resolution"
              error={resolutionForm.formState.errors.resolution?.message}
            >
              <NativeSelect
                id="governance-resolution"
                {...resolutionForm.register('resolution')}
              >
                {Object.values(GovernanceResolutionType).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField
              label="Reason"
              htmlFor="governance-resolution-reason"
              error={resolutionForm.formState.errors.reason?.message}
            >
              <Input
                id="governance-resolution-reason"
                placeholder="说明决策原因"
                {...resolutionForm.register('reason')}
              />
            </FormField>

            {resolution === GovernanceResolutionType.Defer ? (
              <FormField
                label="Defer Until"
                htmlFor="governance-defer-until"
                error={resolutionForm.formState.errors.deferUntil?.message}
              >
                <Input
                  id="governance-defer-until"
                  placeholder="2026-05-01T00:00:00.000Z"
                  {...resolutionForm.register('deferUntil')}
                />
              </FormField>
            ) : null}

            {resolution === GovernanceResolutionType.Duplicate ? (
              <FormField
                label="Primary Issue ID"
                htmlFor="governance-primary-issue-id"
                error={resolutionForm.formState.errors.primaryIssueId?.message}
              >
                <Input
                  id="governance-primary-issue-id"
                  placeholder="issue_xxx"
                  {...resolutionForm.register('primaryIssueId')}
                />
              </FormField>
            ) : null}

            {resolutionError ? (
              <p className="md:col-span-2 text-sm text-destructive">
                {resolutionError}
              </p>
            ) : null}

            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={resolutionMutation.isPending}>
                提交 Resolution
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Assessment Override
            </h3>
            <p className="text-sm text-muted-foreground">
              仅覆盖评估结论，不改变原始 issue 描述。
            </p>
          </div>

          {issue.latestAssessment ? (
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={assessmentOverrideForm.handleSubmit(async (values) => {
                setAssessmentError(null);
                try {
                  await reviewMutation.mutateAsync({
                    subjectType: GovernanceReviewSubjectType.Assessment,
                    subjectId: issue.latestAssessment!.id,
                    decision: GovernanceReviewDecisionType.Approved,
                    reviewer: values.reviewer,
                    ...(values.comment?.trim()
                      ? { comment: values.comment.trim() }
                      : {}),
                    assessmentOverride: {
                      ...(values.severity ? { severity: values.severity } : {}),
                      ...(values.priority ? { priority: values.priority } : {}),
                      ...(values.autoActionEligibility
                        ? {
                            autoActionEligibility:
                              values.autoActionEligibility
                          }
                        : {})
                    }
                  });
                  assessmentOverrideForm.reset({
                    reviewer: values.reviewer,
                    severity: undefined,
                    priority: undefined,
                    autoActionEligibility: undefined,
                    comment: ''
                  });
                } catch (error) {
                  setAssessmentError(toApiRequestError(error).message);
                }
              })}
            >
              <FormField
                label="Reviewer"
                htmlFor="governance-assessment-reviewer"
                error={assessmentOverrideForm.formState.errors.reviewer?.message}
              >
                <Input
                  id="governance-assessment-reviewer"
                  placeholder="architect-1"
                  {...assessmentOverrideForm.register('reviewer')}
                />
              </FormField>

              <FormField
                label="Severity Override"
                htmlFor="governance-assessment-severity"
                error={assessmentOverrideForm.formState.errors.severity?.message}
              >
                <NativeSelect
                  id="governance-assessment-severity"
                  {...assessmentOverrideForm.register('severity')}
                >
                  <option value="">保持不变</option>
                  {Object.values(GovernanceSeverity).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>

              <FormField
                label="Priority Override"
                htmlFor="governance-assessment-priority"
                error={assessmentOverrideForm.formState.errors.priority?.message}
              >
                <NativeSelect
                  id="governance-assessment-priority"
                  {...assessmentOverrideForm.register('priority')}
                >
                  <option value="">保持不变</option>
                  {Object.values(GovernancePriority).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>

              <FormField
                label="Auto Action Eligibility"
                htmlFor="governance-assessment-eligibility"
                error={
                  assessmentOverrideForm.formState.errors.autoActionEligibility
                    ?.message
                }
              >
                <NativeSelect
                  id="governance-assessment-eligibility"
                  {...assessmentOverrideForm.register('autoActionEligibility')}
                >
                  <option value="">保持不变</option>
                  {Object.values(GovernanceAutoActionEligibility).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    )
                  )}
                </NativeSelect>
              </FormField>

              <FormField
                label="Comment"
                htmlFor="governance-assessment-comment"
                error={assessmentOverrideForm.formState.errors.root?.message}
              >
                <Textarea
                  id="governance-assessment-comment"
                  rows={3}
                  placeholder="补充说明"
                  {...assessmentOverrideForm.register('comment')}
                />
              </FormField>

              {assessmentError ? (
                <p className="md:col-span-2 text-sm text-destructive">
                  {assessmentError}
                </p>
              ) : null}

              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={reviewMutation.isPending}>
                  提交 Override
                </Button>
              </div>
            </form>
          ) : (
            <EmptyState
              size="compact"
              title="暂无 Assessment"
              description="当前 Issue 还没有评估结果。"
            />
          )}
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Review Actions
            </h3>
            <p className="text-sm text-muted-foreground">
              这里处理 finding dismiss 和 change plan 审批。
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Dismiss Finding
                </p>
                <p className="text-xs text-muted-foreground">
                  将误报 finding 从归一化流程中移除。
                </p>
              </div>

              {pendingFindings.length > 0 ? (
                <form
                  className="space-y-4"
                  onSubmit={findingDismissForm.handleSubmit(async (values) => {
                    setDismissError(null);
                    try {
                      await reviewMutation.mutateAsync({
                        subjectType: GovernanceReviewSubjectType.Finding,
                        subjectId: values.findingId,
                        decision: GovernanceReviewDecisionType.Dismissed,
                        reviewer: values.reviewer,
                        ...(values.comment?.trim()
                          ? { comment: values.comment.trim() }
                          : {})
                      });
                      findingDismissForm.reset({
                        reviewer: values.reviewer,
                        findingId: '',
                        comment: ''
                      });
                    } catch (error) {
                      setDismissError(toApiRequestError(error).message);
                    }
                  })}
                >
                  <FormField
                    label="Reviewer"
                    htmlFor="governance-finding-reviewer"
                    error={findingDismissForm.formState.errors.reviewer?.message}
                  >
                    <Input
                      id="governance-finding-reviewer"
                      placeholder="reviewer-1"
                      {...findingDismissForm.register('reviewer')}
                    />
                  </FormField>

                  <FormField
                    label="Finding"
                    htmlFor="governance-finding-select"
                    error={findingDismissForm.formState.errors.findingId?.message}
                  >
                    <NativeSelect
                      id="governance-finding-select"
                      {...findingDismissForm.register('findingId')}
                    >
                      <option value="">请选择</option>
                      {pendingFindings.map((finding) => (
                        <option key={finding.id} value={finding.id}>
                          {finding.title}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>

                  <FormField
                    label="Comment"
                    htmlFor="governance-finding-comment"
                  >
                    <Textarea
                      id="governance-finding-comment"
                      rows={3}
                      {...findingDismissForm.register('comment')}
                    />
                  </FormField>

                  {dismissError ? (
                    <p className="text-sm text-destructive">{dismissError}</p>
                  ) : null}

                  <div className="flex justify-end">
                    <Button type="submit" disabled={reviewMutation.isPending}>
                      Dismiss Finding
                    </Button>
                  </div>
                </form>
              ) : (
                <EmptyState
                  size="compact"
                  title="没有可 dismiss 的 Finding"
                  description="相关 finding 已处理或当前 issue 没有关联 finding。"
                />
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Change Plan Review
                </p>
                <p className="text-xs text-muted-foreground">
                  审批最新变更方案，驱动 issue 进入 planned 或退回 open。
                </p>
              </div>

              {issue.changePlan ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Badge variant="outline">{issue.changePlan.status}</Badge>
                    {issue.latestPlanningAttempt ? (
                      <Badge variant="secondary">
                        from attempt #{issue.latestPlanningAttempt.attemptNo}
                      </Badge>
                    ) : null}
                    <p className="text-sm font-medium text-foreground">
                      {issue.changePlan.objective}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {issue.changePlan.strategy}
                    </p>
                  </div>

                  <FormField
                    label="Reviewer"
                    htmlFor="governance-change-plan-reviewer"
                    error={changePlanReviewForm.formState.errors.reviewer?.message}
                  >
                    <Input
                      id="governance-change-plan-reviewer"
                      placeholder="lead-1"
                      {...changePlanReviewForm.register('reviewer')}
                    />
                  </FormField>

                  <FormField
                    label="Comment"
                    htmlFor="governance-change-plan-comment"
                  >
                    <Textarea
                      id="governance-change-plan-comment"
                      rows={3}
                      {...changePlanReviewForm.register('comment')}
                    />
                  </FormField>

                  {changePlanError ? (
                    <p className="text-sm text-destructive">{changePlanError}</p>
                  ) : null}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        void submitChangePlanReview({
                          issue,
                          reviewMutation,
                          form: changePlanReviewForm,
                          decision: GovernanceReviewDecisionType.Approved,
                          setChangePlanError
                        })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      Approve Plan
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void submitChangePlanReview({
                          issue,
                          reviewMutation,
                          form: changePlanReviewForm,
                          decision: GovernanceReviewDecisionType.Rejected,
                          setChangePlanError
                        })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      Reject Plan
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  size="compact"
                  title="暂无 Change Plan"
                  description="当前 Issue 还没有进入规划阶段。"
                />
              )}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Related Findings
            </h3>
          </div>
          <div className="space-y-3">
            {issue.relatedFindings.length > 0 ? (
              issue.relatedFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="rounded-2xl border border-border/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {finding.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {finding.summary}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{finding.status}</Badge>
                      {finding.latestTriageAttempt ? (
                        <Badge variant="secondary">
                          triage:{finding.latestTriageAttempt.status}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {finding.latestTriageAttempt?.failureMessage ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {finding.latestTriageAttempt.failureMessage}
                    </p>
                  ) : null}
                  {finding.latestTriageAttempt?.sessionId ? (
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                      session: {finding.latestTriageAttempt.sessionId}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                size="compact"
                title="暂无关联 Findings"
                description="这个 Issue 目前没有关联的原始发现项。"
              />
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}

async function submitChangePlanReview(input: {
  issue: GovernanceIssueDetail;
  reviewMutation: {
    mutateAsync: (
      payload: {
        subjectType: GovernanceReviewSubjectType.ChangePlan;
        subjectId: string;
        decision:
          | GovernanceReviewDecisionType.Approved
          | GovernanceReviewDecisionType.Rejected;
        reviewer: string;
        comment?: string;
      }
    ) => Promise<unknown>;
  };
  form: UseFormReturn<ChangePlanReviewFormValues>;
  decision:
    | GovernanceReviewDecisionType.Approved
    | GovernanceReviewDecisionType.Rejected;
  setChangePlanError: (value: string | null) => void;
}) {
  const isValid = await input.form.trigger('reviewer');
  if (!isValid || !input.issue.changePlan) {
    return;
  }

  input.setChangePlanError(null);
  const values = input.form.getValues();

  try {
    await input.reviewMutation.mutateAsync({
      subjectType: GovernanceReviewSubjectType.ChangePlan,
      subjectId: input.issue.changePlan.id,
      decision: input.decision,
      reviewer: values.reviewer,
      ...(values.comment?.trim() ? { comment: values.comment.trim() } : {})
    });
    input.form.reset({
      reviewer: values.reviewer,
      comment: ''
    });
  } catch (error) {
    input.setChangePlanError(toApiRequestError(error).message);
  }
}

async function submitChangeUnitReview(input: {
  issue: GovernanceIssueDetail;
  reviewMutation: {
    mutateAsync: (payload: {
      subjectType: GovernanceReviewSubjectType.ChangeUnit;
      subjectId: string;
      decision:
        | GovernanceReviewDecisionType.Approved
        | GovernanceReviewDecisionType.EditAndContinue
        | GovernanceReviewDecisionType.Retry
        | GovernanceReviewDecisionType.Skip;
      reviewer: string;
      comment?: string;
    }) => Promise<unknown>;
  };
  form: UseFormReturn<ChangeUnitReviewFormValues>;
  decision:
    | GovernanceReviewDecisionType.Approved
    | GovernanceReviewDecisionType.EditAndContinue
    | GovernanceReviewDecisionType.Retry
    | GovernanceReviewDecisionType.Skip;
  setChangeUnitError: (value: string | null) => void;
}) {
  const isValid = await input.form.trigger(['reviewer', 'changeUnitId']);
  if (!isValid) {
    return;
  }

  input.setChangeUnitError(null);
  const values = input.form.getValues();

  try {
    await input.reviewMutation.mutateAsync({
      subjectType: GovernanceReviewSubjectType.ChangeUnit,
      subjectId: values.changeUnitId,
      decision: input.decision,
      reviewer: values.reviewer,
      ...(values.comment?.trim() ? { comment: values.comment.trim() } : {})
    });
    input.form.reset({
      reviewer: values.reviewer,
      changeUnitId: values.changeUnitId,
      comment: ''
    });
  } catch (error) {
    input.setChangeUnitError(toApiRequestError(error).message);
  }
}

async function submitDeliveryReview(input: {
  issue: GovernanceIssueDetail;
  reviewMutation: {
    mutateAsync: (payload: {
      subjectType: GovernanceReviewSubjectType.DeliveryArtifact;
      subjectId: string;
      decision:
        | GovernanceReviewDecisionType.Approved
        | GovernanceReviewDecisionType.Rejected;
      reviewer: string;
      comment?: string;
    }) => Promise<unknown>;
  };
  form: UseFormReturn<DeliveryReviewFormValues>;
  decision:
    | GovernanceReviewDecisionType.Approved
    | GovernanceReviewDecisionType.Rejected;
  setDeliveryError: (value: string | null) => void;
}) {
  const isValid = await input.form.trigger('reviewer');
  if (!isValid || !input.issue.deliveryArtifact) {
    return;
  }

  input.setDeliveryError(null);
  const values = input.form.getValues();

  try {
    await input.reviewMutation.mutateAsync({
      subjectType: GovernanceReviewSubjectType.DeliveryArtifact,
      subjectId: input.issue.deliveryArtifact.id,
      decision: input.decision,
      reviewer: values.reviewer,
      ...(values.comment?.trim() ? { comment: values.comment.trim() } : {})
    });
    input.form.reset({
      reviewer: values.reviewer,
      comment: ''
    });
  } catch (error) {
    input.setDeliveryError(toApiRequestError(error).message);
  }
}
