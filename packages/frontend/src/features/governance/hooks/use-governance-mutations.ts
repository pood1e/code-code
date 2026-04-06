import { useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  CreateResolutionDecisionInput,
  CreateReviewDecisionInput,
  GovernanceIssueStatus,
  UpdateGovernancePolicyInput
} from '@agent-workbench/shared';

import {
  refreshGovernanceRepositoryProfile,
  retryGovernancePlanning,
  retryGovernanceTriage,
  runGovernanceDiscovery,
  submitGovernanceResolutionDecision,
  submitGovernanceReviewDecision,
  updateGovernancePolicy
} from '@/api/governance';
import { queryKeys } from '@/query/query-keys';

export function useGovernanceResolutionDecisionMutation(
  issueId: string,
  scopeId: string,
  status?: GovernanceIssueStatus
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateResolutionDecisionInput) =>
      submitGovernanceResolutionDecision(issueId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.issues.detail(issueId)
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.issues.all
      });
    }
  });
}

export function useGovernanceReviewDecisionMutation(
  scopeId: string,
  issueId?: string | null,
  status?: GovernanceIssueStatus
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateReviewDecisionInput) =>
      submitGovernanceReviewDecision(payload),
    onSuccess: () => {
      if (issueId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.governance.issues.detail(issueId)
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.governance.changeUnits.all
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.governance.deliveryArtifacts.all
        });
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.issues.all
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.findings.all
      });
    }
  });
}

export function useGovernanceRetryTriageMutation(scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (findingId: string) => retryGovernanceTriage(findingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.findings.all
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.issues.all
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.changeUnits.all
      });
    }
  });
}

export function useGovernanceRetryPlanningMutation(
  scopeId: string,
  issueId: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => retryGovernancePlanning(issueId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.issues.detail(issueId)
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.issues.all
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.changeUnits.all
      });
    }
  });
}

export function useGovernanceRefreshRepositoryProfileMutation(scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => refreshGovernanceRepositoryProfile(scopeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.scopes.overview(scopeId)
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.scopes.repositoryProfile(scopeId)
      });
    }
  });
}

export function useGovernanceRunDiscoveryMutation(scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => runGovernanceDiscovery(scopeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.scopes.overview(scopeId)
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.findings.all
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.issues.all
      });
    }
  });
}

export function useGovernanceUpdatePolicyMutation(scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateGovernancePolicyInput) =>
      updateGovernancePolicy(scopeId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.governance.scopes.policy(scopeId)
      });
    }
  });
}
