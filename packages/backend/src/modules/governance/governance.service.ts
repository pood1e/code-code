import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type CreateReviewDecisionInput,
  createFindingInputSchema,
  createResolutionDecisionInputSchema,
  createReviewDecisionInputSchema,
  GovernanceDeliveryCommitMode,
  updateGovernancePolicyInputSchema,
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceChangeUnitStatus,
  GovernanceDeliveryArtifactKind,
  GovernanceDeliveryArtifactStatus,
  GovernanceDeliveryBodyStrategy,
  GovernanceExecutionMode,
  GovernanceIssueStatus,
  GovernanceResolutionType,
  GovernanceReviewDecisionType,
  GovernanceReviewSubjectType,
  type GovernanceTargetRef,
  GovernanceVerificationResultStatus,
  GovernanceVerificationSubjectType,
  type GovernanceIssueDetail
} from '@agent-workbench/shared';

import { parseSchemaOrThrow } from '../../common/schema.utils';
import {
  toFinding,
  toGovernancePolicy,
  toGovernanceIssueDetail,
  toRepositoryProfile
} from './governance.mapper';
import { GovernanceAutomationService } from './governance-automation.service';
import { GovernanceGitService } from './governance-git.service';
import type {
  CreateChangePlanBundleInput,
  CreateIssueWithAssessmentInput
} from './governance.repository';
import { GovernanceVerificationRunnerService } from './governance-verification-runner.service';
import { GovernanceRepository } from './governance.repository';

const DEFAULT_DEFER_DAYS = 30;

@Injectable()
export class GovernanceService {
  private static readonly REVIEW_LEASE_MS = 5 * 60_000;

  private readonly reviewOwnerId = `governance-review:${randomUUID()}`;

  constructor(
    private readonly governanceRepository: GovernanceRepository,
    private readonly governanceAutomationService: GovernanceAutomationService,
    private readonly governanceGitService: GovernanceGitService,
    private readonly governanceVerificationRunner: GovernanceVerificationRunnerService
  ) {}

  async createFinding(input: unknown) {
    const parsed = parseSchemaOrThrow(
      createFindingInputSchema,
      input,
      'Invalid governance finding payload'
    );

    if (!(await this.governanceRepository.projectExists(parsed.scopeId))) {
      throw new NotFoundException(`Project not found: ${parsed.scopeId}`);
    }

    const finding = await this.governanceRepository.createFinding({
      ...parsed,
      tags: parsed.tags ?? []
    });

    return toFinding(finding);
  }

  async submitResolutionDecision(issueId: string, input: unknown) {
    const issue = await this.governanceRepository.findIssueById(issueId);

    if (!issue) {
      throw new NotFoundException(`Governance issue not found: ${issueId}`);
    }

    const parsed = parseSchemaOrThrow(
      createResolutionDecisionInputSchema,
      input,
      'Invalid governance resolution payload'
    );

    if (parsed.primaryIssueId) {
      if (parsed.primaryIssueId === issueId) {
        throw new BadRequestException('primaryIssueId must not equal issueId');
      }
      if (!(await this.governanceRepository.issueExists(parsed.primaryIssueId))) {
        throw new NotFoundException(
          `Governance issue not found: ${parsed.primaryIssueId}`
        );
      }
    }

    await this.governanceRepository.submitResolutionDecision({
      issueId,
      resolution: parsed.resolution,
      reason: parsed.reason,
      deferUntil: resolveDeferUntil(parsed.resolution, parsed.deferUntil),
      primaryIssueId: parsed.primaryIssueId ?? null,
      approvedBy: parsed.approvedBy ?? null,
      nextIssueStatus: mapResolutionToIssueStatus(parsed.resolution),
      expectedVersion: issue.version
    });

    return this.getIssueDetail(issueId);
  }

  async submitReviewDecision(input: unknown) {
    const parsed = parseSchemaOrThrow(
      createReviewDecisionInputSchema,
      input,
      'Invalid governance review payload'
    );

    switch (parsed.subjectType) {
      case GovernanceReviewSubjectType.Finding: {
        const finding = await this.governanceRepository.findFindingById(
          parsed.subjectId
        );
        if (!finding) {
          throw new NotFoundException(
            `Finding not found: ${parsed.subjectId}`
          );
        }
        await this.governanceRepository.dismissFinding({
          findingId: parsed.subjectId,
          reviewer: parsed.reviewer,
          ...(parsed.comment ? { comment: parsed.comment } : {})
        });
        return null;
      }
      case GovernanceReviewSubjectType.Assessment: {
        await this.governanceRepository.overrideAssessment({
          assessmentId: parsed.subjectId,
          reviewer: parsed.reviewer,
          ...(parsed.comment ? { comment: parsed.comment } : {}),
          assessmentOverride: parsed.assessmentOverride
        });
        return null;
      }
      case GovernanceReviewSubjectType.ChangePlan: {
        await this.governanceRepository.reviewChangePlan({
          changePlanId: parsed.subjectId,
          reviewer: parsed.reviewer,
          ...(parsed.comment ? { comment: parsed.comment } : {}),
          decision: parsed.decision
        });
        return null;
      }
      case GovernanceReviewSubjectType.ChangeUnit: {
        return this.handleChangeUnitReview(parsed);
      }
      case GovernanceReviewSubjectType.DeliveryArtifact: {
        return this.handleDeliveryArtifactReview(parsed);
      }
    }
  }

  async createIssueWithAssessment(input: CreateIssueWithAssessmentInput) {
    if (!(await this.governanceRepository.projectExists(input.scopeId))) {
      throw new NotFoundException(`Project not found: ${input.scopeId}`);
    }

    const issue = await this.governanceRepository.createIssueWithAssessment(input);
    return toGovernanceIssueDetail(issue);
  }

  async createChangePlanBundle(input: CreateChangePlanBundleInput) {
    const issue = await this.governanceRepository.findIssueById(input.issueId);

    if (!issue) {
      throw new NotFoundException(`Governance issue not found: ${input.issueId}`);
    }

    const detail = await this.governanceRepository.createChangePlanBundle(input);
    return toGovernanceIssueDetail(detail);
  }

  async getIssueDetail(id: string) {
    const issue = await this.governanceRepository.getIssueDetail(id);

    if (!issue) {
      throw new NotFoundException(`Governance issue not found: ${id}`);
    }

    return toGovernanceIssueDetail(issue);
  }

  async refreshRepositoryProfile(scopeId: string) {
    if (!(await this.governanceRepository.projectExists(scopeId))) {
      throw new NotFoundException(`Project not found: ${scopeId}`);
    }

    await this.governanceAutomationService.refreshRepositoryProfile(scopeId);
    const profile = await this.governanceRepository.getLatestRepositoryProfile(scopeId);
    return profile ? toRepositoryProfile(profile) : null;
  }

  async getGovernancePolicy(scopeId: string) {
    if (!(await this.governanceRepository.projectExists(scopeId))) {
      throw new NotFoundException(`Project not found: ${scopeId}`);
    }

    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(scopeId);
    return toGovernancePolicy(policy);
  }

  async updateGovernancePolicy(scopeId: string, input: unknown) {
    if (!(await this.governanceRepository.projectExists(scopeId))) {
      throw new NotFoundException(`Project not found: ${scopeId}`);
    }

    const parsed = parseSchemaOrThrow(
      updateGovernancePolicyInputSchema,
      input,
      'Invalid governance policy payload'
    );

    const policy = await this.governanceRepository.updateGovernancePolicy({
      scopeId,
      priorityPolicy: parsed.priorityPolicy,
      autoActionPolicy: parsed.autoActionPolicy,
      deliveryPolicy: parsed.deliveryPolicy,
      ...(parsed.runnerSelection !== undefined
        ? { runnerSelection: parsed.runnerSelection }
        : {})
    });

    return toGovernancePolicy(policy);
  }

  async runDiscovery(scopeId: string) {
    if (!(await this.governanceRepository.projectExists(scopeId))) {
      throw new NotFoundException(`Project not found: ${scopeId}`);
    }

    await this.governanceAutomationService.runDiscovery(scopeId);
  }

  async retryTriage(findingId: string) {
    const finding = await this.governanceRepository.findFindingById(findingId);
    if (!finding) {
      throw new NotFoundException(`Finding not found: ${findingId}`);
    }

    await this.governanceRepository.retryTriage(findingId);
    return null;
  }

  async retryPlanning(issueId: string) {
    const issue = await this.governanceRepository.findIssueById(issueId);
    if (!issue) {
      throw new NotFoundException(`Governance issue not found: ${issueId}`);
    }

    await this.governanceRepository.retryPlanning(issueId);
    return this.getIssueDetail(issueId);
  }

  private async handleChangeUnitReview(
    input: Extract<
      CreateReviewDecisionInput,
      { subjectType: GovernanceReviewSubjectType.ChangeUnit }
    >
  ) {
    const context =
      await this.governanceRepository.getChangeUnitExecutionContext(input.subjectId);
    if (!context) {
      throw new NotFoundException(`Change unit not found: ${input.subjectId}`);
    }

    assertAllowedChangeUnitReviewDecision(
      context.changeUnit.status,
      context.changeUnit.executionMode,
      input.decision
    );

    await this.governanceRepository.reviewChangeUnit({
      changeUnitId: input.subjectId,
      reviewer: input.reviewer,
      ...(input.comment ? { comment: input.comment } : {}),
      decision: input.decision
    });

    switch (input.decision) {
      case GovernanceReviewDecisionType.Approved: {
        return this.approveChangeUnitReview(context);
      }
      case GovernanceReviewDecisionType.Rejected: {
        return this.rejectChangeUnitReview(context.issue.id, context.changeUnit.id);
      }
      case GovernanceReviewDecisionType.Retry: {
        return this.retryChangeUnitReview(context.issue.id, context.changeUnit.id);
      }
      case GovernanceReviewDecisionType.Skip:
      case GovernanceReviewDecisionType.Terminate: {
        return this.cancelChangeUnitReview(context.issue.id, context.changeUnit.id);
      }
      case GovernanceReviewDecisionType.EditAndContinue: {
        await this.rerunChangeUnitVerification(context.issue.id, context.changeUnit.id);
        return this.getIssueDetail(context.issue.id);
      }
      default:
        return null;
    }
  }

  private async handleDeliveryArtifactReview(
    input: Extract<
      CreateReviewDecisionInput,
      { subjectType: GovernanceReviewSubjectType.DeliveryArtifact }
    >
  ) {
    const artifact = await this.governanceRepository.findDeliveryArtifactById(
      input.subjectId
    );
    if (!artifact) {
      throw new NotFoundException(
        `Delivery artifact not found: ${input.subjectId}`
      );
    }

    assertAllowedDeliveryArtifactReviewDecision(artifact.status, input.decision);

    await this.governanceRepository.reviewDeliveryArtifact({
      deliveryArtifactId: input.subjectId,
      reviewer: input.reviewer,
      ...(input.comment ? { comment: input.comment } : {}),
      decision: input.decision
    });

    if (input.decision === GovernanceReviewDecisionType.Approved) {
      return this.approveDeliveryArtifactReview(artifact);
    }

    return this.rejectDeliveryArtifactReview(artifact.id, artifact.issueId);
  }

  private async approveChangeUnitReview(context: {
    scopeId: string;
    workspacePath: string;
    issue: { id: string };
    changeUnit: {
      id: string;
      title: string;
      scope: unknown;
      status: GovernanceChangeUnitStatus;
      version: number;
    };
  }) {
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      context.scopeId
    );
    const claimedVersion = await this.claimChangeUnitReviewLease(
      context.changeUnit.id,
      context.changeUnit.version,
      context.changeUnit.status
    );

    try {
      if (policy.deliveryPolicy.commitMode === GovernanceDeliveryCommitMode.PerUnit) {
        const scopedDiff = await this.governanceGitService.collectScopedDiff({
          workspacePath: context.workspacePath,
          targets: getChangeUnitScopeTargets(context.changeUnit.scope)
        });
        if (scopedDiff.changedFiles.length === 0) {
          throw new ConflictException(
            'No scoped workspace changes are available for this change unit approval.'
          );
        }
        const commitSha = await this.governanceGitService.createScopedCommit({
          workspacePath: context.workspacePath,
          files: scopedDiff.changedFiles,
          message: `governance(${context.changeUnit.title}): apply approved change unit`
        });
        const appended = await this.governanceRepository.appendChangeUnitCommit({
          changeUnitId: context.changeUnit.id,
          commitId: commitSha,
          expectedVersion: claimedVersion,
          ownerLeaseToken: this.reviewOwnerId
        });
        if (!appended) {
          throw new ConflictException(
            'Change unit approval conflicted with another update.'
          );
        }
      } else {
        const updated = await this.governanceRepository.updateChangeUnitExecutionState({
          changeUnitId: context.changeUnit.id,
          expectedVersion: claimedVersion,
          status: GovernanceChangeUnitStatus.Committed,
          ownerLeaseToken: null,
          leaseExpiresAt: null
        });
        if (!updated) {
          throw new ConflictException(
            'Change unit approval conflicted with another update.'
          );
        }
      }
    } catch (error) {
      await this.governanceRepository.releaseChangeUnitLease({
        changeUnitId: context.changeUnit.id,
        ownerLeaseToken: this.reviewOwnerId
      });
      throw error;
    }

    await this.maybeCreateDeliveryArtifact(context.issue.id);
    return this.getIssueDetail(context.issue.id);
  }

  private async rejectChangeUnitReview(issueId: string, changeUnitId: string) {
    await this.governanceRepository.updateChangeUnitExecutionState({
      changeUnitId,
      status: GovernanceChangeUnitStatus.Ready
    });
    return this.getIssueDetail(issueId);
  }

  private async retryChangeUnitReview(issueId: string, changeUnitId: string) {
    const latestAttempt = await this.governanceRepository.findLatestAutomationAttempt({
      stageType: GovernanceAutomationStage.Execution,
      subjectType: GovernanceAutomationSubjectType.ChangeUnit,
      subjectId: changeUnitId
    });
    if (latestAttempt) {
      await this.governanceRepository.markAutomationAttemptResolvedByHuman(
        latestAttempt.id
      );
    }

    await this.governanceRepository.updateChangeUnitExecutionState({
      changeUnitId,
      status: GovernanceChangeUnitStatus.Ready,
      currentAttemptNo: 0
    });
    await this.governanceRepository.updateIssueState({
      issueId,
      status: GovernanceIssueStatus.InProgress
    });

    return this.getIssueDetail(issueId);
  }

  private async cancelChangeUnitReview(issueId: string, changeUnitId: string) {
    await this.governanceRepository.updateChangeUnitExecutionState({
      changeUnitId,
      status: GovernanceChangeUnitStatus.Cancelled
    });
    await this.reconcileIssueAfterManualUnitUpdate(issueId);
    return this.getIssueDetail(issueId);
  }

  private async approveDeliveryArtifactReview(artifact: {
    id: string;
    issueId: string;
    scopeId: string;
  }) {
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      artifact.scopeId
    );
    let detail = await this.getIssueDetail(artifact.issueId);

    if (policy.deliveryPolicy.commitMode === GovernanceDeliveryCommitMode.Squash) {
      detail = await this.createSquashDeliveryCommit(detail);
    }

    await this.governanceRepository.updateDeliveryArtifactStatus({
      deliveryArtifactId: artifact.id,
      status: GovernanceDeliveryArtifactStatus.Merged
    });
    await this.maybeCreateSpinOffIssue(detail);

    for (const unit of detail.changeUnits.filter(
      (changeUnit) => changeUnit.status === GovernanceChangeUnitStatus.Committed
    )) {
      await this.governanceRepository.updateChangeUnitExecutionState({
        changeUnitId: unit.id,
        status: GovernanceChangeUnitStatus.Merged
      });
    }

    await this.governanceRepository.updateIssueState({
      issueId: artifact.issueId,
      status: policy.deliveryPolicy.autoCloseIssueOnApprovedDelivery
        ? GovernanceIssueStatus.Closed
        : resolveDeliveryApprovedIssueStatus(detail)
    });

    return this.getIssueDetail(artifact.issueId);
  }

  private async rejectDeliveryArtifactReview(
    deliveryArtifactId: string,
    issueId: string
  ) {
    await this.governanceRepository.updateDeliveryArtifactStatus({
      deliveryArtifactId,
      status: GovernanceDeliveryArtifactStatus.Closed
    });
    await this.governanceRepository.updateIssueState({
      issueId,
      status: GovernanceIssueStatus.InReview
    });
    return this.getIssueDetail(issueId);
  }

  private async rerunChangeUnitVerification(issueId: string, changeUnitId: string) {
    const context =
      await this.governanceRepository.getChangeUnitExecutionContext(changeUnitId);
    if (!context || !context.unitVerificationPlan) {
      await this.governanceRepository.updateChangeUnitExecutionState({
        changeUnitId,
        status: GovernanceChangeUnitStatus.Verified
      });
      await this.reconcileIssueAfterManualUnitUpdate(issueId);
      return;
    }

    const verification = await this.governanceVerificationRunner.runPlan({
      workspacePath: context.workspacePath,
      plan: {
        id: context.unitVerificationPlan.id,
        subjectType: context.unitVerificationPlan.subjectType,
        ...(context.unitVerificationPlan.changeUnitId
          ? { changeUnitId: context.unitVerificationPlan.changeUnitId }
          : {}),
        ...(context.unitVerificationPlan.changePlanId
          ? { changePlanId: context.unitVerificationPlan.changePlanId }
          : {}),
        ...(context.unitVerificationPlan.issueId
          ? { issueId: context.unitVerificationPlan.issueId }
          : {}),
        checks: context.unitVerificationPlan.checks as never,
        passCriteria: context.unitVerificationPlan.passCriteria as never,
        createdAt: context.unitVerificationPlan.createdAt.toISOString()
      }
    });

    await this.governanceRepository.createVerificationResult({
      verificationPlanId: context.unitVerificationPlan.id,
      subjectType: GovernanceVerificationSubjectType.ChangeUnit,
      changeUnitId,
      changePlanId: context.changePlan.id,
      issueId,
      executionAttemptNo: context.changeUnit.currentAttemptNo || 1,
      status: verification.status,
      checkResults: verification.checkResults,
      summary: verification.summary
    });

    await this.governanceRepository.updateChangeUnitExecutionState({
      changeUnitId,
      status:
        verification.status === GovernanceVerificationResultStatus.Passed
          ? GovernanceChangeUnitStatus.Verified
          : context.changeUnit.currentAttemptNo >= context.changeUnit.maxRetries
            ? GovernanceChangeUnitStatus.Exhausted
            : GovernanceChangeUnitStatus.VerificationFailed
    });

    await this.reconcileIssueAfterManualUnitUpdate(issueId);
  }

  private async reconcileIssueAfterManualUnitUpdate(issueId: string) {
    const detail = await this.getIssueDetail(issueId);
    const activeUnits = detail.changeUnits.filter(
      (unit) => unit.status !== GovernanceChangeUnitStatus.Cancelled
    );

    if (
      activeUnits.length > 0 &&
      activeUnits.every((unit) => unit.status === GovernanceChangeUnitStatus.Verified)
    ) {
      await this.governanceRepository.updateIssueState({
        issueId,
        status: GovernanceIssueStatus.InReview
      });
      return;
    }

    if (detail.changeUnits.some((unit) => unit.status === GovernanceChangeUnitStatus.Exhausted)) {
      await this.governanceRepository.updateIssueState({
        issueId,
        status: GovernanceIssueStatus.Blocked
      });
      return;
    }

    if (detail.changeUnits.some((unit) => unit.status === GovernanceChangeUnitStatus.Running)) {
      await this.governanceRepository.updateIssueState({
        issueId,
        status: GovernanceIssueStatus.InProgress
      });
    }
  }

  private async maybeCreateDeliveryArtifact(issueId: string) {
    const detail = await this.getIssueDetail(issueId);
    const activeUnits = detail.changeUnits.filter(
      (unit) => unit.status !== GovernanceChangeUnitStatus.Cancelled
    );
    if (activeUnits.length === 0) {
      return;
    }
    if (
      !activeUnits.every(
        (unit) =>
          unit.status === GovernanceChangeUnitStatus.Committed ||
          unit.status === GovernanceChangeUnitStatus.Merged
      )
    ) {
      return;
    }

    const linkedVerificationResultIds = detail.verificationResults.map(
      (result) => result.id
    );
    const partiallyResolved = detail.changeUnits.some((unit) =>
      [
        GovernanceChangeUnitStatus.Cancelled,
        GovernanceChangeUnitStatus.Exhausted
      ].includes(unit.status)
    );
    await this.governanceRepository.updateIssueState({
      issueId,
      status:
        partiallyResolved
          ? GovernanceIssueStatus.PartiallyResolved
          : GovernanceIssueStatus.Resolved
    });
    await this.governanceRepository.createOrUpdateDeliveryArtifact({
      scopeId: detail.scopeId,
      issueId: detail.id,
      changePlanId: detail.changePlan?.id ?? null,
      kind: GovernanceDeliveryArtifactKind.ReviewRequest,
      title: `Governance review: ${detail.title}`,
      body: buildDeliveryArtifactBody(detail),
      linkedIssueIds: [detail.id],
      linkedChangeUnitIds: detail.changeUnits.map((unit) => unit.id),
      linkedVerificationResultIds,
      bodyStrategy: GovernanceDeliveryBodyStrategy.AutoAggregate,
      status: GovernanceDeliveryArtifactStatus.Submitted
    });
  }

  private async maybeCreateSpinOffIssue(detail: GovernanceIssueDetail) {
    const unresolvedUnits = detail.changeUnits.filter((unit) =>
      [
        GovernanceChangeUnitStatus.Cancelled,
        GovernanceChangeUnitStatus.Exhausted
      ].includes(unit.status)
    );
    if (unresolvedUnits.length === 0) {
      return null;
    }

    const existing = await this.governanceRepository.findSpinOffIssueBySourceIssueId(
      detail.id
    );
    if (existing) {
      return existing.id;
    }

    if (!detail.latestAssessment) {
      return null;
    }

    const issue = await this.governanceRepository.createIssueWithAssessment({
      scopeId: detail.scopeId,
      title: `Follow-up: ${detail.title}`,
      statement: [
        detail.statement,
        '',
        'Unresolved Change Units:',
        ...unresolvedUnits.map(
          (unit) => `- ${unit.title} (${unit.sourceActionId})`
        )
      ].join('\n'),
      kind: detail.kind,
      categories: detail.categories,
      tags: uniqueStrings([
        ...detail.tags,
        'spin_off'
      ]),
      affectedTargets: uniqueTargets(
        unresolvedUnits.flatMap((unit) => unit.scope.targets)
      ),
      ...(detail.rootCause ? { rootCause: detail.rootCause } : {}),
      impactSummary: `Follow-up governance work for ${detail.title}`,
      spinOffOfIssueId: detail.id,
      assessment: {
        severity: detail.latestAssessment.severity,
        priority: detail.latestAssessment.priority,
        userImpact: detail.latestAssessment.userImpact,
        systemRisk: detail.latestAssessment.systemRisk,
        strategicValue: detail.latestAssessment.strategicValue,
        fixCost: detail.latestAssessment.fixCost,
        autoActionEligibility: detail.latestAssessment.autoActionEligibility,
        rationale: uniqueStrings([
          ...detail.latestAssessment.rationale,
          `Spin-off from issue ${detail.id}`
        ]),
        assessedBy: detail.latestAssessment.assessedBy
      }
    });

    return issue.id;
  }

  private async createSquashDeliveryCommit(detail: GovernanceIssueDetail) {
    const committedUnits = detail.changeUnits.filter(
      (changeUnit) => changeUnit.status === GovernanceChangeUnitStatus.Committed
    );
    if (committedUnits.length === 0) {
      return detail;
    }

    const workspace = await this.governanceRepository.getProjectWorkspace(detail.scopeId);
    if (!workspace) {
      throw new NotFoundException(`Project not found: ${detail.scopeId}`);
    }

    const scopedDiff = await this.governanceGitService.collectScopedDiff({
      workspacePath: workspace.workspacePath,
      targets: uniqueTargets(
        committedUnits.flatMap((changeUnit) =>
          getChangeUnitScopeTargets(changeUnit.scope)
        )
      )
    });
    if (scopedDiff.changedFiles.length === 0) {
      throw new ConflictException(
        'No scoped workspace changes are available for squash delivery approval.'
      );
    }

    const claimedUnits = await this.claimSquashDeliveryUnits(committedUnits);

    try {
      const commitSha = await this.governanceGitService.createScopedCommit({
        workspacePath: workspace.workspacePath,
        files: scopedDiff.changedFiles,
        message: `governance(${detail.title}): deliver approved change plan`
      });

      for (const claimedUnit of claimedUnits) {
        const appended = await this.governanceRepository.appendChangeUnitCommit({
          changeUnitId: claimedUnit.id,
          commitId: commitSha,
          expectedVersion: claimedUnit.claimedVersion,
          ownerLeaseToken: this.reviewOwnerId
        });
        if (!appended) {
          throw new ConflictException(
            'Squash delivery conflicted with another change unit update.'
          );
        }
      }
    } catch (error) {
      await Promise.all(
        claimedUnits.map((claimedUnit) =>
          this.governanceRepository.releaseChangeUnitLease({
            changeUnitId: claimedUnit.id,
            ownerLeaseToken: this.reviewOwnerId
          })
        )
      );
      throw error;
    }

    return this.getIssueDetail(detail.id);
  }

  private async claimChangeUnitReviewLease(
    changeUnitId: string,
    expectedVersion: number,
    status: GovernanceChangeUnitStatus
  ) {
    const updated = await this.governanceRepository.updateChangeUnitExecutionState({
      changeUnitId,
      expectedVersion,
      status,
      ownerLeaseToken: this.reviewOwnerId,
      leaseExpiresAt: this.createReviewLeaseExpiresAt()
    });
    if (!updated) {
      throw new ConflictException('Change unit was updated by another process.');
    }

    return expectedVersion + 1;
  }

  private async claimSquashDeliveryUnits(
    changeUnits: GovernanceIssueDetail['changeUnits']
  ) {
    const claimedUnits: Array<{ id: string; claimedVersion: number }> = [];

    try {
      for (const changeUnit of changeUnits) {
        const context =
          await this.governanceRepository.getChangeUnitExecutionContext(changeUnit.id);
        if (!context) {
          throw new NotFoundException(`Change unit not found: ${changeUnit.id}`);
        }
        const claimedVersion = await this.claimChangeUnitReviewLease(
          changeUnit.id,
          context.changeUnit.version,
          context.changeUnit.status
        );
        claimedUnits.push({
          id: changeUnit.id,
          claimedVersion
        });
      }
    } catch (error) {
      await Promise.all(
        claimedUnits.map((claimedUnit) =>
          this.governanceRepository.releaseChangeUnitLease({
            changeUnitId: claimedUnit.id,
            ownerLeaseToken: this.reviewOwnerId
          })
        )
      );
      throw error;
    }

    return claimedUnits;
  }

  private createReviewLeaseExpiresAt() {
    return new Date(Date.now() + GovernanceService.REVIEW_LEASE_MS);
  }
}

function mapResolutionToIssueStatus(resolution: GovernanceResolutionType) {
  switch (resolution) {
    case GovernanceResolutionType.AcceptRisk:
      return GovernanceIssueStatus.AcceptedRisk;
    case GovernanceResolutionType.WontFix:
      return GovernanceIssueStatus.WontFix;
    case GovernanceResolutionType.Duplicate:
      return GovernanceIssueStatus.Duplicate;
    case GovernanceResolutionType.Defer:
      return GovernanceIssueStatus.Deferred;
    case GovernanceResolutionType.Fix:
    case GovernanceResolutionType.Refactor:
    case GovernanceResolutionType.Mitigate:
    case GovernanceResolutionType.NeedsHumanDecision:
      return GovernanceIssueStatus.Open;
  }
}

function resolveDeferUntil(
  resolution: GovernanceResolutionType,
  deferUntil?: string
) {
  if (resolution !== GovernanceResolutionType.Defer) {
    return null;
  }

  if (deferUntil) {
    return new Date(deferUntil);
  }

  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_DEFER_DAYS);
  return date;
}

function buildDeliveryArtifactBody(detail: GovernanceIssueDetail) {
  const committedUnits = detail.changeUnits
    .filter((unit) =>
      [
        GovernanceChangeUnitStatus.Committed,
        GovernanceChangeUnitStatus.Merged
      ].includes(unit.status)
    )
    .map((unit) => `- ${unit.title}: ${unit.status}`);
  const cancelledUnits = detail.changeUnits
    .filter((unit) =>
      [
        GovernanceChangeUnitStatus.Cancelled,
        GovernanceChangeUnitStatus.Exhausted
      ].includes(unit.status)
    )
    .map((unit) => `- ${unit.title}: ${unit.status}`);
  const verificationSummary = detail.verificationResults
    .map((result) => `- ${result.subjectType} ${result.status}: ${result.summary}`)
    .join('\n');

  return [
    `Issue: ${detail.title}`,
    '',
    'Committed Change Units:',
    committedUnits.length > 0 ? committedUnits.join('\n') : '- none',
    '',
    'Cancelled / Unfinished Change Units:',
    cancelledUnits.length > 0 ? cancelledUnits.join('\n') : '- none',
    '',
    'Verification Results:',
    verificationSummary || '- none'
  ].join('\n');
}

function assertAllowedChangeUnitReviewDecision(
  status: GovernanceChangeUnitStatus,
  executionMode: GovernanceExecutionMode,
  decision: Extract<
    GovernanceReviewDecisionType,
    | GovernanceReviewDecisionType.Approved
    | GovernanceReviewDecisionType.Rejected
    | GovernanceReviewDecisionType.Retry
    | GovernanceReviewDecisionType.EditAndContinue
    | GovernanceReviewDecisionType.Skip
    | GovernanceReviewDecisionType.Terminate
  >
) {
  switch (decision) {
    case GovernanceReviewDecisionType.Approved:
    case GovernanceReviewDecisionType.Rejected:
      if (status !== GovernanceChangeUnitStatus.Verified) {
        throw new ConflictException(
          `Change unit review decision "${decision}" requires status "verified".`
        );
      }
      return;
    case GovernanceReviewDecisionType.Retry:
      if (
        ![
          GovernanceChangeUnitStatus.VerificationFailed,
          GovernanceChangeUnitStatus.Exhausted
        ].includes(status)
      ) {
        throw new ConflictException(
          'Change unit retry requires status "verification_failed" or "exhausted".'
        );
      }
      return;
    case GovernanceReviewDecisionType.EditAndContinue:
      if (
        status === GovernanceChangeUnitStatus.Ready &&
        executionMode === GovernanceExecutionMode.Manual
      ) {
        return;
      }
      if (
        ![
          GovernanceChangeUnitStatus.VerificationFailed,
          GovernanceChangeUnitStatus.Exhausted
        ].includes(status)
      ) {
        throw new ConflictException(
          'Change unit edit_and_continue requires a manual ready unit or a failed verification state.'
        );
      }
      return;
    case GovernanceReviewDecisionType.Skip:
    case GovernanceReviewDecisionType.Terminate:
      if (
        [
          GovernanceChangeUnitStatus.Pending,
          GovernanceChangeUnitStatus.Ready
        ].includes(status)
      ) {
        return;
      }
      if (
        ![
          GovernanceChangeUnitStatus.VerificationFailed,
          GovernanceChangeUnitStatus.Exhausted
        ].includes(status)
      ) {
        throw new ConflictException(
          'Change unit skip/terminate requires status "pending", "ready", "verification_failed", or "exhausted".'
        );
      }
      return;
  }
}

function assertAllowedDeliveryArtifactReviewDecision(
  status: GovernanceDeliveryArtifactStatus,
  decision:
    | GovernanceReviewDecisionType.Approved
    | GovernanceReviewDecisionType.Rejected
) {
  if (status !== GovernanceDeliveryArtifactStatus.Submitted) {
    throw new ConflictException(
      `Delivery artifact review decision "${decision}" requires status "submitted".`
    );
  }
}

function resolveDeliveryApprovedIssueStatus(detail: GovernanceIssueDetail) {
  return detail.changeUnits.some((unit) =>
    [
      GovernanceChangeUnitStatus.Cancelled,
      GovernanceChangeUnitStatus.Exhausted
    ].includes(unit.status)
  )
    ? GovernanceIssueStatus.PartiallyResolved
    : GovernanceIssueStatus.Resolved;
}

function getChangeUnitScopeTargets(scope: unknown): GovernanceTargetRef[] {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    return [];
  }

  const targets = (scope as { targets?: unknown }).targets;
  if (!Array.isArray(targets)) {
    return [];
  }

  return targets.filter(
    (target): target is GovernanceTargetRef =>
      Boolean(target) &&
      typeof target === 'object' &&
      !Array.isArray(target) &&
      isGovernanceTargetKind((target as { kind?: unknown }).kind) &&
      typeof (target as { ref?: unknown }).ref === 'string'
  );
}

function uniqueTargets(targets: GovernanceTargetRef[]) {
  return Array.from(
    new Map(
      targets.map((target) => [`${target.kind}:${target.ref}`, target] as const)
    ).values()
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function isGovernanceTargetKind(
  value: unknown
): value is GovernanceTargetRef['kind'] {
  return (
    value === 'repository' ||
    value === 'module' ||
    value === 'package' ||
    value === 'service' ||
    value === 'file' ||
    value === 'component' ||
    value === 'api' ||
    value === 'screen'
  );
}
