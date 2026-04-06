import type { UseFormReturn } from 'react-hook-form';
import {
  GovernanceReviewDecisionType,
  GovernanceReviewSubjectType,
  type GovernanceIssueDetail
} from '@agent-workbench/shared';

import { toApiRequestError } from '@/api/client';

import type {
  ChangePlanReviewFormValues,
  ChangeUnitReviewFormValues,
  DeliveryReviewFormValues
} from './governance-issue-detail.model';

type ChangePlanReviewMutation = {
  mutateAsync: (payload: {
    subjectType: GovernanceReviewSubjectType.ChangePlan;
    subjectId: string;
    decision:
      | GovernanceReviewDecisionType.Approved
      | GovernanceReviewDecisionType.Rejected;
    reviewer: string;
    comment?: string;
  }) => Promise<unknown>;
};

type ChangeUnitReviewMutation = {
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

type DeliveryReviewMutation = {
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

export async function submitChangePlanReview(input: {
  issue: GovernanceIssueDetail;
  reviewMutation: ChangePlanReviewMutation;
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

export async function submitChangeUnitReview(input: {
  reviewMutation: ChangeUnitReviewMutation;
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

export async function submitDeliveryReview(input: {
  issue: GovernanceIssueDetail;
  reviewMutation: DeliveryReviewMutation;
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
