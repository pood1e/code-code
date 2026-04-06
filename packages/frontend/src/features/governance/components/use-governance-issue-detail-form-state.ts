import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  GovernanceChangeUnitStatus,
  GovernanceExecutionMode,
  GovernanceFindingStatus,
  GovernanceResolutionType,
  type GovernanceIssueDetail
} from '@agent-workbench/shared';

import {
  assessmentOverrideFormSchema,
  changePlanReviewFormSchema,
  changeUnitReviewFormSchema,
  deliveryReviewFormSchema,
  findingDismissFormSchema,
  resolutionFormSchema,
  type AssessmentOverrideFormInput,
  type AssessmentOverrideFormValues,
  type ChangePlanReviewFormValues,
  type ChangeUnitReviewFormValues,
  type DeliveryReviewFormValues,
  type FindingDismissFormValues,
  type ResolutionFormValues
} from './governance-issue-detail.model';

export function useGovernanceIssueDetailFormState(
  issue: GovernanceIssueDetail | undefined
) {
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
      ) ?? [],
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
    changePlanReviewForm,
    changeUnitReviewForm,
    deliveryReviewForm,
    findingDismissForm,
    resolutionForm,
    issue?.id
  ]);

  useEffect(() => {
    const currentFindingId = findingDismissForm.getValues('findingId');
    const nextFindingId =
      pendingFindings.some((finding) => finding.id === currentFindingId)
        ? currentFindingId
        : (pendingFindings[0]?.id ?? '');

    if (currentFindingId !== nextFindingId) {
      findingDismissForm.setValue('findingId', nextFindingId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false
      });
    }
  }, [findingDismissForm, pendingFindings]);

  useEffect(() => {
    const currentChangeUnitId = changeUnitReviewForm.getValues('changeUnitId');
    const nextChangeUnitId =
      actionableChangeUnits.some((changeUnit) => changeUnit.id === currentChangeUnitId)
        ? currentChangeUnitId
        : (actionableChangeUnits[0]?.id ?? '');

    if (currentChangeUnitId !== nextChangeUnitId) {
      changeUnitReviewForm.setValue('changeUnitId', nextChangeUnitId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false
      });
    }
  }, [actionableChangeUnits, changeUnitReviewForm]);

  return {
    resolutionForm,
    assessmentOverrideForm,
    findingDismissForm,
    changePlanReviewForm,
    changeUnitReviewForm,
    deliveryReviewForm,
    resolution,
    pendingFindings,
    actionableChangeUnits,
    selectedChangeUnit,
    isSelectedChangeUnitManualReady,
    resolutionError,
    setResolutionError,
    assessmentError,
    setAssessmentError,
    dismissError,
    setDismissError,
    changePlanError,
    setChangePlanError,
    planningError,
    setPlanningError,
    changeUnitError,
    setChangeUnitError,
    deliveryError,
    setDeliveryError
  };
}
