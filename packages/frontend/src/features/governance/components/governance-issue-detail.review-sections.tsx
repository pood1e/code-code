import type { UseFormReturn } from 'react-hook-form';
import {
  GovernanceAutoActionEligibility,
  GovernancePriority,
  GovernanceResolutionType,
  GovernanceReviewDecisionType,
  GovernanceReviewSubjectType,
  GovernanceSeverity,
  type CreateResolutionDecisionInput,
  type CreateReviewDecisionInput,
  type GovernanceIssueDetail
} from '@agent-workbench/shared';

import { toApiRequestError } from '@/api/client';
import { EmptyState } from '@/components/app/EmptyState';
import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

import { submitChangePlanReview } from './governance-issue-detail.actions';
import type {
  AssessmentOverrideFormInput,
  AssessmentOverrideFormValues,
  ChangePlanReviewFormValues,
  FindingDismissFormValues,
  ResolutionFormValues
} from './governance-issue-detail.model';

type GovernanceReviewMutation = {
  mutateAsync: (payload: CreateReviewDecisionInput) => Promise<unknown>;
  isPending: boolean;
};

type GovernanceResolutionMutation = {
  mutateAsync: (payload: CreateResolutionDecisionInput) => Promise<unknown>;
  isPending: boolean;
};

type GovernanceResolutionSectionProps = {
  resolutionForm: UseFormReturn<ResolutionFormValues>;
  resolution: GovernanceResolutionType;
  resolutionMutation: GovernanceResolutionMutation;
  resolutionError: string | null;
  setResolutionError: (value: string | null) => void;
};

export function GovernanceResolutionSection(
  props: GovernanceResolutionSectionProps
) {
  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Resolution</h3>
        <p className="text-sm text-muted-foreground">
          决定这个 Issue 当前是修、延期、接受风险还是标记重复。
        </p>
      </div>

      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={props.resolutionForm.handleSubmit(async (values) => {
          props.setResolutionError(null);
          try {
            await props.resolutionMutation.mutateAsync({
              resolution: values.resolution,
              reason: values.reason,
              ...(values.deferUntil?.trim()
                ? { deferUntil: values.deferUntil.trim() }
                : {}),
              ...(values.primaryIssueId?.trim()
                ? { primaryIssueId: values.primaryIssueId.trim() }
                : {})
            });
            props.resolutionForm.reset({
              resolution: values.resolution,
              reason: '',
              deferUntil: '',
              primaryIssueId: ''
            });
          } catch (error) {
            props.setResolutionError(toApiRequestError(error).message);
          }
        })}
      >
        <FormField
          label="Resolution"
          htmlFor="governance-resolution"
          error={props.resolutionForm.formState.errors.resolution?.message}
        >
          <NativeSelect
            id="governance-resolution"
            {...props.resolutionForm.register('resolution')}
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
          error={props.resolutionForm.formState.errors.reason?.message}
        >
          <Input
            id="governance-resolution-reason"
            placeholder="说明决策原因"
            {...props.resolutionForm.register('reason')}
          />
        </FormField>

        {props.resolution === GovernanceResolutionType.Defer ? (
          <FormField
            label="Defer Until"
            htmlFor="governance-defer-until"
            error={props.resolutionForm.formState.errors.deferUntil?.message}
          >
            <Input
              id="governance-defer-until"
              placeholder="2026-05-01T00:00:00.000Z"
              {...props.resolutionForm.register('deferUntil')}
            />
          </FormField>
        ) : null}

        {props.resolution === GovernanceResolutionType.Duplicate ? (
          <FormField
            label="Primary Issue ID"
            htmlFor="governance-primary-issue-id"
            error={props.resolutionForm.formState.errors.primaryIssueId?.message}
          >
            <Input
              id="governance-primary-issue-id"
              placeholder="issue_xxx"
              {...props.resolutionForm.register('primaryIssueId')}
            />
          </FormField>
        ) : null}

        {props.resolutionError ? (
          <p className="md:col-span-2 text-sm text-destructive">
            {props.resolutionError}
          </p>
        ) : null}

        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={props.resolutionMutation.isPending}>
            提交 Resolution
          </Button>
        </div>
      </form>
    </SurfaceCard>
  );
}

type GovernanceAssessmentOverrideSectionProps = {
  issue: GovernanceIssueDetail;
  reviewMutation: GovernanceReviewMutation;
  assessmentOverrideForm: UseFormReturn<
    AssessmentOverrideFormInput,
    unknown,
    AssessmentOverrideFormValues
  >;
  assessmentError: string | null;
  setAssessmentError: (value: string | null) => void;
};

export function GovernanceAssessmentOverrideSection(
  props: GovernanceAssessmentOverrideSectionProps
) {
  const latestAssessment = props.issue.latestAssessment;

  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Assessment Override
        </h3>
        <p className="text-sm text-muted-foreground">
          仅覆盖评估结论，不改变原始 issue 描述。
        </p>
      </div>

      {latestAssessment ? (
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={props.assessmentOverrideForm.handleSubmit(async (values) => {
            props.setAssessmentError(null);
            try {
              await props.reviewMutation.mutateAsync({
                subjectType: GovernanceReviewSubjectType.Assessment,
                subjectId: latestAssessment.id,
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
                        autoActionEligibility: values.autoActionEligibility
                      }
                    : {})
                }
              });
              props.assessmentOverrideForm.reset({
                reviewer: values.reviewer,
                severity: undefined,
                priority: undefined,
                autoActionEligibility: undefined,
                comment: ''
              });
            } catch (error) {
              props.setAssessmentError(toApiRequestError(error).message);
            }
          })}
        >
          <FormField
            label="Reviewer"
            htmlFor="governance-assessment-reviewer"
            error={props.assessmentOverrideForm.formState.errors.reviewer?.message}
          >
            <Input
              id="governance-assessment-reviewer"
              placeholder="architect-1"
              {...props.assessmentOverrideForm.register('reviewer')}
            />
          </FormField>

          <FormField
            label="Severity Override"
            htmlFor="governance-assessment-severity"
            error={props.assessmentOverrideForm.formState.errors.severity?.message}
          >
            <NativeSelect
              id="governance-assessment-severity"
              {...props.assessmentOverrideForm.register('severity')}
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
            error={props.assessmentOverrideForm.formState.errors.priority?.message}
          >
            <NativeSelect
              id="governance-assessment-priority"
              {...props.assessmentOverrideForm.register('priority')}
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
              props.assessmentOverrideForm.formState.errors.autoActionEligibility
                ?.message
            }
          >
            <NativeSelect
              id="governance-assessment-eligibility"
              {...props.assessmentOverrideForm.register('autoActionEligibility')}
            >
              <option value="">保持不变</option>
              {Object.values(GovernanceAutoActionEligibility).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField
            label="Comment"
            htmlFor="governance-assessment-comment"
            error={props.assessmentOverrideForm.formState.errors.root?.message}
          >
            <Textarea
              id="governance-assessment-comment"
              rows={3}
              placeholder="补充说明"
              {...props.assessmentOverrideForm.register('comment')}
            />
          </FormField>

          {props.assessmentError ? (
            <p className="md:col-span-2 text-sm text-destructive">
              {props.assessmentError}
            </p>
          ) : null}

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={props.reviewMutation.isPending}>
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
  );
}

type GovernanceReviewActionsSectionProps = {
  issue: GovernanceIssueDetail;
  pendingFindings: GovernanceIssueDetail['relatedFindings'];
  reviewMutation: GovernanceReviewMutation;
  findingDismissForm: UseFormReturn<FindingDismissFormValues>;
  changePlanReviewForm: UseFormReturn<ChangePlanReviewFormValues>;
  dismissError: string | null;
  setDismissError: (value: string | null) => void;
  changePlanError: string | null;
  setChangePlanError: (value: string | null) => void;
};

export function GovernanceReviewActionsSection(
  props: GovernanceReviewActionsSectionProps
) {
  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Review Actions</h3>
        <p className="text-sm text-muted-foreground">
          这里处理 finding dismiss 和 change plan 审批。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border/60 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Dismiss Finding</p>
            <p className="text-xs text-muted-foreground">
              将误报 finding 从归一化流程中移除。
            </p>
          </div>

          {props.pendingFindings.length > 0 ? (
            <form
              className="space-y-4"
              onSubmit={props.findingDismissForm.handleSubmit(async (values) => {
                props.setDismissError(null);
                try {
                  await props.reviewMutation.mutateAsync({
                    subjectType: GovernanceReviewSubjectType.Finding,
                    subjectId: values.findingId,
                    decision: GovernanceReviewDecisionType.Dismissed,
                    reviewer: values.reviewer,
                    ...(values.comment?.trim()
                      ? { comment: values.comment.trim() }
                      : {})
                  });
                  props.findingDismissForm.reset({
                    reviewer: values.reviewer,
                    findingId: '',
                    comment: ''
                  });
                } catch (error) {
                  props.setDismissError(toApiRequestError(error).message);
                }
              })}
            >
              <FormField
                label="Reviewer"
                htmlFor="governance-finding-reviewer"
                error={props.findingDismissForm.formState.errors.reviewer?.message}
              >
                <Input
                  id="governance-finding-reviewer"
                  placeholder="reviewer-1"
                  {...props.findingDismissForm.register('reviewer')}
                />
              </FormField>

              <FormField
                label="Finding"
                htmlFor="governance-finding-select"
                error={props.findingDismissForm.formState.errors.findingId?.message}
              >
                <NativeSelect
                  id="governance-finding-select"
                  {...props.findingDismissForm.register('findingId')}
                >
                  <option value="">请选择</option>
                  {props.pendingFindings.map((finding) => (
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
                  {...props.findingDismissForm.register('comment')}
                />
              </FormField>

              {props.dismissError ? (
                <p className="text-sm text-destructive">{props.dismissError}</p>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" disabled={props.reviewMutation.isPending}>
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

          {props.issue.changePlan ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Badge variant="outline">{props.issue.changePlan.status}</Badge>
                {props.issue.latestPlanningAttempt ? (
                  <Badge variant="secondary">
                    from attempt #{props.issue.latestPlanningAttempt.attemptNo}
                  </Badge>
                ) : null}
                <p className="text-sm font-medium text-foreground">
                  {props.issue.changePlan.objective}
                </p>
                <p className="text-sm text-muted-foreground">
                  {props.issue.changePlan.strategy}
                </p>
              </div>

              <FormField
                label="Reviewer"
                htmlFor="governance-change-plan-reviewer"
                error={props.changePlanReviewForm.formState.errors.reviewer?.message}
              >
                <Input
                  id="governance-change-plan-reviewer"
                  placeholder="lead-1"
                  {...props.changePlanReviewForm.register('reviewer')}
                />
              </FormField>

              <FormField
                label="Comment"
                htmlFor="governance-change-plan-comment"
              >
                <Textarea
                  id="governance-change-plan-comment"
                  rows={3}
                  {...props.changePlanReviewForm.register('comment')}
                />
              </FormField>

              {props.changePlanError ? (
                <p className="text-sm text-destructive">{props.changePlanError}</p>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() =>
                    void submitChangePlanReview({
                      issue: props.issue,
                      reviewMutation: props.reviewMutation,
                      form: props.changePlanReviewForm,
                      decision: GovernanceReviewDecisionType.Approved,
                      setChangePlanError: props.setChangePlanError
                    })
                  }
                  disabled={props.reviewMutation.isPending}
                >
                  Approve Plan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void submitChangePlanReview({
                      issue: props.issue,
                      reviewMutation: props.reviewMutation,
                      form: props.changePlanReviewForm,
                      decision: GovernanceReviewDecisionType.Rejected,
                      setChangePlanError: props.setChangePlanError
                    })
                  }
                  disabled={props.reviewMutation.isPending}
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
  );
}
