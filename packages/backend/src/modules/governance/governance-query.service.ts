import { Injectable, NotFoundException } from '@nestjs/common';

import {
  toFinding,
  toChangeUnit,
  toDeliveryArtifact,
  toGovernancePolicy,
  toGovernanceIssueDetail,
  toGovernanceIssueSummary,
  toGovernanceReviewQueueItem,
  toGovernanceScopeOverview,
  toRepositoryProfile
} from './governance.mapper';
import { GovernanceRepository } from './governance.repository';

@Injectable()
export class GovernanceQueryService {
  constructor(private readonly governanceRepository: GovernanceRepository) {}

  async listFindings(scopeId?: string, status?: Parameters<GovernanceRepository['listFindings']>[0]['status']) {
    const findings = await this.governanceRepository.listFindings({
      scopeId,
      status
    });

    return findings.map(toFinding);
  }

  async listIssues(scopeId?: string, status?: Parameters<GovernanceRepository['listIssues']>[0]['status']) {
    const issues = await this.governanceRepository.listIssues({
      scopeId,
      status
    });

    return issues.map(toGovernanceIssueSummary);
  }

  async listChangeUnits(
    scopeId?: string,
    issueId?: string,
    status?: Parameters<GovernanceRepository['listChangeUnits']>[0]['status']
  ) {
    const changeUnits = await this.governanceRepository.listChangeUnits({
      scopeId,
      issueId,
      status
    });

    return changeUnits.map(toChangeUnit);
  }

  async listDeliveryArtifacts(
    scopeId?: string,
    status?: Parameters<GovernanceRepository['listDeliveryArtifacts']>[0]['status']
  ) {
    const artifacts = await this.governanceRepository.listDeliveryArtifacts({
      scopeId,
      status
    });

    return artifacts.map(toDeliveryArtifact);
  }

  async getScopeOverview(scopeId: string) {
    const overview = await this.governanceRepository.getScopeOverview(scopeId);
    if (!overview) {
      throw new NotFoundException(`Project not found: ${scopeId}`);
    }

    return toGovernanceScopeOverview(overview);
  }

  async getReviewQueue(scopeId: string) {
    if (!(await this.governanceRepository.projectExists(scopeId))) {
      throw new NotFoundException(`Project not found: ${scopeId}`);
    }

    const items = await this.governanceRepository.listReviewQueue(scopeId);
    return items.map(toGovernanceReviewQueueItem);
  }

  async getLatestRepositoryProfile(scopeId: string) {
    if (!(await this.governanceRepository.projectExists(scopeId))) {
      throw new NotFoundException(`Project not found: ${scopeId}`);
    }

    const profile = await this.governanceRepository.getLatestRepositoryProfile(scopeId);
    return profile ? toRepositoryProfile(profile) : null;
  }

  async getGovernancePolicy(scopeId: string) {
    if (!(await this.governanceRepository.projectExists(scopeId))) {
      throw new NotFoundException(`Project not found: ${scopeId}`);
    }

    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      scopeId
    );
    return toGovernancePolicy(policy);
  }

  async getIssueById(id: string) {
    const issue = await this.governanceRepository.getIssueDetail(id);

    if (!issue) {
      throw new NotFoundException(`Governance issue not found: ${id}`);
    }

    return toGovernanceIssueDetail(issue);
  }
}
