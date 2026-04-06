import { useQuery } from '@tanstack/react-query';

import type {
  ChangeUnit,
  DeliveryArtifact,
  Finding,
  GovernanceChangeUnitStatus,
  GovernanceDeliveryArtifactStatus,
  GovernanceFindingStatus,
  GovernanceIssueDetail,
  GovernanceIssueStatus,
  GovernanceIssueSummary,
  GovernancePolicy,
  GovernanceScopeOverview,
  RepositoryProfile
} from '@agent-workbench/shared';

import {
  getGovernancePolicy,
  getGovernanceIssue,
  getGovernanceRepositoryProfile,
  getGovernanceScopeOverview,
  listGovernanceChangeUnits,
  listGovernanceDeliveryArtifacts,
  listGovernanceFindings,
  listGovernanceIssues
} from '@/api/governance';
import { NOOP_QUERY_KEY, queryKeys } from '@/query/query-keys';

const governanceScopeKeys = queryKeys.governance.scopes;
const governanceFindingKeys = queryKeys.governance.findings;
const governanceIssueKeys = queryKeys.governance.issues;
const governanceChangeUnitKeys = queryKeys.governance.changeUnits;
const governanceDeliveryArtifactKeys = queryKeys.governance.deliveryArtifacts;

export function useGovernanceScopeOverview(scopeId: string | undefined) {
  return useQuery<GovernanceScopeOverview>({
    queryKey: scopeId ? governanceScopeKeys.overview(scopeId) : NOOP_QUERY_KEY,
    queryFn: () => getGovernanceScopeOverview(scopeId!),
    enabled: Boolean(scopeId)
  });
}

export function useGovernanceRepositoryProfile(scopeId: string | undefined) {
  return useQuery<RepositoryProfile | null>({
    queryKey: scopeId
      ? governanceScopeKeys.repositoryProfile(scopeId)
      : NOOP_QUERY_KEY,
    queryFn: () => getGovernanceRepositoryProfile(scopeId!),
    enabled: Boolean(scopeId)
  });
}

export function useGovernancePolicy(scopeId: string | undefined) {
  return useQuery<GovernancePolicy>({
    queryKey: scopeId ? governanceScopeKeys.policy(scopeId) : NOOP_QUERY_KEY,
    queryFn: () => getGovernancePolicy(scopeId!),
    enabled: Boolean(scopeId)
  });
}

export function useGovernanceFindingList(
  scopeId: string | undefined,
  status?: GovernanceFindingStatus
) {
  return useQuery<Finding[]>({
    queryKey: governanceFindingKeys.list(scopeId, status),
    queryFn: () => listGovernanceFindings(scopeId, status),
    enabled: Boolean(scopeId)
  });
}

export function useGovernanceIssueList(
  scopeId: string | undefined,
  status?: GovernanceIssueStatus
) {
  return useQuery<GovernanceIssueSummary[]>({
    queryKey: governanceIssueKeys.list(scopeId, status),
    queryFn: () => listGovernanceIssues(scopeId, status),
    enabled: Boolean(scopeId)
  });
}

export function useGovernanceIssueDetail(issueId: string | null | undefined) {
  return useQuery<GovernanceIssueDetail>({
    queryKey: issueId ? governanceIssueKeys.detail(issueId) : NOOP_QUERY_KEY,
    queryFn: () => getGovernanceIssue(issueId!),
    enabled: Boolean(issueId)
  });
}

export function useGovernanceChangeUnitList(
  scopeId: string | undefined,
  issueId?: string,
  status?: GovernanceChangeUnitStatus
) {
  return useQuery<ChangeUnit[]>({
    queryKey: governanceChangeUnitKeys.list(scopeId, issueId, status),
    queryFn: () => listGovernanceChangeUnits(scopeId, issueId, status),
    enabled: Boolean(scopeId)
  });
}

export function useGovernanceDeliveryArtifactList(
  scopeId: string | undefined,
  status?: GovernanceDeliveryArtifactStatus
) {
  return useQuery<DeliveryArtifact[]>({
    queryKey: governanceDeliveryArtifactKeys.list(scopeId, status),
    queryFn: () => listGovernanceDeliveryArtifacts(scopeId, status),
    enabled: Boolean(scopeId)
  });
}
