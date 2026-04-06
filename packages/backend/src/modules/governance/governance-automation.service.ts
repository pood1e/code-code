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
  GovernanceAgentMergeStrategy,
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
  type GovernancePolicy,
  type GovernanceStageAgentStrategy,
  type GovernanceTriageOutput,
  NotificationSeverity,
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
import {
  GovernanceAgentFanoutService,
  type GovernanceFanoutSuccessCandidate
} from './governance-agent-fanout.service';
import { GovernanceAutomationAttemptService } from './governance-automation-attempt.service';
import { GovernanceBaselineService } from './governance-baseline.service';
import { GovernanceGitService } from './governance-git.service';
import { GovernanceNotificationService } from './governance-notification.service';
import { GovernancePolicyEvaluatorService } from './governance-policy-evaluator.service';
import { GovernancePromptService } from './governance-prompt.service';
import {
  GovernanceRepository,
  type GovernanceExecutionAttemptRecord,
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
    private readonly governanceAgentFanout: GovernanceAgentFanoutService,
    private readonly governanceAutomationAttempt: GovernanceAutomationAttemptService,
    private readonly governancePromptService: GovernancePromptService,
    private readonly governancePolicyEvaluator: GovernancePolicyEvaluatorService,
    private readonly governanceBaselineService: GovernanceBaselineService,
    private readonly governanceGitService: GovernanceGitService,
    private readonly governanceNotification: GovernanceNotificationService,
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
      const agentStrategy = await this.resolveConfiguredAgentStrategy(
        scope.id,
        GovernanceAutomationStage.Discovery
      );
      if (!agentStrategy) {
        continue;
      }
      const processed = await this.processDiscoveryScope(
        scope.id,
        agentStrategy,
        Boolean(scopeId)
      );
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
      const agentStrategy = await this.resolveConfiguredAgentStrategy(
        scope.id,
        GovernanceAutomationStage.Triage
      );
      if (!agentStrategy) {
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
        return this.processTriageFinding(finding, agentStrategy);
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
      const agentStrategy = await this.resolveConfiguredAgentStrategy(
        scope.id,
        GovernanceAutomationStage.Planning
      );
      if (!agentStrategy) {
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
        return this.processPlanningIssue(issue, agentStrategy);
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
      const agentStrategy = await this.resolveConfiguredAgentStrategy(
        scope.id,
        GovernanceAutomationStage.Execution
      );
      if (!agentStrategy) {
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
        return this.processExecutionChangeUnit(
          changeUnit.id,
          agentStrategy.runnerIds[0] ?? null
        );
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
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      scope.id
    );
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
          await this.governanceWorkspaceService.ensureCodeWorkspace(
            scope,
            policy.sourceSelection
          )
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
      const markedSucceeded =
        await this.governanceRepository.markAutomationAttemptSucceeded({
        attemptId: attempt.id,
        ownerLeaseToken: this.ownerId,
        activeRequestMessageId: null,
        parsedOutput: snapshot
      });
      if (markedSucceeded) {
        await this.governanceNotification.notifyBaselineSucceeded({
          scopeId: scope.id,
          attemptId: attempt.id,
          attemptNo: attempt.attemptNo,
          sessionId: attempt.sessionId,
          branch: snapshot.branch
        });
      }
      return true;
    } catch (error) {
      const needsHumanReview =
        attempt.attemptNo >= GovernanceAutomationService.MAX_AUTO_RETRIES + 1;
      await this.governanceRepository.markAutomationAttemptFailed({
        attemptId: attempt.id,
        ownerLeaseToken: this.ownerId,
        failureCode: 'BASELINE_FAILED',
        failureMessage: error instanceof Error ? error.message : String(error),
        needsHumanReview
      });
      if (needsHumanReview) {
        await this.governanceNotification.notifyAttemptNeedsHumanReview({
          type: 'governance.baseline.needs_human_review',
          scopeId: scope.id,
          title: '治理 Baseline 需要人工处理',
          body: '仓库画像生成失败，已进入人工处理队列。',
          severity: NotificationSeverity.Warning,
          stageType: GovernanceAutomationStage.Baseline,
          subjectType: GovernanceAutomationSubjectType.Scope,
          subjectId: scope.id,
          attemptId: attempt.id,
          attemptNo: attempt.attemptNo,
          sessionId: attempt.sessionId,
          failureCode: 'BASELINE_FAILED',
          failureMessage: error instanceof Error ? error.message : String(error)
        });
      }
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
    agentStrategy: GovernanceStageAgentStrategy,
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

    const runAttempt = this.createAgentAttemptRunner(
      GovernanceAutomationStage.Discovery,
      scopeId,
      agentStrategy,
      attempt,
      prompt.prompt,
      async (parsedOutput) => {
        const discoveryOutput = parsedOutput as GovernanceDiscoveryOutput;
        for (const finding of discoveryOutput.findings) {
          await this.createDiscoveredFinding(scopeId, finding);
        }
      },
      (candidates) => mergeDiscoveryCandidates(scopeId, agentStrategy, candidates),
      async ({ attempt, sessionId, parsedOutput }) => {
        const discoveryOutput = parsedOutput as GovernanceDiscoveryOutput;
        await this.governanceNotification.notifyDiscoverySucceeded({
          scopeId,
          attemptId: attempt.id,
          attemptNo: attempt.attemptNo,
          sessionId,
          findingCount: discoveryOutput.findings.length
        });
      },
      async ({ attempt, sessionId, failureCode, failureMessage }) => {
        await this.governanceNotification.notifyAttemptNeedsHumanReview({
          type: 'governance.discovery.needs_human_review',
          scopeId,
          title: '治理 Discovery 需要人工处理',
          body: '问题发现失败，已进入人工处理队列。',
          severity: NotificationSeverity.Warning,
          stageType: GovernanceAutomationStage.Discovery,
          subjectType: GovernanceAutomationSubjectType.Scope,
          subjectId: scopeId,
          attemptId: attempt.id,
          attemptNo: attempt.attemptNo,
          sessionId,
          failureCode,
          failureMessage
        });
      }
    );

    return runAttempt();
  }

  private async processTriageFinding(
    finding: Awaited<ReturnType<GovernanceRepository['claimNextPendingFinding']>> & {}
      & NonNullable<Awaited<ReturnType<GovernanceRepository['claimNextPendingFinding']>>>,
    agentStrategy: GovernanceStageAgentStrategy
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
    let triageNotification:
      | {
          type: 'created' | 'merged';
          issueId: string;
          issueTitle: string;
        }
      | null = null;

    const runAttempt = this.createAgentAttemptRunner(
      GovernanceAutomationStage.Triage,
      finding.scopeId,
      agentStrategy,
      attempt,
      prompt.prompt,
      async (parsedOutput) => {
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
          const detail = await this.governanceRepository.applyTriageCreateIssue({
            findingId: finding.id,
            scopeId: finding.scopeId,
            expectedFindingVersion: finding.version,
            issue: triageOutput.issue,
            assessment: normalizedAssessment
          });
          triageNotification = {
            type: 'created',
            issueId: detail.id,
            issueTitle: detail.title
          };
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

        const detail = await this.governanceRepository.applyTriageMerge({
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
        triageNotification = {
          type: 'merged',
          issueId: detail.id,
          issueTitle: detail.title
        };
      },
      (candidates) => mergeTriageCandidates(agentStrategy, candidates),
      async ({ attempt: succeededAttempt, sessionId }) => {
        if (!triageNotification) {
          return;
        }

        if (triageNotification.type === 'created') {
          await this.governanceNotification.notifyTriageIssueCreated({
            scopeId: finding.scopeId,
            attemptId: succeededAttempt.id,
            attemptNo: succeededAttempt.attemptNo,
            sessionId,
            findingId: finding.id,
            issueId: triageNotification.issueId,
            issueTitle: triageNotification.issueTitle
          });
          return;
        }

        await this.governanceNotification.notifyTriageIssueMerged({
          scopeId: finding.scopeId,
          attemptId: succeededAttempt.id,
          attemptNo: succeededAttempt.attemptNo,
          sessionId,
          findingId: finding.id,
          issueId: triageNotification.issueId,
          issueTitle: triageNotification.issueTitle
        });
      },
      async ({ attempt, sessionId, failureCode, failureMessage }) => {
        await this.governanceNotification.notifyAttemptNeedsHumanReview({
          type: 'governance.triage.needs_human_review',
          scopeId: finding.scopeId,
          title: '治理 Triage 需要人工处理',
          body: `Finding「${finding.title}」归并失败，已进入人工处理队列。`,
          severity: NotificationSeverity.Warning,
          stageType: GovernanceAutomationStage.Triage,
          subjectType: GovernanceAutomationSubjectType.Finding,
          subjectId: finding.id,
          attemptId: attempt.id,
          attemptNo: attempt.attemptNo,
          sessionId,
          failureCode,
          failureMessage
        });
      }
    );

    return runAttempt();
  }

  private async processPlanningIssue(
    issue: NonNullable<Awaited<ReturnType<GovernanceRepository['claimNextPlanningIssue']>>>,
    agentStrategy: GovernanceStageAgentStrategy
  ) {
    const project = await this.governanceRepository.getProjectSource(issue.scopeId);
    if (!project) {
      return false;
    }
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      issue.scopeId
    );
    const workspace =
      await this.governanceWorkspaceService.ensureCodeWorkspace(
        project,
        policy.sourceSelection
      );

    const baselineCommitSha = await this.governanceBaselineService.resolveHeadCommitSha(
      workspace.repositoryPath
    );
    const repositoryProfileRecord =
      await this.governanceRepository.getLatestRepositoryProfile(issue.scopeId);
    const repositoryProfile = repositoryProfileRecord
      ? toRepositoryProfile(repositoryProfileRecord)
      : null;
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
      await this.governanceNotification.notifyAttemptNeedsHumanReview({
        type: 'governance.planning.needs_human_review',
        scopeId: issue.scopeId,
        title: '治理 Planning 需要人工处理',
        body: `Issue「${issue.title}」缺少 assessment，无法继续自动规划。`,
        severity: NotificationSeverity.Warning,
        stageType: GovernanceAutomationStage.Planning,
        subjectType: GovernanceAutomationSubjectType.Issue,
        subjectId: issue.id,
        attemptId: attempt.id,
        attemptNo: attempt.attemptNo,
        sessionId: attempt.sessionId,
        issueId: issue.id,
        failureCode: 'PLANNING_ASSESSMENT_MISSING',
        failureMessage:
          'Planning requires an issue assessment before automation can continue.'
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
      await this.governanceNotification.notifyAttemptNeedsHumanReview({
        type: 'governance.planning.needs_human_review',
        scopeId: issue.scopeId,
        title: '治理 Planning 需要人工处理',
        body: `Issue「${issue.title}」被当前策略禁止自动规划。`,
        severity: NotificationSeverity.Warning,
        stageType: GovernanceAutomationStage.Planning,
        subjectType: GovernanceAutomationSubjectType.Issue,
        subjectId: issue.id,
        attemptId: attempt.id,
        attemptNo: attempt.attemptNo,
        sessionId: attempt.sessionId,
        issueId: issue.id,
        failureCode: 'PLANNING_BLOCKED_BY_POLICY',
        failureMessage:
          'Planning automation is blocked by the current governance policy.'
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
    let planningNotification:
      | {
          issueId: string;
          issueTitle: string;
          changePlanId: string;
        }
      | null = null;

    const runAttempt = this.createAgentAttemptRunner(
      GovernanceAutomationStage.Planning,
      issue.scopeId,
      agentStrategy,
      attempt,
      prompt.prompt,
      async (parsedOutput) => {
        const planningOutput = this.governancePolicyEvaluator.normalizePlanningOutput(
          {
            policy: toGovernancePolicy(policy),
            issueKind: issueDetail.kind,
            severity: issueDetail.latestAssessment!.severity,
            output: parsedOutput as GovernancePlanningOutput
          }
        );
        const detail =
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
        if (detail.changePlan) {
          planningNotification = {
            issueId: detail.id,
            issueTitle: detail.title,
            changePlanId: detail.changePlan.id
          };
        }
      },
      (candidates) => mergePlanningCandidates(agentStrategy, candidates),
      async ({ attempt: succeededAttempt, sessionId }) => {
        if (!planningNotification) {
          return;
        }

        await this.governanceNotification.notifyPlanningPlanCreated({
          scopeId: issue.scopeId,
          attemptId: succeededAttempt.id,
          attemptNo: succeededAttempt.attemptNo,
          sessionId,
          issueId: planningNotification.issueId,
          issueTitle: planningNotification.issueTitle,
          changePlanId: planningNotification.changePlanId
        });
      },
      async ({ attempt, sessionId, failureCode, failureMessage }) => {
        await this.governanceNotification.notifyAttemptNeedsHumanReview({
          type: 'governance.planning.needs_human_review',
          scopeId: issue.scopeId,
          title: '治理 Planning 需要人工处理',
          body: `Issue「${issue.title}」自动规划失败，已进入人工处理队列。`,
          severity: NotificationSeverity.Warning,
          stageType: GovernanceAutomationStage.Planning,
          subjectType: GovernanceAutomationSubjectType.Issue,
          subjectId: issue.id,
          attemptId: attempt.id,
          attemptNo: attempt.attemptNo,
          sessionId,
          issueId: issue.id,
          failureCode,
          failureMessage
        });
      }
    );

    return runAttempt();
  }

  private async processExecutionChangeUnit(
    changeUnitId: string,
    runnerId: string | null
  ) {
    const context =
      await this.governanceRepository.getChangeUnitExecutionContext(changeUnitId);
    if (!context) {
      return false;
    }
    if (!runnerId) {
      return false;
    }
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      context.scopeId
    );
    const workspace =
      await this.governanceWorkspaceService.ensureCodeWorkspace(
        context.project,
        policy.sourceSelection
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
      await this.governanceNotification.notifyExecutionUnitVerified({
        scopeId: context.scopeId,
        attemptId: attempt.id,
        attemptNo: currentAttemptNo,
        sessionId: session.sessionId,
        issueId: context.issue.id,
        changeUnitId: context.changeUnit.id,
        changeUnitTitle: context.changeUnit.title
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
      await this.governanceNotification.notifyExecutionUnitVerified({
        scopeId: context.scopeId,
        attemptId: attempt.id,
        attemptNo: currentAttemptNo,
        sessionId: session.sessionId,
        issueId: context.issue.id,
        changeUnitId: context.changeUnit.id,
        changeUnitTitle: context.changeUnit.title
      });
      await this.reconcileIssueAfterUnitVerification(context.issue.id);
      return true;
    }

    if (nextStatus === GovernanceChangeUnitStatus.Exhausted) {
      await this.governanceNotification.notifyExecutionUnitExhausted({
        scopeId: context.scopeId,
        attemptId: attempt.id,
        attemptNo: currentAttemptNo,
        sessionId: session.sessionId,
        issueId: context.issue.id,
        changeUnitId: context.changeUnit.id,
        changeUnitTitle: context.changeUnit.title,
        failureCode: 'VERIFICATION_FAILED',
        failureMessage: verificationResult.summary
      });
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
    const failureCode =
      input.result.status === 'timeout' ? 'EXECUTION_TIMEOUT' : input.result.code;
    const failureMessage =
      input.result.status === 'timeout'
        ? 'Execution stage timed out'
        : input.result.message;
    const exhausted =
      input.currentAttemptNo > input.context.changeUnit.maxRetries;
    await this.governanceRepository.markAutomationAttemptFailed({
      attemptId: input.attemptId,
      ownerLeaseToken: this.ownerId,
      failureCode,
      failureMessage,
      candidateOutput:
        input.result.status === 'error' ? input.result.outputText : undefined,
      needsHumanReview: exhausted
    });
    await this.governanceRepository.updateChangeUnitExecutionState({
      changeUnitId: input.context.changeUnit.id,
      status: exhausted
        ? GovernanceChangeUnitStatus.Exhausted
        : GovernanceChangeUnitStatus.VerificationFailed
    });
    if (exhausted) {
      await this.governanceNotification.notifyExecutionUnitExhausted({
        scopeId: input.context.scopeId,
        attemptId: input.attemptId,
        attemptNo: input.currentAttemptNo,
        sessionId: null,
        issueId: input.context.issue.id,
        changeUnitId: input.context.changeUnit.id,
        changeUnitTitle: input.context.changeUnit.title,
        failureCode,
        failureMessage
      });
    }
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
    const policy = await this.governanceRepository.getOrCreateGovernancePolicy(
      detail.scopeId
    );
    const workspace =
      await this.governanceWorkspaceService.ensureCodeWorkspace(
        project,
        policy.sourceSelection
      );
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

  private resolveConfiguredAgentStrategy(
    scopeId: string,
    stageType: GovernanceAutomationStage
  ) {
    return this.governanceRunnerResolver.resolveStageAgentStrategy({
      scopeId,
      stageType
    });
  }

  private createAgentAttemptRunner(
    stageType: GovernanceAutomationStage,
    scopeId: string,
    agentStrategy: GovernanceStageAgentStrategy,
    attempt: GovernanceExecutionAttemptRecord,
    prompt: string,
    onSuccess: (parsedOutput: Record<string, unknown>) => Promise<void>,
    mergeOutputs: (
      candidates: GovernanceFanoutSuccessCandidate[]
    ) => {
      primary: GovernanceFanoutSuccessCandidate;
      parsedOutput: Record<string, unknown>;
    },
    onSucceeded?: (input: {
      attempt: GovernanceExecutionAttemptRecord;
      sessionId: string | null;
      activeRequestMessageId: string | null;
      parsedOutput: Record<string, unknown>;
    }) => Promise<void>,
    onNeedsHumanReview?: (input: {
      attempt: GovernanceExecutionAttemptRecord;
      sessionId: string | null;
      failureCode: string;
      failureMessage: string;
    }) => Promise<void>
  ) {
    if (agentStrategy.runnerIds.length <= 1) {
      const runnerId = agentStrategy.runnerIds[0];
      if (!runnerId) {
        return async () => false;
      }

      return () =>
        this.governanceAutomationAttempt.runAgentAttempt({
          stageType,
          scopeId,
          runnerId,
          attempt,
          prompt,
          ownerLeaseToken: this.ownerId,
          maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
          createLeaseWindow: () => this.createLeaseWindow(),
          onSuccess,
          onSucceeded,
          onNeedsHumanReview
        });
    }

    return () =>
      this.governanceAgentFanout.runStageFanout({
        stageType,
        scopeId,
        strategy: agentStrategy,
        attempt,
        prompt,
        ownerLeaseToken: this.ownerId,
        maxAutoRetries: GovernanceAutomationService.MAX_AUTO_RETRIES,
        createLeaseWindow: () => this.createLeaseWindow(),
        mergeOutputs,
        onSuccess,
        onSucceeded,
        onNeedsHumanReview
      });
  }
}

function mergeDiscoveryCandidates(
  scopeId: string,
  agentStrategy: GovernanceStageAgentStrategy,
  candidates: GovernanceFanoutSuccessCandidate[]
) {
  if (agentStrategy.mergeStrategy === GovernanceAgentMergeStrategy.UnionDedup) {
    const dedupedFindings = Array.from(
      new Map(
        candidates.flatMap((candidate) => {
          const output = candidate.parsedOutput as GovernanceDiscoveryOutput;
          return output.findings.map((finding) => [
            buildFindingFingerprint(scopeId, finding),
            finding
          ]);
        })
      ).values()
    );

    return {
      primary: pickPrimaryCandidate(candidates),
      parsedOutput: {
        findings: dedupedFindings
      } satisfies GovernanceDiscoveryOutput
    };
  }

  const selectedCandidate =
    agentStrategy.mergeStrategy === GovernanceAgentMergeStrategy.BestOfN
      ? candidates.reduce((best, candidate) =>
          getDiscoveryFindingCount(candidate) > getDiscoveryFindingCount(best)
            ? candidate
            : best
        )
      : pickPrimaryCandidate(candidates);

  return {
    primary: selectedCandidate,
    parsedOutput: selectedCandidate.parsedOutput
  };
}

function mergeTriageCandidates(
  agentStrategy: GovernanceStageAgentStrategy,
  candidates: GovernanceFanoutSuccessCandidate[]
) {
  if (agentStrategy.mergeStrategy === GovernanceAgentMergeStrategy.Single) {
    const primary = pickPrimaryCandidate(candidates);
    return {
      primary,
      parsedOutput: primary.parsedOutput
    };
  }

  const primary = candidates.reduce((best, candidate) =>
    getCandidateScore(candidate) > getCandidateScore(best) ? candidate : best
  );
  return {
    primary,
    parsedOutput: primary.parsedOutput
  };
}

function mergePlanningCandidates(
  agentStrategy: GovernanceStageAgentStrategy,
  candidates: GovernanceFanoutSuccessCandidate[]
) {
  if (agentStrategy.mergeStrategy === GovernanceAgentMergeStrategy.Single) {
    const primary = pickPrimaryCandidate(candidates);
    return {
      primary,
      parsedOutput: primary.parsedOutput
    };
  }

  const primary = candidates.reduce((best, candidate) =>
    getPlanningCandidateScore(candidate) > getPlanningCandidateScore(best)
      ? candidate
      : best
  );
  return {
    primary,
    parsedOutput: primary.parsedOutput
  };
}

function pickPrimaryCandidate(candidates: GovernanceFanoutSuccessCandidate[]) {
  return candidates[0]!;
}

function getDiscoveryFindingCount(candidate: GovernanceFanoutSuccessCandidate) {
  const output = candidate.parsedOutput as GovernanceDiscoveryOutput;
  return output.findings.length;
}

function getCandidateScore(candidate: GovernanceFanoutSuccessCandidate) {
  return JSON.stringify(candidate.parsedOutput).length;
}

function getPlanningCandidateScore(candidate: GovernanceFanoutSuccessCandidate) {
  const output = candidate.parsedOutput as GovernancePlanningOutput;
  return (
    output.changeUnits.length * 100 +
    output.verificationPlans.length * 10 +
    output.proposedActions.length
  );
}
