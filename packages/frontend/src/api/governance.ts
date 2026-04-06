import type {
  ChangeUnit,
  CreateFindingInput,
  CreateResolutionDecisionInput,
  CreateReviewDecisionInput,
  DeliveryArtifact,
  Finding,
  GovernanceChangeUnitStatus,
  GovernanceDeliveryArtifactStatus,
  GovernancePolicy,
  GovernanceScopeOverview,
  GovernanceIssueDetail,
  GovernanceIssueSummary,
  GovernanceReviewQueueItem,
  GovernanceFindingStatus,
  GovernanceIssueStatus,
  RepositoryProfile,
  UpdateGovernancePolicyInput
} from '@agent-workbench/shared';

import { apiClient } from './client';

export async function listGovernanceFindings(
  scopeId?: string,
  status?: GovernanceFindingStatus
) {
  const response = await apiClient.get<Finding[]>('/governance/findings', {
    params: {
      ...(scopeId ? { scopeId } : {}),
      ...(status ? { status } : {})
    }
  });
  return response.data;
}

export async function createGovernanceFinding(payload: CreateFindingInput) {
  const response = await apiClient.post<Finding>('/governance/findings', payload);
  return response.data;
}

export async function getGovernanceScopeOverview(scopeId: string) {
  const response = await apiClient.get<GovernanceScopeOverview>(
    `/governance/scopes/${scopeId}/overview`
  );
  return response.data;
}

export async function getGovernanceReviewQueue(scopeId: string) {
  const response = await apiClient.get<GovernanceReviewQueueItem[]>(
    `/governance/scopes/${scopeId}/review-queue`
  );
  return response.data;
}

export async function getGovernanceRepositoryProfile(scopeId: string) {
  const response = await apiClient.get<RepositoryProfile | null>(
    `/governance/scopes/${scopeId}/repository-profile`
  );
  return response.data;
}

export async function getGovernancePolicy(scopeId: string) {
  const response = await apiClient.get<GovernancePolicy>(
    `/governance/scopes/${scopeId}/policy`
  );
  return response.data;
}

export async function updateGovernancePolicy(
  scopeId: string,
  payload: UpdateGovernancePolicyInput
) {
  const response = await apiClient.put<GovernancePolicy>(
    `/governance/scopes/${scopeId}/policy`,
    payload
  );
  return response.data;
}

export async function refreshGovernanceRepositoryProfile(scopeId: string) {
  const response = await apiClient.post<RepositoryProfile | null>(
    `/governance/scopes/${scopeId}/repository-profile/refresh`
  );
  return response.data;
}

export async function retryGovernanceBaseline(scopeId: string) {
  const response = await apiClient.post<GovernanceScopeOverview>(
    `/governance/scopes/${scopeId}/retry-baseline`
  );
  return response.data;
}

export async function runGovernanceDiscovery(scopeId: string) {
  const response = await apiClient.post<GovernanceScopeOverview>(
    `/governance/scopes/${scopeId}/discovery/run`
  );
  return response.data;
}

export async function retryGovernanceDiscovery(scopeId: string) {
  const response = await apiClient.post<GovernanceScopeOverview>(
    `/governance/scopes/${scopeId}/retry-discovery`
  );
  return response.data;
}

export async function listGovernanceIssues(
  scopeId?: string,
  status?: GovernanceIssueStatus
) {
  const response = await apiClient.get<GovernanceIssueSummary[]>(
    '/governance/issues',
    {
      params: {
        ...(scopeId ? { scopeId } : {}),
        ...(status ? { status } : {})
      }
    }
  );
  return response.data;
}

export async function listGovernanceChangeUnits(
  scopeId?: string,
  issueId?: string,
  status?: GovernanceChangeUnitStatus
) {
  const response = await apiClient.get<ChangeUnit[]>('/governance/change-units', {
    params: {
      ...(scopeId ? { scopeId } : {}),
      ...(issueId ? { issueId } : {}),
      ...(status ? { status } : {})
    }
  });
  return response.data;
}

export async function listGovernanceDeliveryArtifacts(
  scopeId?: string,
  status?: GovernanceDeliveryArtifactStatus
) {
  const response = await apiClient.get<DeliveryArtifact[]>(
    '/governance/delivery-artifacts',
    {
      params: {
        ...(scopeId ? { scopeId } : {}),
        ...(status ? { status } : {})
      }
    }
  );
  return response.data;
}

export async function getGovernanceIssue(id: string) {
  const response = await apiClient.get<GovernanceIssueDetail>(
    `/governance/issues/${id}`
  );
  return response.data;
}

export async function submitGovernanceResolutionDecision(
  issueId: string,
  payload: CreateResolutionDecisionInput
) {
  const response = await apiClient.post<GovernanceIssueDetail>(
    `/governance/issues/${issueId}/resolution-decisions`,
    payload
  );
  return response.data;
}

export async function submitGovernanceReviewDecision(
  payload: CreateReviewDecisionInput
) {
  await apiClient.post('/governance/review-decisions', payload);
}

export async function retryGovernanceTriage(findingId: string) {
  await apiClient.post(`/governance/findings/${findingId}/retry-triage`);
}

export async function retryGovernancePlanning(issueId: string) {
  const response = await apiClient.post<GovernanceIssueDetail>(
    `/governance/issues/${issueId}/retry-planning`
  );
  return response.data;
}
