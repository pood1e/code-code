import type { UseFormReturn } from 'react-hook-form';
import {
  type CreateResolutionDecisionInput,
  type CreateReviewDecisionInput,
  GovernanceAutoActionEligibility,
  GovernanceChangeUnitStatus,
  GovernancePriority,
  GovernanceResolutionType,
  GovernanceReviewDecisionType,
  GovernanceReviewSubjectType,
  GovernanceSeverity,
  type GovernanceIssueDetail,
  type GovernancePolicy
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

import {
  submitChangePlanReview,
  submitChangeUnitReview,
  submitDeliveryReview
} from './governance-issue-detail.actions';
import type {
  AssessmentOverrideFormInput,
  AssessmentOverrideFormValues,
  ChangePlanReviewFormValues,
  ChangeUnitReviewFormValues,
  FindingDismissFormValues,
  ResolutionFormValues,
  DeliveryReviewFormValues
} from './governance-issue-detail.model';
import { GovernanceChangeUnitExecutionCard } from './governance-issue-detail.support';

type GovernanceReviewMutation = {
  mutateAsync: (payload: CreateReviewDecisionInput) => Promise<unknown>;
  isPending: boolean;
};

type GovernanceResolutionMutation = {
  mutateAsync: (payload: CreateResolutionDecisionInput) => Promise<unknown>;
  isPending: boolean;
};

type GovernanceRetryPlanningMutation = {
  mutateAsync: () => Promise<unknown>;
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

      {props.issue.latestAssessment ? (
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={props.assessmentOverrideForm.handleSubmit(async (values) => {
            props.setAssessmentError(null);
            try {
              await props.reviewMutation.mutateAsync({
                subjectType: GovernanceReviewSubjectType.Assessment,
                subjectId: props.issue.latestAssessment!.id,
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

type GovernanceAutomationSectionProps = {
  issue: GovernanceIssueDetail;
  retryPlanningMutation: GovernanceRetryPlanningMutation;
  planningError: string | null;
  setPlanningError: (value: string | null) => void;
};

export function GovernanceAutomationSection(
  props: GovernanceAutomationSectionProps
) {
  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Automation</h3>
        <p className="text-sm text-muted-foreground">
          查看 planning worker 的最近执行状态，并在需要时重试。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GovernanceIssueInfoBlock
          label="Planning Status"
          value={
            props.issue.latestPlanningAttempt
              ? `attempt #${props.issue.latestPlanningAttempt.attemptNo} · ${props.issue.latestPlanningAttempt.status}`
              : '尚未开始'
          }
        />
        <GovernanceIssueInfoBlock
          label="Planning Session"
          value={props.issue.latestPlanningAttempt?.sessionId ?? '无'}
        />
      </div>

      {props.issue.latestPlanningAttempt?.failureMessage ? (
        <p className="text-sm text-muted-foreground">
          {props.issue.latestPlanningAttempt.failureMessage}
        </p>
      ) : null}

      {props.planningError ? (
        <p className="text-sm text-destructive">{props.planningError}</p>
      ) : null}

      {props.issue.latestPlanningAttempt?.status === 'needs_human_review' ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={props.retryPlanningMutation.isPending}
            onClick={() => {
              props.setPlanningError(null);
              void props.retryPlanningMutation.mutateAsync().catch((error) => {
                props.setPlanningError(toApiRequestError(error).message);
              });
            }}
          >
            Retry Planning
          </Button>
        </div>
      ) : null}
    </SurfaceCard>
  );
}

type GovernanceExecutionDeliverySectionProps = {
  issue: GovernanceIssueDetail;
  policy?: GovernancePolicy;
  deliveryCommitMode: string | null;
  reviewMutation: GovernanceReviewMutation;
  actionableChangeUnits: GovernanceIssueDetail['changeUnits'];
  selectedChangeUnit: GovernanceIssueDetail['changeUnits'][number] | null;
  isSelectedChangeUnitManualReady: boolean;
  changeUnitReviewForm: UseFormReturn<ChangeUnitReviewFormValues>;
  deliveryReviewForm: UseFormReturn<DeliveryReviewFormValues>;
  changeUnitError: string | null;
  setChangeUnitError: (value: string | null) => void;
  deliveryError: string | null;
  setDeliveryError: (value: string | null) => void;
};

export function GovernanceExecutionDeliverySection(
  props: GovernanceExecutionDeliverySectionProps
) {
  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Execution & Delivery
        </h3>
        <p className="text-sm text-muted-foreground">
          查看 change unit 执行状态、最近验证结果，以及最终交付审批。
          {props.deliveryCommitMode
            ? ` 当前 commit mode: ${props.deliveryCommitMode}。`
            : ''}
        </p>
      </div>

      <div className="space-y-3">
        {props.issue.changeUnits.length > 0 ? (
          props.issue.changeUnits.map((changeUnit) => (
            <GovernanceChangeUnitExecutionCard
              key={changeUnit.id}
              changeUnit={changeUnit}
              issue={props.issue}
              policy={props.policy}
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

          {props.actionableChangeUnits.length > 0 ? (
            <>
              <FormField
                label="Reviewer"
                htmlFor="governance-change-unit-reviewer"
                error={props.changeUnitReviewForm.formState.errors.reviewer?.message}
              >
                <Input
                  id="governance-change-unit-reviewer"
                  placeholder="reviewer-1"
                  {...props.changeUnitReviewForm.register('reviewer')}
                />
              </FormField>

              <FormField
                label="Change Unit"
                htmlFor="governance-change-unit-select"
                error={props.changeUnitReviewForm.formState.errors.changeUnitId?.message}
              >
                <NativeSelect
                  id="governance-change-unit-select"
                  {...props.changeUnitReviewForm.register('changeUnitId')}
                >
                  <option value="">请选择</option>
                  {props.actionableChangeUnits.map((changeUnit) => (
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
                  {...props.changeUnitReviewForm.register('comment')}
                />
              </FormField>

              {props.changeUnitError ? (
                <p className="text-sm text-destructive">{props.changeUnitError}</p>
              ) : null}

              {props.isSelectedChangeUnitManualReady ? (
                <p className="text-xs text-muted-foreground">
                  这个单元已被 policy 降级为 manual。先在工作区完成修改，再使用
                  Edit &amp; Continue 触发验证。
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {props.selectedChangeUnit?.status ===
                GovernanceChangeUnitStatus.Verified ? (
                  <Button
                    type="button"
                    onClick={() =>
                      void submitChangeUnitReview({
                        reviewMutation: props.reviewMutation,
                        form: props.changeUnitReviewForm,
                        decision: GovernanceReviewDecisionType.Approved,
                        setChangeUnitError: props.setChangeUnitError
                      })
                    }
                    disabled={props.reviewMutation.isPending}
                  >
                    Approve Unit
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void submitChangeUnitReview({
                      reviewMutation: props.reviewMutation,
                      form: props.changeUnitReviewForm,
                      decision: GovernanceReviewDecisionType.EditAndContinue,
                      setChangeUnitError: props.setChangeUnitError
                    })
                  }
                  disabled={props.reviewMutation.isPending}
                >
                  Edit & Continue
                </Button>
                {props.selectedChangeUnit &&
                [
                  GovernanceChangeUnitStatus.VerificationFailed,
                  GovernanceChangeUnitStatus.Exhausted
                ].includes(
                  props.selectedChangeUnit.status
                ) ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void submitChangeUnitReview({
                        reviewMutation: props.reviewMutation,
                        form: props.changeUnitReviewForm,
                        decision: GovernanceReviewDecisionType.Retry,
                        setChangeUnitError: props.setChangeUnitError
                      })
                    }
                    disabled={props.reviewMutation.isPending}
                  >
                    Retry
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void submitChangeUnitReview({
                      reviewMutation: props.reviewMutation,
                      form: props.changeUnitReviewForm,
                      decision: GovernanceReviewDecisionType.Skip,
                      setChangeUnitError: props.setChangeUnitError
                    })
                  }
                  disabled={props.reviewMutation.isPending}
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
            <p className="text-sm font-medium text-foreground">Delivery Artifact</p>
            <p className="text-xs text-muted-foreground">
              当所有活跃单元提交完成后，系统会生成 review request。
            </p>
          </div>

          {props.issue.deliveryArtifact ? (
            <>
              <div className="space-y-2">
                <Badge variant="outline">{props.issue.deliveryArtifact.status}</Badge>
                <p className="text-sm font-medium text-foreground">
                  {props.issue.deliveryArtifact.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  linked units: {props.issue.deliveryArtifact.linkedChangeUnitIds.length}
                  {' · '}
                  linked results:{' '}
                  {props.issue.deliveryArtifact.linkedVerificationResultIds.length}
                </p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {props.issue.deliveryArtifact.body}
                </p>
              </div>

              <FormField
                label="Reviewer"
                htmlFor="governance-delivery-reviewer"
                error={props.deliveryReviewForm.formState.errors.reviewer?.message}
              >
                <Input
                  id="governance-delivery-reviewer"
                  placeholder="lead-1"
                  {...props.deliveryReviewForm.register('reviewer')}
                />
              </FormField>

              <FormField
                label="Comment"
                htmlFor="governance-delivery-comment"
              >
                <Textarea
                  id="governance-delivery-comment"
                  rows={3}
                  {...props.deliveryReviewForm.register('comment')}
                />
              </FormField>

              {props.deliveryError ? (
                <p className="text-sm text-destructive">{props.deliveryError}</p>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() =>
                    void submitDeliveryReview({
                      issue: props.issue,
                      reviewMutation: props.reviewMutation,
                      form: props.deliveryReviewForm,
                      decision: GovernanceReviewDecisionType.Approved,
                      setDeliveryError: props.setDeliveryError
                    })
                  }
                  disabled={props.reviewMutation.isPending}
                >
                  Approve Delivery
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void submitDeliveryReview({
                      issue: props.issue,
                      reviewMutation: props.reviewMutation,
                      form: props.deliveryReviewForm,
                      decision: GovernanceReviewDecisionType.Rejected,
                      setDeliveryError: props.setDeliveryError
                    })
                  }
                  disabled={props.reviewMutation.isPending}
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

type GovernanceRelatedFindingsSectionProps = {
  issue: GovernanceIssueDetail;
};

export function GovernanceRelatedFindingsSection(
  props: GovernanceRelatedFindingsSectionProps
) {
  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Related Findings
        </h3>
      </div>
      <div className="space-y-3">
        {props.issue.relatedFindings.length > 0 ? (
          props.issue.relatedFindings.map((finding) => (
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
  );
}

export function GovernanceIssueInfoBlock({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}
