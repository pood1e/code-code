import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  GovernanceAssessmentSource,
  GovernanceAutoActionEligibility,
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceChangeUnitStatus,
  GovernanceExecutionAttemptStatus,
  GovernanceExecutionMode,
  GovernanceFindingSource,
  GovernanceIssueStatus,
  GovernanceVerificationResultStatus,
  GovernanceVerificationSubjectType,
  type GovernanceDiscoveredFindingDraft,
  type GovernanceDiscoveryOutput,
  type GovernanceScopeOverview,
  type GovernanceTargetRef,
  type GovernanceVerificationCheck,
  type VerificationPlan,
  type GovernanceIssueSummary,
  type GovernancePlanningOutput,
  type GovernanceTriageOutput,
  type RepositoryProfile
} from '@agent-workbench/shared';

import {
  toFinding,
  toGovernancePolicy,
  toGovernanceIssueDetail,
  toGovernanceIssueSummary,
  toGovernanceScopeOverview
} from './governance.mapper';
import {
  buildFindingFingerprint,
  getChangeUnitScope,
  getChangeUnitScopeTargets,
  getStringArray,
  getVerificationChecks,
  sleep,
  toRepositoryProfile,
  toVerificationPlan
} from './governance-automation.support';
import { GovernanceAutomationAttemptService } from './governance-automation-attempt.service';
import { GovernanceBaselineService } from './governance-baseline.service';
import { GovernanceGitService } from './governance-git.service';
import { GovernancePolicyEvaluatorService } from './governance-policy-evaluator.service';
import { GovernancePromptService } from './governance-prompt.service';
import {
  GovernanceRepository,
  type RepositoryProfileRecord
} from './governance.repository';
import { GovernanceRunnerBridgeService } from './governance-runner-bridge.service';
import { GovernanceRunnerResolverService } from './governance-runner-resolver.service';
import { GovernanceVerificationRunnerService } from './governance-verification-runner.service';
import { GovernanceWorkspaceService } from './governance-workspace.service';

@Injectable()
export class GovernanceAutomationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private static readonly POLL_INTERVAL_MS = 1_000;
  private static readonly LEASE_MS = 5 * 60_000;
  private static readonly MAX_AUTO_RETRIES = 2;

  private readonly logger = new Logger(GovernanceAutomationService.name);
  private readonly ownerId = `governance-worker:${randomUUID()}`;
  private isRunning = false;

  constructor(
    private readonly governanceRepository: GovernanceRepository,
    private readonly governanceRunnerResolver: GovernanceRunnerResolverService,
    private readonly governanceRunnerBridge: GovernanceRunnerBridgeService,
    private readonly governanceAutomationAttempt: GovernanceAutomationAttemptService,
    private readonly governancePromptService: GovernancePromptService,
    private readonly governancePolicyEvaluator: GovernancePolicyEvaluatorService,
    private readonly governanceBaselineService: GovernanceBaselineService,
    private readonly governanceGitService: GovernanceGitService,
    private readonly governanceVerificationRunner: GovernanceVerificationRunnerService,
    private readonly governanceWorkspaceService: GovernanceWorkspaceService
  ) {}

  onApplicationBootstrap() {
    if (process.env.GOVERNANCE_AUTO_START === 'false') {
      return;
    }

    this.isRunning = true;
    void this.bootstrapAndPoll();
  }

  onApplicationShutdown() {
    this.isRunning = false;
  }

  async recoverInterruptedAutomationOnBoot() {
    return this.governanceRepository.recoverInterruptedAutomation(new Date());
  }

  async refreshRepositoryProfile(scopeId: string) {
    return this.runBaselineCycle(scopeId);
  }

  async runDiscovery(scopeId: string) {
    return this.runDiscoveryCycle(scopeId);
  }

  async runBaselineCycle(scopeId?: string) {
    const scopes = scopeId
      ? await this.loadSingleScope(scopeId)
      : await this.governanceRepository.listGovernanceScopes();
    if (scopes.length === 0) {
      return false;
    }

    for (const scope of scopes) {
      const processed = await this.processBaselineScope(scope, Boolean(scopeId));
      if (processed) {
        return true;
      }
    }

    return false;
  }

  async runDiscoveryCycle(scopeId?: string) {
    const scopes = scopeId
      ? await this.loadSingleScope(scopeId)
      : await this.governanceRepository.listGovernanceScopes();
    if (scopes.length === 0) {
      return false;
    }

    for (const scope of scopes) {
      const runnerId = await this.resolveConfiguredRunnerId(
        scope.id,
        GovernanceAutomationStage.Discovery
      );
      if (!runnerId) {
        continue;
      }
      const processed = await this.processDiscoveryScope(scope.id, runnerId, Boolean(scopeId));
      if (processed) {
        return true;
      }
    }

    return false;
  }

  async runTriageCycle() {
    const scopes = await this.governanceRepository.listGovernanceScopes();
    if (scopes.length === 0) {
      return false;
    }

    for (const scope of scopes) {
      const runnerId = await this.resolveConfiguredRunnerId(
        scope.id,
        GovernanceAutomationStage.Triage
      );
      if (!runnerId) {
        continue;
      }

      const finding = await this.governanceRepository.claimNextPendingFinding({
        scopeId: scope.id,
        ownerLeaseToken: this.ownerId,
        ...this.createLeaseWindow()
      });
      if (!finding) {
        continue;
      }

      try {
        return this.processTriageFinding(finding, runnerId);
      } finally {
        await this.governanceRepository.releaseFindingLease({
          findingId: finding.id,
          ownerLeaseToken: this.ownerId
        });
      }
    }

    return false;
  }

  async runPlanningCycle() {
    const scopes = await this.governanceRepository.listGovernanceScopes();
    if (scopes.length === 0) {
      return false;
    }

    for (const scope of scopes) {
      const runnerId = await this.resolveConfiguredRunnerId(
        scope.id,
        GovernanceAutomationStage.Planning
      );
      if (!runnerId) {
        continue;
      }

      const issue = await this.governanceRepository.claimNextPlanningIssue({
        scopeId: scope.id,
        ownerLeaseToken: this.ownerId,
        ...this.createLeaseWindow()
      });
      if (!issue) {
        continue;
      }

      try {
        return this.processPlanningIssue(issue, runnerId);
      } finally {
        await this.governanceRepository.releaseIssueLease({
          issueId: issue.id,
          ownerLeaseToken: this.ownerId
        });
      }
    }

    return false;
  }

  async runExecutionCycle() {
    const scopes = await this.governanceRepository.listGovernanceScopes();
    if (scopes.length === 0) {
      return false;
    }

    for (const scope of scopes) {
      const runnerId = await this.resolveConfiguredRunnerId(
        scope.id,
        GovernanceAutomationStage.Execution
      );
      if (!runnerId) {
        continue;
      }

      const changeUnit = await this.governanceRepository.claimNextExecutableChangeUnit({
        scopeId: scope.id,
        ownerLeaseToken: this.ownerId,
        ...this.createLeaseWindow()
      });
      if (!changeUnit) {
        continue;
      }

      try {
        return this.processExecutionChangeUnit(changeUnit.id, runnerId);
      } finally {
        await this.governanceRepository.releaseChangeUnitLease({
          changeUnitId: changeUnit.id,
          ownerLeaseToken: this.ownerId
        });
      }
    }

    return false;
  }

  private async bootstrapAndPoll() {
    await this.recoverInterruptedAutomationOnBoot();

    while (this.isRunning) {
      await this.governanceRepository.wakeDeferredIssues(new Date()).catch((error) => {
        this.logger.error(
          `Governance deferred wake failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return 0;
      });
      const baselineProcessed = await this.runBaselineCycle().catch((error) => {
        this.logger.error(
          `Governance baseline cycle failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return false;
      });
      const discoveryProcessed = await this.runDiscoveryCycle().catch((error) => {
        this.logger.error(
          `Governance discovery cycle failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return false;
      });
      const triageProcessed = await this.runTriageCycle().catch((error) => {
        this.logger.error(
          `Governance triage cycle failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return false;
      });
      const planningProcessed = await this.runPlanningCycle().catch((error) => {
        this.logger.error(
          `Governance planning cycle failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return false;
      });

      const executionProcessed = await this.runExecutionCycle().catch((error) => {
        this.logger.error(
          `Governance execution cycle failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return false;
      });

      if (
        !baselineProcessed &&
        !discoveryProcessed &&
        !triageProcessed &&
        !planningProcessed &&
        !executionProcessed
      ) {
        await sleep(GovernanceAutomationService.POLL_INTERVAL_MS);
      }
    }
  }

  private async processBaselineScope(
    scope: { id: string; repoGitUrl: string; workspaceRootPath: string },
    isTargetedRun: boolean
  ) {
    const latestProfile =
      await this.governanceRepository.getLatestRepositoryProfile(scope.id);
    const latestAttempt =
      await this.governanceRepository.findLatestAutomationAttempt({
        stageType: GovernanceAutomationStage.Baseline,
        subjectType: GovernanceAutomationSubjectType.Scope,
        subjectId: scope.id
      });

    if (
      !isTargetedRun &&
      latestProfile &&
      latestAttempt?.status === GovernanceExecutionAttemptStatus.Succeeded
    ) {
      return false;
    }

    if (this.governanceAutomationAttempt.isAttemptBusy(latestAttempt)) {
      return false;
    }

    const attempt = await this.governanceAutomationAttempt.claimOrCreateAttempt({
      stageType: GovernanceAutomationStage.Baseline,
      subjectType: GovernanceAutomationSubjectType.Scope,
      subjectId: scope.id,
      scopeId: scope.id,
      ownerLeaseToken: this.ownerId,
      maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
      createLeaseWindow: () => this.createLeaseWindow(),
      inputSnapshotBuilder: (attemptNo) => ({
        scopeId: scope.id,
        repoGitUrl: scope.repoGitUrl,
        workspaceRootPath: scope.workspaceRootPath,
        attemptNo
      })
    });
    if (!attempt) {
      return false;
    }

    try {
      if (
        !(await this.governanceAutomationAttempt.markAttemptRunningIfPending({
          attempt,
          ownerLeaseToken: this.ownerId,
          createLeaseWindow: () => this.createLeaseWindow()
        }))
      ) {
        return false;
      }

      const snapshot = await this.governanceBaselineService.buildRepositoryProfile(
        (
          await this.governanceWorkspaceService.ensureCodeWorkspace(scope)
        ).repositoryPath
      );
      await this.governanceRepository.createRepositoryProfileSnapshot({
        scopeId: scope.id,
        branch: snapshot.branch,
        snapshotAt: snapshot.snapshotAt,
        modules: snapshot.modules,
        testBaseline: snapshot.testBaseline,
        buildStatus: snapshot.buildStatus,
        metadata: snapshot.metadata
      });
      await this.governanceRepository.markAutomationAttemptSucceeded({
        attemptId: attempt.id,
        ownerLeaseToken: this.ownerId,
        activeRequestMessageId: null,
        parsedOutput: snapshot
      });
      return true;
    } catch (error) {
      await this.governanceRepository.markAutomationAttemptFailed({
        attemptId: attempt.id,
        ownerLeaseToken: this.ownerId,
        failureCode: 'BASELINE_FAILED',
        failureMessage: error instanceof Error ? error.message : String(error),
        needsHumanReview:
          attempt.attemptNo >= GovernanceAutomationService.MAX_AUTO_RETRIES + 1
      });
      if (isTargetedRun) {
        throw error;
      }
      return false;
    } finally {
      await this.governanceRepository.releaseAutomationAttemptLease({
        attemptId: attempt.id,
        ownerLeaseToken: this.ownerId
      });
    }
  }

  private async processDiscoveryScope(
    scopeId: string,
    runnerId: string,
    isTargetedRun: boolean
  ) {
    let repositoryProfileRecord =
      await this.governanceRepository.getLatestRepositoryProfile(scopeId);
    if (!repositoryProfileRecord) {
      await this.runBaselineCycle(scopeId);
      repositoryProfileRecord =
        await this.governanceRepository.getLatestRepositoryProfile(scopeId);
    }
    if (!repositoryProfileRecord) {
      return false;
    }

    const latestAttempt =
      await this.governanceRepository.findLatestAutomationAttempt({
        stageType: GovernanceAutomationStage.Discovery,
        subjectType: GovernanceAutomationSubjectType.Scope,
        subjectId: scopeId
      });
    if (this.governanceAutomationAttempt.isAttemptBusy(latestAttempt)) {
      return false;
    }

    if (
      !isTargetedRun &&
      latestAttempt?.status === GovernanceExecutionAttemptStatus.Succeeded &&
      latestAttempt.updatedAt >= repositoryProfileRecord.updatedAt
    ) {
      return false;
    }

    const repositoryProfile = toRepositoryProfile(repositoryProfileRecord);
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      scopeId
    );
    const candidateIssues = (
      await this.governanceRepository.listIssues({ scopeId })
    ).map(toGovernanceIssueSummary);
    const overviewRecord = await this.governanceRepository.getScopeOverview(scopeId);
    if (!overviewRecord) {
      return false;
    }
    const overview = toGovernanceScopeOverview(overviewRecord);

    const attempt = await this.governanceAutomationAttempt.claimOrCreateAttempt({
      stageType: GovernanceAutomationStage.Discovery,
      subjectType: GovernanceAutomationSubjectType.Scope,
      subjectId: scopeId,
      scopeId,
      ownerLeaseToken: this.ownerId,
      maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
      createLeaseWindow: () => this.createLeaseWindow(),
      inputSnapshotBuilder: (attemptNo) =>
        this.governancePromptService.buildDiscoveryPrompt({
          scopeId,
          repositoryProfile,
          candidateIssues,
          overview,
          policy: toGovernancePolicy(policy),
          attemptNo
        }).inputSnapshot
    });
    if (!attempt) {
      return false;
    }

    const prompt = this.governancePromptService.buildDiscoveryPrompt({
      scopeId,
      repositoryProfile,
      candidateIssues,
      overview,
      policy: toGovernancePolicy(policy),
      attemptNo: attempt.attemptNo
    });

    return this.governanceAutomationAttempt.runAgentAttempt({
      stageType: GovernanceAutomationStage.Discovery,
      scopeId,
      runnerId,
      attempt,
      prompt: prompt.prompt,
      ownerLeaseToken: this.ownerId,
      maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
      createLeaseWindow: () => this.createLeaseWindow(),
      onSuccess: async (parsedOutput) => {
        const discoveryOutput = parsedOutput as GovernanceDiscoveryOutput;
        for (const finding of discoveryOutput.findings) {
          await this.createDiscoveredFinding(scopeId, finding);
        }
      }
    });
  }

  private async processTriageFinding(
    finding: Awaited<ReturnType<GovernanceRepository['claimNextPendingFinding']>> & {}
      & NonNullable<Awaited<ReturnType<GovernanceRepository['claimNextPendingFinding']>>>,
    runnerId: string
  ) {
    const repositoryProfileRecord =
      await this.governanceRepository.getLatestRepositoryProfile(finding.scopeId);
    const repositoryProfile = repositoryProfileRecord
      ? toRepositoryProfile(repositoryProfileRecord)
      : null;
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      finding.scopeId
    );
    const candidateIssues = (
      await this.governanceRepository.listIssues({ scopeId: finding.scopeId })
    ).map(toGovernanceIssueSummary);
    const attempt = await this.governanceAutomationAttempt.claimOrCreateAttempt({
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectId: finding.id,
      scopeId: finding.scopeId,
      ownerLeaseToken: this.ownerId,
      maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
      createLeaseWindow: () => this.createLeaseWindow(),
      inputSnapshotBuilder: (attemptNo) =>
        this.governancePromptService.buildTriagePrompt({
          finding: toFinding(finding),
          scopeId: finding.scopeId,
          candidateIssues,
          repositoryProfile,
          policy: toGovernancePolicy(policy),
          attemptNo
        }).inputSnapshot
    });
    if (!attempt) {
      return false;
    }

    const prompt = this.governancePromptService.buildTriagePrompt({
      finding: toFinding(finding),
      scopeId: finding.scopeId,
      candidateIssues,
      repositoryProfile,
      policy: toGovernancePolicy(policy),
      attemptNo: attempt.attemptNo
    });

    return this.governanceAutomationAttempt.runAgentAttempt({
      stageType: GovernanceAutomationStage.Triage,
      scopeId: finding.scopeId,
      runnerId,
      attempt,
      prompt: prompt.prompt,
      ownerLeaseToken: this.ownerId,
      maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
      createLeaseWindow: () => this.createLeaseWindow(),
      onSuccess: async (parsedOutput) => {
        const triageOutput = parsedOutput as GovernanceTriageOutput;
        if (triageOutput.action === 'create_issue') {
          const normalizedAssessment =
            this.governancePolicyEvaluator.normalizeAssessment({
              policy: toGovernancePolicy(policy),
              issueKind: triageOutput.issue.kind,
              assessment: {
                ...triageOutput.assessment,
                assessedBy: GovernanceAssessmentSource.Agent
              }
            });
          await this.governanceRepository.applyTriageCreateIssue({
            findingId: finding.id,
            scopeId: finding.scopeId,
            expectedFindingVersion: finding.version,
            issue: triageOutput.issue,
            assessment: normalizedAssessment
          });
          return;
        }

        const targetIssue =
          candidateIssues.find((issue) => issue.id === triageOutput.targetIssueId) ??
          (await this.governanceRepository.findIssueById(
            triageOutput.targetIssueId
          ));
        if (!targetIssue) {
          throw new Error(`Issue not found: ${triageOutput.targetIssueId}`);
        }

        await this.governanceRepository.applyTriageMerge({
          findingId: finding.id,
          expectedFindingVersion: finding.version,
          targetIssueId: triageOutput.targetIssueId,
          clusterBasis: triageOutput.clusterBasis,
          assessmentRefresh: triageOutput.assessmentRefresh
            ? this.governancePolicyEvaluator.normalizeAssessment({
                policy: toGovernancePolicy(policy),
                issueKind: targetIssue.kind,
                assessment: {
                  ...triageOutput.assessmentRefresh,
                  assessedBy: GovernanceAssessmentSource.Agent
                }
              })
            : undefined
        });
      }
    });
  }

  private async processPlanningIssue(
    issue: NonNullable<Awaited<ReturnType<GovernanceRepository['claimNextPlanningIssue']>>>,
    runnerId: string
  ) {
    const project = await this.governanceRepository.getProjectSource(issue.scopeId);
    if (!project) {
      return false;
    }
    const workspace =
      await this.governanceWorkspaceService.ensureCodeWorkspace(project);

    const baselineCommitSha = await this.governanceBaselineService.resolveHeadCommitSha(
      workspace.repositoryPath
    );
    const repositoryProfileRecord =
      await this.governanceRepository.getLatestRepositoryProfile(issue.scopeId);
    const repositoryProfile = repositoryProfileRecord
      ? toRepositoryProfile(repositoryProfileRecord)
      : null;
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      issue.scopeId
    );
    const issueDetailRecord = await this.governanceRepository.getIssueDetail(issue.id);
    if (!issueDetailRecord) {
      return false;
    }
    const issueDetail = toGovernanceIssueDetail(issueDetailRecord);
    const attempt = await this.governanceAutomationAttempt.claimOrCreateAttempt({
      stageType: GovernanceAutomationStage.Planning,
      subjectType: GovernanceAutomationSubjectType.Issue,
      subjectId: issue.id,
      scopeId: issue.scopeId,
      ownerLeaseToken: this.ownerId,
      maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
      createLeaseWindow: () => this.createLeaseWindow(),
      inputSnapshotBuilder: (attemptNo) =>
        this.governancePromptService.buildPlanningPrompt({
          issue: issueDetail,
          repositoryProfile,
          policy: toGovernancePolicy(policy),
          baselineCommitSha,
          attemptNo
        }).inputSnapshot
    });
    if (!attempt) {
      return false;
    }

    if (!issueDetail.latestAssessment) {
      await this.governanceRepository.markAutomationAttemptFailed({
        attemptId: attempt.id,
        ownerLeaseToken: this.ownerId,
        failureCode: 'PLANNING_ASSESSMENT_MISSING',
        failureMessage:
          'Planning requires an issue assessment before automation can continue.',
        needsHumanReview: true
      });
      return false;
    }

    const effectiveEligibility =
      this.governancePolicyEvaluator.deriveAutoActionEligibility({
        policy: toGovernancePolicy(policy),
        issueKind: issueDetail.kind,
        severity: issueDetail.latestAssessment.severity
      });
    if (effectiveEligibility === GovernanceAutoActionEligibility.Forbidden) {
      await this.governanceRepository.markAutomationAttemptFailed({
        attemptId: attempt.id,
        ownerLeaseToken: this.ownerId,
        failureCode: 'PLANNING_BLOCKED_BY_POLICY',
        failureMessage:
          'Planning automation is blocked by the current governance policy.',
        needsHumanReview: true
      });
      return false;
    }

    const prompt = this.governancePromptService.buildPlanningPrompt({
      issue: issueDetail,
      repositoryProfile,
      policy: toGovernancePolicy(policy),
      baselineCommitSha,
      attemptNo: attempt.attemptNo
    });

    return this.governanceAutomationAttempt.runAgentAttempt({
      stageType: GovernanceAutomationStage.Planning,
      scopeId: issue.scopeId,
      runnerId,
      attempt,
      prompt: prompt.prompt,
      ownerLeaseToken: this.ownerId,
      maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
      createLeaseWindow: () => this.createLeaseWindow(),
      onSuccess: async (parsedOutput) => {
        const planningOutput = this.governancePolicyEvaluator.normalizePlanningOutput(
          {
            policy: toGovernancePolicy(policy),
            issueKind: issueDetail.kind,
            severity: issueDetail.latestAssessment!.severity,
            output: parsedOutput as GovernancePlanningOutput
          }
        );
        await this.governanceRepository.createPlanningBundleFromAutomation({
          issueId: issue.id,
          objective: planningOutput.objective,
          strategy: planningOutput.strategy,
          affectedTargets: planningOutput.affectedTargets,
          proposedActions: planningOutput.proposedActions,
          risks: planningOutput.risks,
          rollbackPlan: planningOutput.rollbackPlan ?? null,
          assumptions: planningOutput.assumptions ?? null,
          baselineCommitSha,
          changeUnits: planningOutput.changeUnits.map((unit) => ({
            sourceActionId: unit.sourceActionId,
            dependsOnUnitIds: unit.dependsOnUnitIds ?? [],
            title: unit.title,
            description: unit.description,
            scope: unit.scope,
            executionMode: unit.executionMode ?? GovernanceExecutionMode.SemiAuto,
            maxRetries: unit.maxRetries ?? 1,
            currentAttemptNo: 0,
            status: GovernanceChangeUnitStatus.Pending,
            producedCommitIds: []
          })),
          verificationPlans: planningOutput.verificationPlans
        });
      }
    });
  }

  private async processExecutionChangeUnit(
    changeUnitId: string,
    runnerId: string
  ) {
    const context =
      await this.governanceRepository.getChangeUnitExecutionContext(changeUnitId);
    if (!context) {
      return false;
    }
    const workspace =
      await this.governanceWorkspaceService.ensureCodeWorkspace(context.project);
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      context.scopeId
    );

    const hasDrift = await this.governanceGitService.hasTargetedBaselineDrift({
      workspacePath: workspace.repositoryPath,
      baselineCommitSha: context.changePlan.baselineCommitSha,
      targets: getChangeUnitScopeTargets(context.changeUnit.scope)
    });
    if (hasDrift) {
      await this.governanceRepository.updateChangeUnitExecutionState({
        changeUnitId: context.changeUnit.id,
        status: GovernanceChangeUnitStatus.Exhausted
      });
      await this.governanceRepository.updateIssueState({
        issueId: context.issue.id,
        status: GovernanceIssueStatus.Blocked
      });
      return false;
    }

    await this.governanceRepository.updateIssueState({
      issueId: context.issue.id,
      status: GovernanceIssueStatus.InProgress
    });

    const attempt = await this.governanceAutomationAttempt.claimOrCreateAttempt({
      stageType: GovernanceAutomationStage.Execution,
      subjectType: GovernanceAutomationSubjectType.ChangeUnit,
      subjectId: context.changeUnit.id,
      scopeId: context.scopeId,
      ownerLeaseToken: this.ownerId,
      maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
      createLeaseWindow: () => this.createLeaseWindow(),
      inputSnapshotBuilder: (attemptNo) =>
        this.governancePromptService.buildExecutionPrompt({
          issue: context.issue,
          changePlan: context.changePlan,
          changeUnit: context.changeUnit,
          policy: toGovernancePolicy(policy),
          baselineCommitSha: context.changePlan.baselineCommitSha,
          attemptNo
        }).inputSnapshot
    });
    if (!attempt) {
      return false;
    }

    if (
      !(await this.governanceAutomationAttempt.markAttemptRunningIfPending({
        attempt,
        ownerLeaseToken: this.ownerId,
        createLeaseWindow: () => this.createLeaseWindow()
      }))
    ) {
      return false;
    }

    const currentAttemptNo = context.changeUnit.currentAttemptNo + 1;
    const markedRunningUnit = await this.governanceRepository.updateChangeUnitExecutionState({
      changeUnitId: context.changeUnit.id,
      status: GovernanceChangeUnitStatus.Running,
      currentAttemptNo,
      ownerLeaseToken: this.ownerId,
      leaseExpiresAt: this.createLeaseWindow().leaseExpiresAt
    });
    if (!markedRunningUnit) {
      return false;
    }

    const prompt = this.governancePromptService.buildExecutionPrompt({
      issue: context.issue,
      changePlan: context.changePlan,
      changeUnit: context.changeUnit,
      policy: toGovernancePolicy(policy),
      baselineCommitSha: context.changePlan.baselineCommitSha,
      attemptNo: currentAttemptNo
    });

    const session =
      attempt.sessionId && attempt.activeRequestMessageId
        ? {
            sessionId: attempt.sessionId,
            messageId: attempt.activeRequestMessageId
          }
        : await this.governanceRunnerBridge.createSessionAndSendPrompt({
            scopeId: context.scopeId,
            runnerId,
            prompt: prompt.prompt
          });

    if (!attempt.sessionId) {
      const attached = await this.governanceRepository.attachAutomationAttemptSession({
        attemptId: attempt.id,
        ownerLeaseToken: this.ownerId,
        sessionId: session.sessionId,
        activeRequestMessageId: session.messageId
      });
      if (!attached) {
        return false;
      }
    }

    const result = await this.governanceRunnerBridge.waitForResult(
      session.sessionId,
      session.messageId
    );
    if (result.status !== 'completed') {
      return this.handleExecutionAgentFailure({
        context,
        attemptId: attempt.id,
        currentAttemptNo,
        result
      });
    }

    const markedSucceeded = await this.governanceRepository.markAutomationAttemptSucceeded({
      attemptId: attempt.id,
      ownerLeaseToken: this.ownerId,
      activeRequestMessageId: result.messageId,
      candidateOutput: result.outputText,
      parsedOutput: null
    });
    if (!markedSucceeded) {
      return false;
    }

    const scopedDiff = await this.governanceGitService.collectScopedDiff({
      workspacePath: workspace.repositoryPath,
      targets: getChangeUnitScopeTargets(context.changeUnit.scope)
    });
    if (!this.isDiffWithinScope(context.changeUnit, scopedDiff)) {
      const scope = getChangeUnitScope(context.changeUnit.scope);
      await this.governanceRepository.updateChangeUnitExecutionState({
        changeUnitId: context.changeUnit.id,
        status:
          scope.violationPolicy === 'fail'
            ? GovernanceChangeUnitStatus.Exhausted
            : GovernanceChangeUnitStatus.VerificationFailed
      });
      await this.governanceRepository.updateIssueState({
        issueId: context.issue.id,
        status: GovernanceIssueStatus.Blocked
      });
      return false;
    }

    if (!context.unitVerificationPlan) {
      await this.governanceRepository.updateChangeUnitExecutionState({
        changeUnitId: context.changeUnit.id,
        status: GovernanceChangeUnitStatus.Verified
      });
      await this.reconcileIssueAfterUnitVerification(context.issue.id);
      return true;
    }

    const verificationResult = await this.governanceVerificationRunner.runPlan({
      workspacePath: workspace.repositoryPath,
      plan: toVerificationPlan(context.unitVerificationPlan)
    });

    await this.governanceRepository.createVerificationResult({
      verificationPlanId: context.unitVerificationPlan.id,
      subjectType: GovernanceVerificationSubjectType.ChangeUnit,
      changeUnitId: context.changeUnit.id,
      changePlanId: context.changePlan.id,
      issueId: context.issue.id,
      executionAttemptNo: currentAttemptNo,
      status: verificationResult.status,
      checkResults: verificationResult.checkResults,
      summary: verificationResult.summary
    });

    const nextStatus =
      verificationResult.status === GovernanceVerificationResultStatus.Passed
        ? GovernanceChangeUnitStatus.Verified
        : currentAttemptNo > context.changeUnit.maxRetries
          ? GovernanceChangeUnitStatus.Exhausted
          : GovernanceChangeUnitStatus.VerificationFailed;
    await this.governanceRepository.updateChangeUnitExecutionState({
      changeUnitId: context.changeUnit.id,
      status: nextStatus
    });

    if (nextStatus === GovernanceChangeUnitStatus.Verified) {
      await this.reconcileIssueAfterUnitVerification(context.issue.id);
      return true;
    }

    await this.governanceRepository.updateIssueState({
      issueId: context.issue.id,
      status: GovernanceIssueStatus.Blocked
    });
    return false;
  }

  private async handleExecutionAgentFailure(input: {
    context: NonNullable<
      Awaited<ReturnType<GovernanceRepository['getChangeUnitExecutionContext']>>
    >;
    attemptId: string;
    currentAttemptNo: number;
    result: Exclude<
      Awaited<ReturnType<GovernanceRunnerBridgeService['waitForResult']>>,
      { status: 'completed' }
    >;
  }) {
    await this.governanceRepository.markAutomationAttemptFailed({
      attemptId: input.attemptId,
      ownerLeaseToken: this.ownerId,
      failureCode:
        input.result.status === 'timeout' ? 'EXECUTION_TIMEOUT' : input.result.code,
      failureMessage:
        input.result.status === 'timeout'
          ? 'Execution stage timed out'
          : input.result.message,
      candidateOutput:
        input.result.status === 'error' ? input.result.outputText : undefined,
      needsHumanReview: input.currentAttemptNo > input.context.changeUnit.maxRetries
    });
    await this.governanceRepository.updateChangeUnitExecutionState({
      changeUnitId: input.context.changeUnit.id,
      status:
        input.currentAttemptNo > input.context.changeUnit.maxRetries
          ? GovernanceChangeUnitStatus.Exhausted
          : GovernanceChangeUnitStatus.VerificationFailed
    });
    await this.governanceRepository.updateIssueState({
      issueId: input.context.issue.id,
      status: GovernanceIssueStatus.Blocked
    });
    return false;
  }

  private async createDiscoveredFinding(
    scopeId: string,
    finding: GovernanceDiscoveredFindingDraft
  ) {
    const fingerprint = buildFindingFingerprint(scopeId, finding);
    const existing = await this.governanceRepository.findFindingByFingerprint(
      scopeId,
      fingerprint
    );
    if (existing) {
      return existing;
    }

    return this.governanceRepository.createFinding({
      scopeId,
      source: finding.source ?? GovernanceFindingSource.AgentReview,
      sourceRef: finding.sourceRef,
      title: finding.title,
      summary: finding.summary,
      evidence: finding.evidence,
      categories: finding.categories,
      tags: finding.tags ?? [],
      severityHint: finding.severityHint,
      confidence: finding.confidence,
      affectedTargets: finding.affectedTargets,
      metadata: finding.metadata,
      fingerprint,
      discoveredAt: new Date()
    });
  }

  private async loadSingleScope(scopeId: string) {
    const scope = await this.governanceRepository.getProjectSource(scopeId);
    return scope ? [scope] : [];
  }

  private isDiffWithinScope(
    changeUnit: { scope: unknown },
    scopedDiff: { changedFiles: string[]; totalDiffLines: number }
  ) {
    const scope = getChangeUnitScope(changeUnit.scope);
    if (scopedDiff.changedFiles.length === 0) {
      return false;
    }
    if (
      scope.maxFiles !== undefined &&
      scopedDiff.changedFiles.length > scope.maxFiles
    ) {
      return scope.violationPolicy !== 'fail';
    }
    if (
      scope.maxDiffLines !== undefined &&
      scopedDiff.totalDiffLines > scope.maxDiffLines
    ) {
      return scope.violationPolicy !== 'fail';
    }
    return true;
  }

  private async reconcileIssueAfterUnitVerification(issueId: string) {
    const detail = await this.governanceRepository.getIssueDetail(issueId);
    if (!detail || !detail.changePlan) {
      return;
    }

    const activeUnits = detail.changeUnits.filter(
      (unit) => unit.status !== GovernanceChangeUnitStatus.Cancelled
    );
    const allActiveVerified =
      activeUnits.length > 0 &&
      activeUnits.every((unit) => unit.status === GovernanceChangeUnitStatus.Verified);
    if (!allActiveVerified) {
      return;
    }

    const planVerificationPlan =
      detail.verificationPlans.find(
        (plan) =>
          plan.subjectType === GovernanceVerificationSubjectType.ChangePlan &&
          plan.changePlanId === detail.changePlan?.id
      ) ?? null;
    if (!planVerificationPlan) {
      await this.governanceRepository.updateIssueState({
        issueId,
        status: GovernanceIssueStatus.InReview
      });
      return;
    }

    const project = await this.governanceRepository.getProjectSource(detail.scopeId);
    if (!project) {
      return;
    }
    const workspace =
      await this.governanceWorkspaceService.ensureCodeWorkspace(project);
    const planVerification = await this.governanceVerificationRunner.runPlan({
      workspacePath: workspace.repositoryPath,
      plan: toVerificationPlan(planVerificationPlan)
    });
    await this.governanceRepository.createVerificationResult({
      verificationPlanId: planVerificationPlan.id,
      subjectType: GovernanceVerificationSubjectType.ChangePlan,
      changePlanId: detail.changePlan.id,
      issueId,
      executionAttemptNo: 1,
      status: planVerification.status,
      checkResults: planVerification.checkResults,
      summary: planVerification.summary
    });
    await this.governanceRepository.updateIssueState({
      issueId,
      status:
        planVerification.status === GovernanceVerificationResultStatus.Passed
          ? GovernanceIssueStatus.InReview
          : GovernanceIssueStatus.IntegrationFailed
    });
  }

  private createLeaseWindow() {
    const now = new Date();
    return {
      now,
      leaseExpiresAt: new Date(now.getTime() + GovernanceAutomationService.LEASE_MS)
    };
  }

  private resolveConfiguredRunnerId(
    scopeId: string,
    stageType: GovernanceAutomationStage
  ) {
    return this.governanceRunnerResolver.resolveRunnerId({
      scopeId,
      stageType
    });
  }
}
