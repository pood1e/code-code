import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ChangePlan as PrismaChangePlan,
  ChangeUnit as PrismaChangeUnit,
  DeliveryArtifact as PrismaDeliveryArtifact,
  Finding as PrismaFinding,
  GovernanceExecutionAttempt as PrismaGovernanceExecutionAttempt,
  Issue as PrismaIssue,
  IssueAssessment as PrismaIssueAssessment,
  Prisma,
  RepositoryProfile as PrismaRepositoryProfile,
  ResolutionDecision as PrismaResolutionDecision,
  VerificationResult as PrismaVerificationResult,
  VerificationPlan as PrismaVerificationPlan
} from '@prisma/client';
import {
  GovernanceAssessmentSource,
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceAutoActionEligibility,
  GovernanceChangePlanStatus,
  GovernanceChangeUnitStatus,
  GovernanceClusterBasis,
  GovernanceDeliveryArtifactKind,
  GovernanceDeliveryArtifactStatus,
  GovernanceDeliveryBodyStrategy,
  GovernanceDeliveryCommitMode,
  GovernanceExecutionAttemptStatus,
  GovernanceExecutionMode,
  GovernanceAgentMergeStrategy,
  GovernanceIssueKind,
  GovernanceFindingStatus,
  GovernanceIssueStatus,
  GovernancePriority,
  GovernanceResolutionType,
  GovernanceReviewDecisionType,
  GovernanceReviewQueueItemKind,
  GovernanceSeverity,
  GovernanceVerificationResultStatus,
  GovernanceVerificationSubjectType,
  GovernanceViolationPolicy,
  DEFAULT_GOVERNANCE_SOURCE_SELECTION,
  DEFAULT_GOVERNANCE_AGENT_STRATEGY,
  DEFAULT_GOVERNANCE_POLICY_INPUT
} from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import {
  type ChangePlanRecord,
  type ChangeUnitRecord,
  type CreateChangePlanBundleInput,
  type CreateIssueWithAssessmentInput,
  type DeliveryArtifactRecord,
  type GovernanceExecutionAttemptRecord,
  type GovernanceFindingRecord,
  type GovernanceIssueDetailRecord,
  type GovernanceIssueRecord,
  type GovernancePolicyRecord,
  type GovernanceReviewQueueItemRecord,
  type GovernanceScopeOverviewRecord,
  type GovernanceIssueSummaryRecord,
  GovernanceRepository,
  type IssueAssessmentRecord,
  type RepositoryProfileRecord,
  type ResolutionDecisionRecord,
  type VerificationResultRecord,
  type VerificationPlanRecord
} from './governance.repository';

@Injectable()
export class PrismaGovernanceRepository extends GovernanceRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listGovernanceScopes() {
    return this.prisma.project.findMany({
      select: {
        id: true,
        repoGitUrl: true,
        workspaceRootPath: true
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async projectExists(scopeId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: scopeId },
      select: { id: true }
    });
    return Boolean(project);
  }

  async agentRunnerExists(runnerId: string) {
    const runner = await this.prisma.agentRunner.findUnique({
      where: { id: runnerId },
      select: { id: true }
    });
    return Boolean(runner);
  }

  async issueExists(issueId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true }
    });
    return Boolean(issue);
  }

  async getProjectSource(scopeId: string) {
    return this.prisma.project.findUnique({
      where: { id: scopeId },
      select: { id: true, repoGitUrl: true, workspaceRootPath: true }
    });
  }

  async getLatestRepositoryProfile(scopeId: string) {
    const profile = await this.prisma.repositoryProfile.findFirst({
      where: { scopeId },
      orderBy: [{ snapshotAt: 'desc' }, { createdAt: 'desc' }]
    });
    return profile ? toRepositoryProfileRecord(profile) : null;
  }

  async getOrCreateGovernancePolicy(scopeId: string) {
    const existing = await this.prisma.governancePolicy.findUnique({
      where: { scopeId }
    });
    if (existing) {
      return toGovernancePolicyRecord(existing);
    }

    const created = await this.prisma.governancePolicy.create({
      data: {
        scopeId,
        priorityPolicy:
          DEFAULT_GOVERNANCE_POLICY_INPUT.priorityPolicy as Prisma.InputJsonValue,
        autoActionPolicy:
          DEFAULT_GOVERNANCE_POLICY_INPUT.autoActionPolicy as Prisma.InputJsonValue,
        deliveryPolicy:
          DEFAULT_GOVERNANCE_POLICY_INPUT.deliveryPolicy as Prisma.InputJsonValue,
        sourceSelection:
          DEFAULT_GOVERNANCE_POLICY_INPUT.sourceSelection as Prisma.InputJsonValue,
        agentStrategy:
          DEFAULT_GOVERNANCE_POLICY_INPUT.agentStrategy as Prisma.InputJsonValue
      }
    });

    return toGovernancePolicyRecord(created);
  }

  async updateGovernancePolicy(input: {
    scopeId: string;
    priorityPolicy: GovernancePolicyRecord['priorityPolicy'];
    autoActionPolicy: GovernancePolicyRecord['autoActionPolicy'];
    deliveryPolicy: GovernancePolicyRecord['deliveryPolicy'];
    sourceSelection?: GovernancePolicyRecord['sourceSelection'];
    agentStrategy?: GovernancePolicyRecord['agentStrategy'];
  }) {
    const policy = await this.prisma.governancePolicy.upsert({
      where: { scopeId: input.scopeId },
      update: {
        priorityPolicy: input.priorityPolicy as Prisma.InputJsonValue,
        autoActionPolicy: input.autoActionPolicy as Prisma.InputJsonValue,
        deliveryPolicy: input.deliveryPolicy as Prisma.InputJsonValue,
        ...(input.sourceSelection !== undefined
          ? {
              sourceSelection:
                input.sourceSelection as Prisma.InputJsonValue
            }
          : {}),
        ...(input.agentStrategy !== undefined
          ? {
              agentStrategy:
                input.agentStrategy as Prisma.InputJsonValue
            }
          : {})
      },
      create: {
        scopeId: input.scopeId,
        priorityPolicy: input.priorityPolicy as Prisma.InputJsonValue,
        autoActionPolicy: input.autoActionPolicy as Prisma.InputJsonValue,
        deliveryPolicy: input.deliveryPolicy as Prisma.InputJsonValue,
        sourceSelection:
          (input.sourceSelection ??
            DEFAULT_GOVERNANCE_POLICY_INPUT.sourceSelection) as Prisma.InputJsonValue,
        agentStrategy:
          (input.agentStrategy ??
            DEFAULT_GOVERNANCE_POLICY_INPUT.agentStrategy) as Prisma.InputJsonValue
      }
    });

    return toGovernancePolicyRecord(policy);
  }

  async createRepositoryProfileSnapshot(input: {
    scopeId: string;
    branch: string;
    snapshotAt: Date;
    modules: Array<{
      name: string;
      path: string;
      language: string;
      dependencies: string[];
    }>;
    testBaseline: {
      coveragePercent?: number;
      totalTests: number;
      failingTests: number;
      lastRunAt?: string;
    };
    buildStatus: RepositoryProfileRecord['buildStatus'];
    metadata?: Record<string, unknown> | null;
  }) {
    const profile = await this.prisma.repositoryProfile.create({
      data: {
        scopeId: input.scopeId,
        branch: input.branch,
        snapshotAt: input.snapshotAt,
        modules: input.modules as Prisma.InputJsonValue,
        testBaseline: input.testBaseline as Prisma.InputJsonValue,
        buildStatus: input.buildStatus,
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {})
      }
    });

    return toRepositoryProfileRecord(profile);
  }

  async getScopeOverview(scopeId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: scopeId },
      select: { id: true }
    });
    if (!project) {
      return null;
    }

    const [
      repositoryProfile,
      latestBaselineAttempt,
      latestDiscoveryAttempt,
      pendingCount,
      mergedCount,
      dismissedCount,
      ignoredCount
    ] = await Promise.all([
      this.getLatestRepositoryProfile(scopeId),
      this.findLatestAutomationAttempt({
        stageType: GovernanceAutomationStage.Baseline,
        subjectType: GovernanceAutomationSubjectType.Scope,
        subjectId: scopeId
      }),
      this.findLatestAutomationAttempt({
        stageType: GovernanceAutomationStage.Discovery,
        subjectType: GovernanceAutomationSubjectType.Scope,
        subjectId: scopeId
      }),
      this.prisma.finding.count({
        where: { scopeId, status: GovernanceFindingStatus.Pending }
      }),
      this.prisma.finding.count({
        where: { scopeId, status: GovernanceFindingStatus.Merged }
      }),
      this.prisma.finding.count({
        where: { scopeId, status: GovernanceFindingStatus.Dismissed }
      }),
      this.prisma.finding.count({
        where: { scopeId, status: GovernanceFindingStatus.Ignored }
      })
    ]);

    return {
      scopeId,
      repositoryProfile,
      latestBaselineAttempt,
      latestDiscoveryAttempt,
      findingCounts: {
        [GovernanceFindingStatus.Pending]: pendingCount,
        [GovernanceFindingStatus.Merged]: mergedCount,
        [GovernanceFindingStatus.Dismissed]: dismissedCount,
        [GovernanceFindingStatus.Ignored]: ignoredCount
      }
    } satisfies GovernanceScopeOverviewRecord;
  }

  async listReviewQueue(scopeId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: scopeId },
      select: { id: true }
    });
    if (!project) {
      return [];
    }

    const [
      latestBaselineAttempt,
      latestDiscoveryAttempt,
      findings,
      issues,
      changeUnits,
      deliveryArtifacts
    ] = await Promise.all([
      this.findLatestAutomationAttempt({
        stageType: GovernanceAutomationStage.Baseline,
        subjectType: GovernanceAutomationSubjectType.Scope,
        subjectId: scopeId
      }),
      this.findLatestAutomationAttempt({
        stageType: GovernanceAutomationStage.Discovery,
        subjectType: GovernanceAutomationSubjectType.Scope,
        subjectId: scopeId
      }),
      this.prisma.finding.findMany({
        where: {
          scopeId,
          status: GovernanceFindingStatus.Pending
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.issue.findMany({
        where: { scopeId },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.changeUnit.findMany({
        where: {
          issue: { scopeId },
          OR: [
            {
              status: GovernanceChangeUnitStatus.Ready,
              executionMode: GovernanceExecutionMode.Manual
            },
            {
              status: {
                in: [
                  GovernanceChangeUnitStatus.VerificationFailed,
                  GovernanceChangeUnitStatus.Exhausted
                ]
              }
            }
          ]
        },
        include: {
          issue: {
            select: {
              title: true
            }
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.deliveryArtifact.findMany({
        where: {
          scopeId,
          status: GovernanceDeliveryArtifactStatus.Submitted
        },
        include: {
          issue: {
            select: {
              title: true
            }
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      })
    ]);

    const triageAttempts = await this.loadLatestAttemptsBySubject({
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectIds: findings.map((finding) => finding.id)
    });
    const planningAttempts = await this.loadLatestAttemptsBySubject({
      stageType: GovernanceAutomationStage.Planning,
      subjectType: GovernanceAutomationSubjectType.Issue,
      subjectIds: issues.map((issue) => issue.id)
    });
    const executionAttempts = await this.loadLatestAttemptsBySubject({
      stageType: GovernanceAutomationStage.Execution,
      subjectType: GovernanceAutomationSubjectType.ChangeUnit,
      subjectIds: changeUnits.map((changeUnit) => changeUnit.id)
    });

    const items: GovernanceReviewQueueItemRecord[] = [];

    if (
      latestBaselineAttempt?.status ===
      GovernanceExecutionAttemptStatus.NeedsHumanReview
    ) {
      items.push({
        kind: GovernanceReviewQueueItemKind.Baseline,
        scopeId,
        subjectId: scopeId,
        issueId: null,
        title: '仓库画像生成',
        status: latestBaselineAttempt.status,
        failureCode: latestBaselineAttempt.failureCode,
        failureMessage: latestBaselineAttempt.failureMessage,
        sessionId: latestBaselineAttempt.sessionId,
        updatedAt: latestBaselineAttempt.updatedAt
      });
    }

    if (
      latestDiscoveryAttempt?.status ===
      GovernanceExecutionAttemptStatus.NeedsHumanReview
    ) {
      items.push({
        kind: GovernanceReviewQueueItemKind.Discovery,
        scopeId,
        subjectId: scopeId,
        issueId: null,
        title: '问题发现',
        status: latestDiscoveryAttempt.status,
        failureCode: latestDiscoveryAttempt.failureCode,
        failureMessage: latestDiscoveryAttempt.failureMessage,
        sessionId: latestDiscoveryAttempt.sessionId,
        updatedAt: latestDiscoveryAttempt.updatedAt
      });
    }

    for (const finding of findings) {
      const latestAttempt = triageAttempts.get(finding.id) ?? null;
      if (
        latestAttempt?.status !== GovernanceExecutionAttemptStatus.NeedsHumanReview
      ) {
        continue;
      }

      items.push({
        kind: GovernanceReviewQueueItemKind.Triage,
        scopeId,
        subjectId: finding.id,
        issueId: null,
        title: finding.title,
        status: latestAttempt.status,
        failureCode: latestAttempt.failureCode,
        failureMessage: latestAttempt.failureMessage,
        sessionId: latestAttempt.sessionId,
        updatedAt: latestAttempt.updatedAt
      });
    }

    for (const issue of issues) {
      const latestAttempt = planningAttempts.get(issue.id) ?? null;
      if (
        latestAttempt?.status !== GovernanceExecutionAttemptStatus.NeedsHumanReview
      ) {
        continue;
      }

      items.push({
        kind: GovernanceReviewQueueItemKind.Planning,
        scopeId,
        subjectId: issue.id,
        issueId: issue.id,
        title: issue.title,
        status: latestAttempt.status,
        failureCode: latestAttempt.failureCode,
        failureMessage: latestAttempt.failureMessage,
        sessionId: latestAttempt.sessionId,
        updatedAt: latestAttempt.updatedAt
      });
    }

    for (const changeUnit of changeUnits) {
      const latestAttempt = executionAttempts.get(changeUnit.id) ?? null;
      items.push({
        kind: GovernanceReviewQueueItemKind.ChangeUnit,
        scopeId,
        subjectId: changeUnit.id,
        issueId: changeUnit.issueId,
        title: `${changeUnit.issue.title} / ${changeUnit.title}`,
        status: changeUnit.status,
        failureCode: latestAttempt?.failureCode ?? null,
        failureMessage: latestAttempt?.failureMessage ?? null,
        sessionId: latestAttempt?.sessionId ?? null,
        updatedAt: changeUnit.updatedAt
      });
    }

    for (const artifact of deliveryArtifacts) {
      items.push({
        kind: GovernanceReviewQueueItemKind.DeliveryArtifact,
        scopeId,
        subjectId: artifact.id,
        issueId: artifact.issueId,
        title: `${artifact.issue.title} / ${artifact.title}`,
        status: artifact.status,
        failureCode: null,
        failureMessage: null,
        sessionId: null,
        updatedAt: artifact.updatedAt
      });
    }

    return items.sort(
      (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()
    );
  }

  async findFindingById(id: string) {
    const finding = await this.prisma.finding.findUnique({ where: { id } });
    if (!finding) {
      return null;
    }

    const latestTriageAttempt = await this.findLatestAutomationAttempt({
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectId: id
    });

    return toGovernanceFindingRecord(finding, latestTriageAttempt);
  }

  async findFindingByFingerprint(scopeId: string, fingerprint: string) {
    const finding = await this.prisma.finding.findFirst({
      where: {
        scopeId,
        fingerprint,
        status: {
          in: [
            GovernanceFindingStatus.Pending,
            GovernanceFindingStatus.Merged,
            GovernanceFindingStatus.Dismissed
          ]
        }
      },
      orderBy: [{ discoveredAt: 'desc' }, { createdAt: 'desc' }]
    });
    if (!finding) {
      return null;
    }

    const latestTriageAttempt = await this.findLatestAutomationAttempt({
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectId: finding.id
    });

    return toGovernanceFindingRecord(finding, latestTriageAttempt);
  }

  async findIssueById(id: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    return issue ? toGovernanceIssueRecord(issue) : null;
  }

  async findChangePlanById(id: string) {
    const changePlan = await this.prisma.changePlan.findUnique({ where: { id } });
    return changePlan ? toChangePlanRecord(changePlan) : null;
  }

  async findLatestAutomationAttempt(input: {
    stageType: GovernanceAutomationStage;
    subjectType: GovernanceAutomationSubjectType;
    subjectId: string;
  }) {
    const attempt = await this.prisma.governanceExecutionAttempt.findFirst({
      where: {
        stageType: input.stageType,
        subjectType: input.subjectType,
        subjectId: input.subjectId
      },
      orderBy: [{ attemptNo: 'desc' }, { createdAt: 'desc' }]
    });

    return attempt ? toGovernanceExecutionAttemptRecord(attempt) : null;
  }

  async createAutomationAttempt(input: {
    scopeId: string;
    stageType: GovernanceAutomationStage;
    subjectType: GovernanceAutomationSubjectType;
    subjectId: string;
    inputSnapshot: Record<string, unknown>;
    ownerLeaseToken?: string;
    leaseExpiresAt?: Date;
  }) {
    const attempt = await this.prisma.$transaction(async (tx) => {
      const latestAttempt = await tx.governanceExecutionAttempt.findFirst({
        where: {
          stageType: input.stageType,
          subjectType: input.subjectType,
          subjectId: input.subjectId
        },
        orderBy: [{ attemptNo: 'desc' }, { createdAt: 'desc' }]
      });

      return tx.governanceExecutionAttempt.create({
        data: {
          scopeId: input.scopeId,
          stageType: input.stageType,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          attemptNo: (latestAttempt?.attemptNo ?? 0) + 1,
          status: GovernanceExecutionAttemptStatus.Pending,
          inputSnapshot: input.inputSnapshot as Prisma.InputJsonValue,
          ownerLeaseToken: input.ownerLeaseToken ?? null,
          leaseExpiresAt: input.leaseExpiresAt ?? null
        }
      });
    });

    return toGovernanceExecutionAttemptRecord(attempt);
  }

  async claimAutomationAttempt(input: {
    attemptId: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }) {
    const claimed = await this.prisma.governanceExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        status: {
          in: [
            GovernanceExecutionAttemptStatus.Pending,
            GovernanceExecutionAttemptStatus.Running,
            GovernanceExecutionAttemptStatus.WaitingRepair
          ]
        },
        OR: [
          { ownerLeaseToken: null },
          { ownerLeaseToken: input.ownerLeaseToken },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: input.now } }
        ]
      },
      data: {
        ownerLeaseToken: input.ownerLeaseToken,
        leaseExpiresAt: input.leaseExpiresAt
      }
    });

    if (claimed.count !== 1) {
      return null;
    }

    const attempt = await this.prisma.governanceExecutionAttempt.findUnique({
      where: { id: input.attemptId }
    });
    return attempt ? toGovernanceExecutionAttemptRecord(attempt) : null;
  }

  async markAutomationAttemptRunning(input: {
    attemptId: string;
    ownerLeaseToken: string;
    leaseExpiresAt: Date;
  }) {
    const updated = await this.prisma.governanceExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        status: GovernanceExecutionAttemptStatus.Running,
        leaseExpiresAt: input.leaseExpiresAt,
        startedAt: new Date()
      }
    });

    return updated.count === 1;
  }

  async attachAutomationAttemptSession(input: {
    attemptId: string;
    ownerLeaseToken: string;
    sessionId: string;
    activeRequestMessageId: string | null;
  }) {
    const updated = await this.prisma.governanceExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        sessionId: input.sessionId,
        activeRequestMessageId: input.activeRequestMessageId
      }
    });

    return updated.count === 1;
  }

  async updateAutomationAttemptMessage(input: {
    attemptId: string;
    ownerLeaseToken: string;
    activeRequestMessageId: string | null;
  }) {
    const updated = await this.prisma.governanceExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        activeRequestMessageId: input.activeRequestMessageId
      }
    });

    return updated.count === 1;
  }

  async markAutomationAttemptWaitingRepair(input: {
    attemptId: string;
    ownerLeaseToken: string;
    activeRequestMessageId: string | null;
    failureCode: string;
    failureMessage: string;
    candidateOutput?: unknown;
  }) {
    const updated = await this.prisma.governanceExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        status: GovernanceExecutionAttemptStatus.WaitingRepair,
        activeRequestMessageId: input.activeRequestMessageId,
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        candidateOutput: toOptionalJson(input.candidateOutput)
      }
    });

    return updated.count === 1;
  }

  async markAutomationAttemptSucceeded(input: {
    attemptId: string;
    ownerLeaseToken: string;
    activeRequestMessageId: string | null;
    candidateOutput?: unknown;
    parsedOutput: unknown;
  }) {
    const updated = await this.prisma.governanceExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        status: GovernanceExecutionAttemptStatus.Succeeded,
        activeRequestMessageId: input.activeRequestMessageId,
        candidateOutput: toOptionalJson(input.candidateOutput),
        parsedOutput: input.parsedOutput as Prisma.InputJsonValue,
        finishedAt: new Date(),
        ownerLeaseToken: null,
        leaseExpiresAt: null,
        failureCode: null,
        failureMessage: null
      }
    });

    return updated.count === 1;
  }

  async markAutomationAttemptFailed(input: {
    attemptId: string;
    ownerLeaseToken: string;
    failureCode: string;
    failureMessage: string;
    candidateOutput?: unknown;
    needsHumanReview: boolean;
  }) {
    const updated = await this.prisma.governanceExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        status: input.needsHumanReview
          ? GovernanceExecutionAttemptStatus.NeedsHumanReview
          : GovernanceExecutionAttemptStatus.Failed,
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        candidateOutput: toOptionalJson(input.candidateOutput),
        finishedAt: new Date(),
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });

    return updated.count === 1;
  }

  async markAutomationAttemptResolvedByHuman(
    attemptId: string,
    reviewDecisionId?: string | null
  ) {
    await this.prisma.governanceExecutionAttempt.update({
      where: { id: attemptId },
      data: {
        status: GovernanceExecutionAttemptStatus.ResolvedByHuman,
        resolvedByReviewDecisionId: reviewDecisionId ?? null,
        finishedAt: new Date(),
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });
  }

  async renewAutomationAttemptLease(input: {
    attemptId: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }) {
    const updated = await this.prisma.governanceExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken,
        leaseExpiresAt: { gte: input.now }
      },
      data: {
        leaseExpiresAt: input.leaseExpiresAt
      }
    });

    return updated.count === 1;
  }

  async releaseAutomationAttemptLease(input: {
    attemptId: string;
    ownerLeaseToken: string;
  }) {
    const updated = await this.prisma.governanceExecutionAttempt.updateMany({
      where: {
        id: input.attemptId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });

    return updated.count === 1;
  }

  async recoverInterruptedAutomation(now: Date) {
    const [findings, issues, changeUnits, attempts, orphanAttempts] = await this.prisma.$transaction([
      this.prisma.finding.updateMany({
        where: {
          ownerLeaseToken: { not: null },
          leaseExpiresAt: { lt: now }
        },
        data: {
          ownerLeaseToken: null,
          leaseExpiresAt: null
        }
      }),
      this.prisma.issue.updateMany({
        where: {
          ownerLeaseToken: { not: null },
          leaseExpiresAt: { lt: now }
        },
        data: {
          ownerLeaseToken: null,
          leaseExpiresAt: null
        }
      }),
      this.prisma.changeUnit.updateMany({
        where: {
          ownerLeaseToken: { not: null },
          leaseExpiresAt: { lt: now }
        },
        data: {
          ownerLeaseToken: null,
          leaseExpiresAt: null
        }
      }),
      this.prisma.governanceExecutionAttempt.updateMany({
        where: {
          ownerLeaseToken: { not: null },
          leaseExpiresAt: { lt: now },
          status: {
            in: [
              GovernanceExecutionAttemptStatus.Pending,
              GovernanceExecutionAttemptStatus.Running,
              GovernanceExecutionAttemptStatus.WaitingRepair
            ]
          }
        },
        data: {
          ownerLeaseToken: null,
          leaseExpiresAt: null
        }
      }),
      this.prisma.governanceExecutionAttempt.updateMany({
        where: {
          ownerLeaseToken: null,
          leaseExpiresAt: null,
          status: {
            in: [
              GovernanceExecutionAttemptStatus.Running,
              GovernanceExecutionAttemptStatus.WaitingRepair
            ]
          }
        },
        data: {
          status: GovernanceExecutionAttemptStatus.Failed,
          failureCode: 'AUTOMATION_RECOVERED_ON_BOOT',
          failureMessage:
            'Automation attempt was interrupted during service restart.',
          finishedAt: now
        }
      })
    ]);

    return (
      findings.count +
      issues.count +
      changeUnits.count +
      attempts.count +
      orphanAttempts.count
    );
  }

  async wakeDeferredIssues(now: Date) {
    const result = await this.prisma.issue.updateMany({
      where: {
        status: GovernanceIssueStatus.Deferred,
        resolutionDecisions: {
          some: {
            resolution: GovernanceResolutionType.Defer,
            deferUntil: { lte: now }
          }
        }
      },
      data: {
        status: GovernanceIssueStatus.Open,
        version: { increment: 1 }
      }
    });

    return result.count;
  }

  async claimNextPendingFinding(input: {
    scopeId?: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }) {
    const candidates = await this.prisma.finding.findMany({
      where: {
        ...(input.scopeId ? { scopeId: input.scopeId } : {}),
        status: GovernanceFindingStatus.Pending,
        OR: [
          { ownerLeaseToken: null },
          { ownerLeaseToken: input.ownerLeaseToken },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: input.now } }
        ]
      },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      take: 20
    });

    if (candidates.length === 0) {
      return null;
    }

    const attemptsBySubject = await this.loadLatestAttemptsBySubject({
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectIds: candidates.map((finding) => finding.id)
    });

    for (const finding of candidates) {
      const latestAttempt = attemptsBySubject.get(finding.id) ?? null;
      if (
        latestAttempt &&
        [
          GovernanceExecutionAttemptStatus.Running,
          GovernanceExecutionAttemptStatus.WaitingRepair,
          GovernanceExecutionAttemptStatus.NeedsHumanReview
        ].includes(latestAttempt.status)
      ) {
        continue;
      }

      const claimed = await this.prisma.finding.updateMany({
        where: {
          id: finding.id,
          version: finding.version,
          status: GovernanceFindingStatus.Pending,
          OR: [
            { ownerLeaseToken: null },
            { ownerLeaseToken: input.ownerLeaseToken },
            { leaseExpiresAt: null },
            { leaseExpiresAt: { lt: input.now } }
          ]
        },
        data: {
          ownerLeaseToken: input.ownerLeaseToken,
          leaseExpiresAt: input.leaseExpiresAt,
          version: { increment: 1 }
        }
      });

      if (claimed.count !== 1) {
        continue;
      }

      const refreshed = await this.prisma.finding.findUnique({
        where: { id: finding.id }
      });
      if (!refreshed) {
        return null;
      }

      return toGovernanceFindingRecord(refreshed, latestAttempt);
    }

    return null;
  }

  async claimNextPlanningIssue(input: {
    scopeId?: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }) {
    const candidates = await this.prisma.issue.findMany({
      where: {
        ...(input.scopeId ? { scopeId: input.scopeId } : {}),
        status: GovernanceIssueStatus.Open,
        OR: [
          { ownerLeaseToken: null },
          { ownerLeaseToken: input.ownerLeaseToken },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: input.now } }
        ]
      },
      include: {
        resolutionDecisions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        changePlans: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      take: 20
    });

    if (candidates.length === 0) {
      return null;
    }

    const attemptsBySubject = await this.loadLatestAttemptsBySubject({
      stageType: GovernanceAutomationStage.Planning,
      subjectType: GovernanceAutomationSubjectType.Issue,
      subjectIds: candidates.map((issue) => issue.id)
    });

    for (const issue of candidates) {
      const latestResolution = issue.resolutionDecisions[0] ?? null;
      const latestChangePlan = issue.changePlans[0] ?? null;
      const latestAttempt = attemptsBySubject.get(issue.id) ?? null;

      if (!isPlanningEligible(issue, latestResolution, latestChangePlan, latestAttempt)) {
        continue;
      }

      const claimed = await this.prisma.issue.updateMany({
        where: {
          id: issue.id,
          version: issue.version,
          status: GovernanceIssueStatus.Open,
          OR: [
            { ownerLeaseToken: null },
            { ownerLeaseToken: input.ownerLeaseToken },
            { leaseExpiresAt: null },
            { leaseExpiresAt: { lt: input.now } }
          ]
        },
        data: {
          ownerLeaseToken: input.ownerLeaseToken,
          leaseExpiresAt: input.leaseExpiresAt,
          version: { increment: 1 }
        }
      });

      if (claimed.count !== 1) {
        continue;
      }

      const refreshed = await this.prisma.issue.findUnique({
        where: { id: issue.id }
      });
      if (!refreshed) {
        return null;
      }

      return toGovernanceIssueRecord(refreshed);
    }

    return null;
  }

  async claimNextExecutableChangeUnit(input: {
    scopeId?: string;
    ownerLeaseToken: string;
    now: Date;
    leaseExpiresAt: Date;
  }) {
    const candidates = await this.prisma.changeUnit.findMany({
      where: {
        status: {
          in: [
            GovernanceChangeUnitStatus.Pending,
            GovernanceChangeUnitStatus.Ready
          ]
        },
        executionMode: {
          not: GovernanceExecutionMode.Manual
        },
        OR: [
          { ownerLeaseToken: null },
          { ownerLeaseToken: input.ownerLeaseToken },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: input.now } }
        ],
        changePlan: {
          status: GovernanceChangePlanStatus.Approved
        },
        issue: {
          ...(input.scopeId ? { scopeId: input.scopeId } : {}),
          status: {
            in: [
              GovernanceIssueStatus.Planned,
              GovernanceIssueStatus.InProgress,
              GovernanceIssueStatus.Blocked
            ]
          }
        }
      },
      include: {
        issue: true,
        changePlan: true
      },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      take: 20
    });

    if (candidates.length === 0) {
      return null;
    }

    const attemptsBySubject = await this.loadLatestAttemptsBySubject({
      stageType: GovernanceAutomationStage.Execution,
      subjectType: GovernanceAutomationSubjectType.ChangeUnit,
      subjectIds: candidates.map((unit) => unit.id)
    });

    for (const unit of candidates) {
      const latestAttempt = attemptsBySubject.get(unit.id) ?? null;
      if (
        latestAttempt &&
        [
          GovernanceExecutionAttemptStatus.Running,
          GovernanceExecutionAttemptStatus.WaitingRepair,
          GovernanceExecutionAttemptStatus.NeedsHumanReview
        ].includes(latestAttempt.status)
      ) {
        continue;
      }

      const dependencyIds = getStringArray(unit.dependsOnUnitIds);
      if (
        await this.hasRunningSiblingInChangePlan(unit.changePlanId, unit.id)
      ) {
        continue;
      }
      if (
        await this.hasRunningCrossPlanTargetConflict({
          scopeId: unit.issue.scopeId,
          changePlanId: unit.changePlanId,
          changeUnitId: unit.id,
          targets: getTargetRefs(unit.scope)
        })
      ) {
        continue;
      }
      if (unit.status === GovernanceChangeUnitStatus.Pending) {
        const dependenciesReady = await this.areChangeUnitDependenciesReady(
          dependencyIds
        );
        if (!dependenciesReady) {
          continue;
        }

        const promoted = await this.prisma.changeUnit.updateMany({
          where: {
            id: unit.id,
            version: unit.version,
            status: GovernanceChangeUnitStatus.Pending
          },
          data: {
            status: GovernanceChangeUnitStatus.Ready,
            version: { increment: 1 }
          }
        });
        if (promoted.count !== 1) {
          continue;
        }
      }

      const claimed = await this.prisma.changeUnit.updateMany({
        where: {
          id: unit.id,
          status: GovernanceChangeUnitStatus.Ready,
          OR: [
            { ownerLeaseToken: null },
            { ownerLeaseToken: input.ownerLeaseToken },
            { leaseExpiresAt: null },
            { leaseExpiresAt: { lt: input.now } }
          ]
        },
        data: {
          ownerLeaseToken: input.ownerLeaseToken,
          leaseExpiresAt: input.leaseExpiresAt,
          version: { increment: 1 }
        }
      });
      if (claimed.count !== 1) {
        continue;
      }

      const refreshed = await this.prisma.changeUnit.findUnique({
        where: { id: unit.id }
      });
      if (!refreshed) {
        return null;
      }

      const executionAttempt =
        attemptsBySubject.get(refreshed.id) ?? null;
      const latestVerificationResult =
        await this.findLatestVerificationResultForChangeUnit(refreshed.id);
      return toChangeUnitRecord(
        refreshed,
        executionAttempt,
        latestVerificationResult
      );
    }

    return null;
  }

  async releaseFindingLease(input: {
    findingId: string;
    ownerLeaseToken: string;
  }) {
    const updated = await this.prisma.finding.updateMany({
      where: {
        id: input.findingId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });

    return updated.count === 1;
  }

  async releaseIssueLease(input: { issueId: string; ownerLeaseToken: string }) {
    const updated = await this.prisma.issue.updateMany({
      where: {
        id: input.issueId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });

    return updated.count === 1;
  }

  async releaseChangeUnitLease(input: {
    changeUnitId: string;
    ownerLeaseToken: string;
  }) {
    const updated = await this.prisma.changeUnit.updateMany({
      where: {
        id: input.changeUnitId,
        ownerLeaseToken: input.ownerLeaseToken
      },
      data: {
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });

    return updated.count === 1;
  }

  async applyTriageCreateIssue(input: {
    findingId: string;
    scopeId: string;
    expectedFindingVersion: number;
    issue: {
      title: string;
      statement: string;
      kind: GovernanceIssueRecord['kind'];
      categories: string[];
      tags?: string[];
      affectedTargets: Array<{ kind: string; ref: string }>;
      rootCause?: string;
      impactSummary: string;
      isRegression?: boolean;
      regressionOfIssueId?: string;
    };
    assessment: CreateIssueWithAssessmentInput['assessment'];
  }) {
    const issueId = await this.prisma.$transaction(async (tx) => {
      const finding = await tx.finding.findUnique({
        where: { id: input.findingId }
      });
      if (!finding) {
        throw new NotFoundException(`Finding not found: ${input.findingId}`);
      }

      if (
        finding.version !== input.expectedFindingVersion ||
        finding.status !== GovernanceFindingStatus.Pending
      ) {
        throw new ConflictException('Finding was updated by another process');
      }

      const issue = await tx.issue.create({
        data: {
          scopeId: input.scopeId,
          title: input.issue.title,
          statement: input.issue.statement,
          kind: input.issue.kind,
          categories: input.issue.categories as Prisma.InputJsonValue,
          tags: (input.issue.tags ?? []) as Prisma.InputJsonValue,
          relatedFindingIds: [input.findingId] as Prisma.InputJsonValue,
          status: GovernanceIssueStatus.Open,
          affectedTargets: input.issue.affectedTargets as Prisma.InputJsonValue,
          rootCause: input.issue.rootCause ?? null,
          impactSummary: input.issue.impactSummary,
          isRegression: input.issue.isRegression ?? false,
          regressionOfIssueId: input.issue.regressionOfIssueId ?? null
        }
      });

      await tx.issueAssessment.create({
        data: {
          issueId: issue.id,
          severity: input.assessment.severity,
          priority: input.assessment.priority,
          userImpact: input.assessment.userImpact,
          systemRisk: input.assessment.systemRisk,
          strategicValue: input.assessment.strategicValue,
          fixCost: input.assessment.fixCost,
          autoActionEligibility: input.assessment.autoActionEligibility,
          rationale: input.assessment.rationale as Prisma.InputJsonValue,
          assessedBy: input.assessment.assessedBy,
          assessedAt: input.assessment.assessedAt ?? new Date()
        }
      });

      await tx.findingMergeRecord.create({
        data: {
          scopeId: input.scopeId,
          targetIssueId: issue.id,
          mergedFindingIds: [input.findingId] as Prisma.InputJsonValue,
          trigger: 'auto_cluster',
          mergedAt: new Date()
        }
      });

      const findingUpdate = await tx.finding.updateMany({
        where: {
          id: input.findingId,
          version: input.expectedFindingVersion,
          status: GovernanceFindingStatus.Pending
        },
        data: {
          status: GovernanceFindingStatus.Merged,
          ownerLeaseToken: null,
          leaseExpiresAt: null,
          version: { increment: 1 }
        }
      });

      if (findingUpdate.count !== 1) {
        throw new ConflictException('Finding was updated by another process');
      }

      return issue.id;
    });

    const detail = await this.getIssueDetail(issueId);
    if (!detail) {
      throw new ConflictException(`Issue not found after create: ${issueId}`);
    }
    return detail;
  }

  async applyTriageMerge(input: {
    findingId: string;
    expectedFindingVersion: number;
    targetIssueId: string;
    clusterBasis: GovernanceClusterBasis[];
    assessmentRefresh?: CreateIssueWithAssessmentInput['assessment'];
  }) {
    const issueId = await this.prisma.$transaction(async (tx) => {
      const [finding, issue] = await Promise.all([
        tx.finding.findUnique({ where: { id: input.findingId } }),
        tx.issue.findUnique({ where: { id: input.targetIssueId } })
      ]);

      if (!finding) {
        throw new NotFoundException(`Finding not found: ${input.findingId}`);
      }
      if (!issue) {
        throw new NotFoundException(`Issue not found: ${input.targetIssueId}`);
      }
      if (
        finding.version !== input.expectedFindingVersion ||
        finding.status !== GovernanceFindingStatus.Pending
      ) {
        throw new ConflictException('Finding was updated by another process');
      }

      const relatedFindingIds = uniqueStrings([
        ...getStringArray(issue.relatedFindingIds),
        input.findingId
      ]);

      await tx.findingMergeRecord.create({
        data: {
          scopeId: issue.scopeId,
          targetIssueId: issue.id,
          mergedFindingIds: [input.findingId] as Prisma.InputJsonValue,
          trigger: 'auto_cluster',
          clusterBasis: input.clusterBasis as Prisma.InputJsonValue,
          mergedAt: new Date()
        }
      });

      await tx.issue.update({
        where: { id: issue.id },
        data: {
          relatedFindingIds: relatedFindingIds as Prisma.InputJsonValue,
          status: resolveMergedIssueStatus(issue.status as GovernanceIssueStatus),
          ...(issue.status === GovernanceIssueStatus.Closed
            ? { isRegression: true }
            : {}),
          version: { increment: 1 }
        }
      });

      if (input.assessmentRefresh) {
        await tx.issueAssessment.create({
          data: {
            issueId: issue.id,
            severity: input.assessmentRefresh.severity,
            priority: input.assessmentRefresh.priority,
            userImpact: input.assessmentRefresh.userImpact,
            systemRisk: input.assessmentRefresh.systemRisk,
            strategicValue: input.assessmentRefresh.strategicValue,
            fixCost: input.assessmentRefresh.fixCost,
            autoActionEligibility: input.assessmentRefresh.autoActionEligibility,
            rationale: input.assessmentRefresh.rationale as Prisma.InputJsonValue,
            assessedBy: GovernanceAssessmentSource.Agent,
            assessedAt: input.assessmentRefresh.assessedAt ?? new Date()
          }
        });
      }

      const findingUpdate = await tx.finding.updateMany({
        where: {
          id: input.findingId,
          version: input.expectedFindingVersion,
          status: GovernanceFindingStatus.Pending
        },
        data: {
          status: resolveMergedFindingStatus(issue.status as GovernanceIssueStatus),
          ownerLeaseToken: null,
          leaseExpiresAt: null,
          version: { increment: 1 }
        }
      });

      if (findingUpdate.count !== 1) {
        throw new ConflictException('Finding was updated by another process');
      }

      return issue.id;
    });

    const detail = await this.getIssueDetail(issueId);
    if (!detail) {
      throw new ConflictException(`Issue not found after merge: ${issueId}`);
    }
    return detail;
  }

  async retryTriage(findingId: string) {
    const attempt = await this.findLatestAutomationAttempt({
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectId: findingId
    });
    if (!attempt) {
      throw new NotFoundException(`Triage attempt not found for finding: ${findingId}`);
    }
    if (attempt.status !== GovernanceExecutionAttemptStatus.NeedsHumanReview) {
      throw new ConflictException('Triage attempt is not waiting for human review');
    }

    await this.prisma.$transaction([
      this.prisma.governanceExecutionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: GovernanceExecutionAttemptStatus.ResolvedByHuman,
          finishedAt: new Date(),
          ownerLeaseToken: null,
          leaseExpiresAt: null
        }
      }),
      this.prisma.finding.update({
        where: { id: findingId },
        data: {
          ownerLeaseToken: null,
          leaseExpiresAt: null
        }
      })
    ]);
  }

  async retryBaseline(scopeId: string) {
    const attempt = await this.findLatestAutomationAttempt({
      stageType: GovernanceAutomationStage.Baseline,
      subjectType: GovernanceAutomationSubjectType.Scope,
      subjectId: scopeId
    });
    if (!attempt) {
      throw new NotFoundException(
        `Baseline attempt not found for scope: ${scopeId}`
      );
    }
    if (attempt.status !== GovernanceExecutionAttemptStatus.NeedsHumanReview) {
      throw new ConflictException(
        'Baseline attempt is not waiting for human review'
      );
    }

    await this.prisma.governanceExecutionAttempt.update({
      where: { id: attempt.id },
      data: {
        status: GovernanceExecutionAttemptStatus.ResolvedByHuman,
        finishedAt: new Date(),
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });
  }

  async retryDiscovery(scopeId: string) {
    const attempt = await this.findLatestAutomationAttempt({
      stageType: GovernanceAutomationStage.Discovery,
      subjectType: GovernanceAutomationSubjectType.Scope,
      subjectId: scopeId
    });
    if (!attempt) {
      throw new NotFoundException(
        `Discovery attempt not found for scope: ${scopeId}`
      );
    }
    if (attempt.status !== GovernanceExecutionAttemptStatus.NeedsHumanReview) {
      throw new ConflictException(
        'Discovery attempt is not waiting for human review'
      );
    }

    await this.prisma.governanceExecutionAttempt.update({
      where: { id: attempt.id },
      data: {
        status: GovernanceExecutionAttemptStatus.ResolvedByHuman,
        finishedAt: new Date(),
        ownerLeaseToken: null,
        leaseExpiresAt: null
      }
    });
  }

  async retryPlanning(issueId: string) {
    const attempt = await this.findLatestAutomationAttempt({
      stageType: GovernanceAutomationStage.Planning,
      subjectType: GovernanceAutomationSubjectType.Issue,
      subjectId: issueId
    });
    if (!attempt) {
      throw new NotFoundException(`Planning attempt not found for issue: ${issueId}`);
    }
    if (attempt.status !== GovernanceExecutionAttemptStatus.NeedsHumanReview) {
      throw new ConflictException('Planning attempt is not waiting for human review');
    }

    await this.prisma.$transaction([
      this.prisma.governanceExecutionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: GovernanceExecutionAttemptStatus.ResolvedByHuman,
          finishedAt: new Date(),
          ownerLeaseToken: null,
          leaseExpiresAt: null
        }
      }),
      this.prisma.issue.update({
        where: { id: issueId },
        data: {
          ownerLeaseToken: null,
          leaseExpiresAt: null
        }
      })
    ]);
  }

  async createFinding(input: {
    scopeId: string;
    source: GovernanceFindingRecord['source'];
    sourceRef?: string;
    title: string;
    summary: string;
    evidence: unknown;
    categories: string[];
    tags: string[];
    severityHint?: GovernanceFindingRecord['severityHint'];
    confidence?: number;
    affectedTargets: unknown;
    metadata?: Record<string, unknown>;
    fingerprint?: string;
    discoveredAt?: Date;
  }) {
    const finding = await this.prisma.finding.create({
      data: {
        scopeId: input.scopeId,
        source: input.source,
        sourceRef: input.sourceRef ?? null,
        title: input.title,
        summary: input.summary,
        evidence: input.evidence as Prisma.InputJsonValue,
        categories: input.categories as Prisma.InputJsonValue,
        tags: input.tags as Prisma.InputJsonValue,
        severityHint: input.severityHint ?? null,
        confidence: input.confidence ?? null,
        affectedTargets: input.affectedTargets as Prisma.InputJsonValue,
        fingerprint: input.fingerprint ?? null,
        discoveredAt: input.discoveredAt ?? new Date(),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {})
      }
    });

    return toGovernanceFindingRecord(finding, null);
  }

  async listFindings(filter: {
    scopeId?: string;
    status?: GovernanceFindingRecord['status'];
  }) {
    const findings = await this.prisma.finding.findMany({
      where: {
        ...(filter.scopeId ? { scopeId: filter.scopeId } : {}),
        ...(filter.status ? { status: filter.status } : {})
      },
      orderBy: { updatedAt: 'desc' }
    });

    const attemptsBySubject = await this.loadLatestAttemptsBySubject({
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectIds: findings.map((finding) => finding.id)
    });

    return findings.map((finding) =>
      toGovernanceFindingRecord(finding, attemptsBySubject.get(finding.id) ?? null)
    );
  }

  async listIssues(filter: {
    scopeId?: string;
    status?: GovernanceIssueRecord['status'];
  }) {
    const issues = await this.prisma.issue.findMany({
      where: {
        ...(filter.scopeId ? { scopeId: filter.scopeId } : {}),
        ...(filter.status ? { status: filter.status } : {})
      },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        resolutionDecisions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        changePlans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const attemptsBySubject = await this.loadLatestAttemptsBySubject({
      stageType: GovernanceAutomationStage.Planning,
      subjectType: GovernanceAutomationSubjectType.Issue,
      subjectIds: issues.map((issue) => issue.id)
    });

    return issues.map((issue) => ({
      ...toGovernanceIssueRecord(issue),
      latestAssessment: issue.assessments[0]
        ? toIssueAssessmentRecord(issue.assessments[0])
        : null,
      latestResolutionDecision: issue.resolutionDecisions[0]
        ? toResolutionDecisionRecord(issue.resolutionDecisions[0])
        : null,
      latestChangePlanStatus:
        (issue.changePlans[0]?.status as GovernanceChangePlanStatus | undefined) ??
        null,
      relatedFindingCount: getStringArray(issue.relatedFindingIds).length,
      latestPlanningAttempt: attemptsBySubject.get(issue.id) ?? null
    }));
  }

  async listChangeUnits(filter: {
    scopeId?: string;
    issueId?: string;
    status?: ChangeUnitRecord['status'];
  }) {
    const changeUnits = await this.prisma.changeUnit.findMany({
      where: {
        ...(filter.issueId ? { issueId: filter.issueId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.scopeId ? { issue: { scopeId: filter.scopeId } } : {})
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    const changeUnitIds = changeUnits.map((changeUnit) => changeUnit.id);
    const [executionAttemptsBySubject, verificationResults] = await Promise.all([
      this.loadLatestAttemptsBySubject({
        stageType: GovernanceAutomationStage.Execution,
        subjectType: GovernanceAutomationSubjectType.ChangeUnit,
        subjectIds: changeUnitIds
      }),
      changeUnitIds.length > 0
        ? this.prisma.verificationResult.findMany({
            where: {
              changeUnitId: { in: changeUnitIds }
            },
            orderBy: [{ executedAt: 'desc' }, { createdAt: 'desc' }]
          })
        : Promise.resolve([])
    ]);

    const latestVerificationByChangeUnit = new Map<string, VerificationResultRecord>();
    for (const verificationResult of verificationResults) {
      if (
        verificationResult.changeUnitId &&
        !latestVerificationByChangeUnit.has(verificationResult.changeUnitId)
      ) {
        latestVerificationByChangeUnit.set(
          verificationResult.changeUnitId,
          toVerificationResultRecord(verificationResult)
        );
      }
    }

    return changeUnits.map((changeUnit) =>
      toChangeUnitRecord(
        changeUnit,
        executionAttemptsBySubject.get(changeUnit.id) ?? null,
        latestVerificationByChangeUnit.get(changeUnit.id) ?? null
      )
    );
  }

  async listDeliveryArtifacts(filter: {
    scopeId?: string;
    status?: DeliveryArtifactRecord['status'];
  }) {
    const artifacts = await this.prisma.deliveryArtifact.findMany({
      where: {
        ...(filter.scopeId ? { scopeId: filter.scopeId } : {}),
        ...(filter.status ? { status: filter.status } : {})
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return artifacts.map(toDeliveryArtifactRecord);
  }

  async getIssueDetail(id: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        resolutionDecisions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        changePlans: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!issue) {
      return null;
    }

    const relatedFindingIds = getStringArray(issue.relatedFindingIds);
    const latestChangePlan = issue.changePlans[0] ?? null;

    const [relatedFindings, planningAttempt, changeUnits, verificationPlans, deliveryArtifact] =
      await Promise.all([
        relatedFindingIds.length > 0
          ? this.prisma.finding.findMany({
              where: { id: { in: relatedFindingIds } },
              orderBy: { updatedAt: 'desc' }
            })
          : Promise.resolve([]),
        this.findLatestAutomationAttempt({
          stageType: GovernanceAutomationStage.Planning,
          subjectType: GovernanceAutomationSubjectType.Issue,
          subjectId: issue.id
        }),
        latestChangePlan
          ? this.prisma.changeUnit.findMany({
              where: { changePlanId: latestChangePlan.id },
              orderBy: [{ createdAt: 'asc' }]
            })
          : Promise.resolve([]),
        latestChangePlan
          ? this.prisma.verificationPlan.findMany({
              where: {
                OR: [
                  { changePlanId: latestChangePlan.id },
                  { changeUnitId: { in: [] } }
                ]
              },
              orderBy: { createdAt: 'asc' }
            })
          : Promise.resolve([]),
        this.prisma.deliveryArtifact.findFirst({
          where: { issueId: issue.id },
          orderBy: [{ createdAt: 'desc' }]
        })
      ]);

    const triageAttemptsBySubject = await this.loadLatestAttemptsBySubject({
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectIds: relatedFindings.map((finding) => finding.id)
    });

    const changeUnitIds = changeUnits.map((unit) => unit.id);
    const [
      unitVerificationPlans,
      verificationResults,
      executionAttemptsBySubject
    ] = await Promise.all([
      latestChangePlan && changeUnitIds.length > 0
        ? this.prisma.verificationPlan.findMany({
            where: {
              changeUnitId: { in: changeUnitIds }
            },
            orderBy: { createdAt: 'asc' }
          })
        : Promise.resolve([]),
      latestChangePlan
        ? this.prisma.verificationResult.findMany({
            where: {
              OR: [
                { changePlanId: latestChangePlan.id },
                changeUnitIds.length > 0
                  ? { changeUnitId: { in: changeUnitIds } }
                  : { changeUnitId: '__never__' }
              ]
            },
            orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }]
          })
        : Promise.resolve([]),
      this.loadLatestAttemptsBySubject({
        stageType: GovernanceAutomationStage.Execution,
        subjectType: GovernanceAutomationSubjectType.ChangeUnit,
        subjectIds: changeUnitIds
      })
    ]);

    const latestVerificationByChangeUnit = new Map<string, VerificationResultRecord>();
    let planLevelVerificationResult: VerificationResultRecord | null = null;
    for (const result of verificationResults) {
      const record = toVerificationResultRecord(result);
      if (record.changeUnitId && !latestVerificationByChangeUnit.has(record.changeUnitId)) {
        latestVerificationByChangeUnit.set(record.changeUnitId, record);
      }
      if (
        record.subjectType === GovernanceVerificationSubjectType.ChangePlan &&
        planLevelVerificationResult === null
      ) {
        planLevelVerificationResult = record;
      }
    }

    return {
      ...toGovernanceIssueRecord(issue),
      latestAssessment: issue.assessments[0]
        ? toIssueAssessmentRecord(issue.assessments[0])
        : null,
      latestResolutionDecision: issue.resolutionDecisions[0]
        ? toResolutionDecisionRecord(issue.resolutionDecisions[0])
        : null,
      relatedFindings: relatedFindings.map((finding) =>
        toGovernanceFindingRecord(
          finding,
          triageAttemptsBySubject.get(finding.id) ?? null
        )
      ),
      changePlan: latestChangePlan ? toChangePlanRecord(latestChangePlan) : null,
      changeUnits: changeUnits.map((unit) =>
        toChangeUnitRecord(
          unit,
          executionAttemptsBySubject.get(unit.id) ?? null,
          latestVerificationByChangeUnit.get(unit.id) ?? null
        )
      ),
      verificationPlans: [...verificationPlans, ...unitVerificationPlans].map(
        toVerificationPlanRecord
      ),
      verificationResults: verificationResults.map(toVerificationResultRecord),
      planLevelVerificationResult,
      deliveryArtifact: deliveryArtifact
        ? toDeliveryArtifactRecord(deliveryArtifact)
        : null,
      latestPlanningAttempt: planningAttempt
    };
  }

  async getChangeUnitExecutionContext(changeUnitId: string) {
    const changeUnit = await this.prisma.changeUnit.findUnique({
      where: { id: changeUnitId },
      include: {
        issue: true,
        changePlan: true
      }
    });
    if (!changeUnit) {
      return null;
    }

    const [project, unitVerificationPlan, planVerificationPlan, latestExecutionAttempt, latestVerificationResult] =
      await Promise.all([
        this.getProjectSource(changeUnit.issue.scopeId),
        this.prisma.verificationPlan.findFirst({
          where: {
            changeUnitId: changeUnit.id,
            subjectType: GovernanceVerificationSubjectType.ChangeUnit
          },
          orderBy: [{ createdAt: 'desc' }]
        }),
        this.prisma.verificationPlan.findFirst({
          where: {
            changePlanId: changeUnit.changePlanId,
            subjectType: GovernanceVerificationSubjectType.ChangePlan
          },
          orderBy: [{ createdAt: 'desc' }]
        }),
        this.findLatestAutomationAttempt({
          stageType: GovernanceAutomationStage.Execution,
          subjectType: GovernanceAutomationSubjectType.ChangeUnit,
          subjectId: changeUnit.id
        }),
        this.findLatestVerificationResultForChangeUnit(changeUnit.id)
      ]);

    if (!project) {
      return null;
    }

    return {
      scopeId: changeUnit.issue.scopeId,
      project,
      issue: toGovernanceIssueRecord(changeUnit.issue),
      changePlan: toChangePlanRecord(changeUnit.changePlan),
      changeUnit: toChangeUnitRecord(
        changeUnit,
        latestExecutionAttempt,
        latestVerificationResult
      ),
      unitVerificationPlan: unitVerificationPlan
        ? toVerificationPlanRecord(unitVerificationPlan)
        : null,
      planVerificationPlan: planVerificationPlan
        ? toVerificationPlanRecord(planVerificationPlan)
        : null
    };
  }

  async createVerificationResult(input: {
    verificationPlanId: string;
    subjectType: GovernanceVerificationSubjectType;
    changeUnitId?: string | null;
    changePlanId?: string | null;
    issueId?: string | null;
    executionAttemptNo: number;
    status: GovernanceVerificationResultStatus;
    checkResults: Array<{
      checkId: string;
      status: 'passed' | 'failed' | 'skipped';
      summary: string;
      artifactRefs?: string[];
    }>;
    summary: string;
  }) {
    const result = await this.prisma.verificationResult.create({
      data: {
        verificationPlanId: input.verificationPlanId,
        subjectType: input.subjectType,
        changeUnitId: input.changeUnitId ?? null,
        changePlanId: input.changePlanId ?? null,
        issueId: input.issueId ?? null,
        executionAttemptNo: input.executionAttemptNo,
        status: input.status,
        checkResults: input.checkResults as Prisma.InputJsonValue,
        summary: input.summary,
        executedAt: new Date()
      }
    });

    return toVerificationResultRecord(result);
  }

  async updateChangeUnitExecutionState(input: {
    changeUnitId: string;
    expectedVersion?: number;
    status: GovernanceChangeUnitStatus;
    currentAttemptNo?: number;
    ownerLeaseToken?: string | null;
    leaseExpiresAt?: Date | null;
  }) {
    const updated = await this.prisma.changeUnit.updateMany({
      where: {
        id: input.changeUnitId,
        ...(input.expectedVersion !== undefined
          ? { version: input.expectedVersion }
          : {})
      },
      data: {
        status: input.status,
        ...(input.currentAttemptNo !== undefined
          ? { currentAttemptNo: input.currentAttemptNo }
          : {}),
        ...(input.ownerLeaseToken !== undefined
          ? { ownerLeaseToken: input.ownerLeaseToken }
          : {}),
        ...(input.leaseExpiresAt !== undefined
          ? { leaseExpiresAt: input.leaseExpiresAt }
          : {}),
        version: { increment: 1 }
      }
    });

    return updated.count === 1;
  }

  async appendChangeUnitCommit(input: {
    changeUnitId: string;
    commitId: string;
    expectedVersion?: number;
    ownerLeaseToken?: string | null;
  }) {
    const changeUnit = await this.prisma.changeUnit.findUnique({
      where: { id: input.changeUnitId }
    });
    if (!changeUnit) {
      return false;
    }
    if (
      input.expectedVersion !== undefined &&
      changeUnit.version !== input.expectedVersion
    ) {
      return false;
    }
    const producedCommitIds = getStringArray(changeUnit.producedCommitIds);
    const nextCommitIds = [...producedCommitIds, input.commitId];
    const updated = await this.prisma.changeUnit.updateMany({
      where: {
        id: input.changeUnitId,
        ...(input.ownerLeaseToken !== undefined
          ? { ownerLeaseToken: input.ownerLeaseToken }
          : {}),
        ...(input.expectedVersion !== undefined
          ? { version: input.expectedVersion }
          : { version: changeUnit.version })
      },
      data: {
        status: GovernanceChangeUnitStatus.Committed,
        producedCommitIds: nextCommitIds as Prisma.InputJsonValue,
        ownerLeaseToken: null,
        leaseExpiresAt: null,
        version: { increment: 1 }
      }
    });
    return updated.count === 1;
  }

  async updateIssueState(input: {
    issueId: string;
    expectedVersion?: number;
    status: GovernanceIssueStatus;
    ownerLeaseToken?: string | null;
    leaseExpiresAt?: Date | null;
  }) {
    const updated = await this.prisma.issue.updateMany({
      where: {
        id: input.issueId,
        ...(input.expectedVersion !== undefined
          ? { version: input.expectedVersion }
          : {})
      },
      data: {
        status: input.status,
        ...(input.ownerLeaseToken !== undefined
          ? { ownerLeaseToken: input.ownerLeaseToken }
          : {}),
        ...(input.leaseExpiresAt !== undefined
          ? { leaseExpiresAt: input.leaseExpiresAt }
          : {}),
        version: { increment: 1 }
      }
    });

    return updated.count === 1;
  }

  async createOrUpdateDeliveryArtifact(input: {
    scopeId: string;
    issueId: string;
    changePlanId?: string | null;
    kind: GovernanceDeliveryArtifactKind;
    title: string;
    body: string;
    linkedIssueIds: string[];
    linkedChangeUnitIds: string[];
    linkedVerificationResultIds: string[];
    bodyStrategy: GovernanceDeliveryBodyStrategy;
    status: GovernanceDeliveryArtifactStatus;
  }) {
    const existing = await this.prisma.deliveryArtifact.findFirst({
      where: {
        issueId: input.issueId
      },
      orderBy: [{ createdAt: 'desc' }]
    });

    const artifact = existing
      ? await this.prisma.deliveryArtifact.update({
          where: { id: existing.id },
          data: {
            changePlanId: input.changePlanId ?? null,
            kind: input.kind,
            title: input.title,
            body: input.body,
            linkedIssueIds: input.linkedIssueIds as Prisma.InputJsonValue,
            linkedChangeUnitIds: input.linkedChangeUnitIds as Prisma.InputJsonValue,
            linkedVerificationResultIds:
              input.linkedVerificationResultIds as Prisma.InputJsonValue,
            bodyStrategy: input.bodyStrategy,
            status: input.status
          }
        })
      : await this.prisma.deliveryArtifact.create({
          data: {
            scopeId: input.scopeId,
            issueId: input.issueId,
            changePlanId: input.changePlanId ?? null,
            kind: input.kind,
            title: input.title,
            body: input.body,
            linkedIssueIds: input.linkedIssueIds as Prisma.InputJsonValue,
            linkedChangeUnitIds: input.linkedChangeUnitIds as Prisma.InputJsonValue,
            linkedVerificationResultIds:
              input.linkedVerificationResultIds as Prisma.InputJsonValue,
            bodyStrategy: input.bodyStrategy,
            status: input.status
          }
        });

    return toDeliveryArtifactRecord(artifact);
  }

  async updateDeliveryArtifactStatus(input: {
    deliveryArtifactId: string;
    status: GovernanceDeliveryArtifactStatus;
  }) {
    const updated = await this.prisma.deliveryArtifact.updateMany({
      where: { id: input.deliveryArtifactId },
      data: {
        status: input.status
      }
    });

    return updated.count === 1;
  }

  async submitResolutionDecision(input: {
    issueId: string;
    resolution: ResolutionDecisionRecord['resolution'];
    reason: string;
    deferUntil: Date | null;
    primaryIssueId?: string | null;
    approvedBy?: string | null;
    nextIssueStatus: GovernanceIssueRecord['status'];
    expectedVersion: number;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.resolutionDecision.create({
        data: {
          issueId: input.issueId,
          resolution: input.resolution,
          reason: input.reason,
          deferUntil: input.deferUntil,
          primaryIssueId: input.primaryIssueId ?? null,
          approvedBy: input.approvedBy ?? null,
          decidedAt: new Date()
        }
      });

      const updateResult = await tx.issue.updateMany({
        where: {
          id: input.issueId,
          version: input.expectedVersion
        },
        data: {
          status: input.nextIssueStatus,
          version: { increment: 1 }
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('Issue was updated by another process');
      }
    });
  }

  async dismissFinding(input: {
    findingId: string;
    reviewer: string;
    comment?: string;
  }) {
    await this.prisma.$transaction(async (tx) => {
      const finding = await tx.finding.findUnique({
        where: { id: input.findingId }
      });

      if (!finding) {
        throw new NotFoundException(`Finding not found: ${input.findingId}`);
      }

      await tx.reviewDecision.create({
        data: {
          scopeId: finding.scopeId,
          subjectType: 'finding',
          subjectId: input.findingId,
          decision: 'dismissed',
          comment: input.comment ?? null,
          reviewer: input.reviewer
        }
      });

      await tx.finding.update({
        where: { id: input.findingId },
        data: {
          status: GovernanceFindingStatus.Dismissed,
          version: { increment: 1 }
        }
      });
    });
  }

  async overrideAssessment(input: {
    assessmentId: string;
    reviewer: string;
    comment?: string;
    assessmentOverride: Record<string, unknown>;
  }) {
    const issueId = await this.prisma.$transaction(async (tx) => {
      const assessment = await tx.issueAssessment.findUnique({
        where: { id: input.assessmentId }
      });

      if (!assessment) {
        throw new NotFoundException(`Assessment not found: ${input.assessmentId}`);
      }

      const issue = await tx.issue.findUnique({
        where: { id: assessment.issueId },
        select: { scopeId: true }
      });

      if (!issue) {
        throw new NotFoundException(`Issue not found: ${assessment.issueId}`);
      }

      await tx.reviewDecision.create({
        data: {
          scopeId: issue.scopeId,
          subjectType: 'assessment',
          subjectId: input.assessmentId,
          decision: 'approved',
          assessmentOverride: input.assessmentOverride as Prisma.InputJsonValue,
          comment: input.comment ?? null,
          reviewer: input.reviewer
        }
      });

      await tx.issueAssessment.create({
        data: {
          issueId: assessment.issueId,
          severity:
            (input.assessmentOverride.severity as string | undefined) ??
            assessment.severity,
          priority:
            (input.assessmentOverride.priority as string | undefined) ??
            assessment.priority,
          userImpact: assessment.userImpact,
          systemRisk: assessment.systemRisk,
          strategicValue: assessment.strategicValue,
          fixCost: assessment.fixCost,
          autoActionEligibility:
            (input.assessmentOverride.autoActionEligibility as string | undefined) ??
            assessment.autoActionEligibility,
          rationale: assessment.rationale as Prisma.InputJsonValue,
          assessedBy: 'human',
          assessedAt: new Date()
        }
      });

      return assessment.issueId;
    });

    return issueId;
  }

  async reviewChangePlan(input: {
    changePlanId: string;
    reviewer: string;
    comment?: string;
    decision:
      | GovernanceReviewDecisionType.Approved
      | GovernanceReviewDecisionType.Rejected;
  }) {
    const issueId = await this.prisma.$transaction(async (tx) => {
      const changePlan = await tx.changePlan.findUnique({
        where: { id: input.changePlanId }
      });

      if (!changePlan) {
        throw new NotFoundException(`Change plan not found: ${input.changePlanId}`);
      }

      const issue = await tx.issue.findUnique({
        where: { id: changePlan.issueId },
        select: { scopeId: true }
      });

      if (!issue) {
        throw new NotFoundException(`Issue not found: ${changePlan.issueId}`);
      }

      await tx.reviewDecision.create({
        data: {
          scopeId: issue.scopeId,
          subjectType: 'change_plan',
          subjectId: input.changePlanId,
          decision: input.decision,
          comment: input.comment ?? null,
          reviewer: input.reviewer
        }
      });

      await tx.changePlan.update({
        where: { id: input.changePlanId },
        data: {
          status:
            input.decision === GovernanceReviewDecisionType.Approved
              ? GovernanceChangePlanStatus.Approved
              : GovernanceChangePlanStatus.Rejected,
          version: { increment: 1 }
        }
      });

      await tx.issue.update({
        where: { id: changePlan.issueId },
        data: {
          status:
            input.decision === GovernanceReviewDecisionType.Approved
              ? GovernanceIssueStatus.Planned
              : GovernanceIssueStatus.Open,
          version: { increment: 1 }
        }
      });

      return changePlan.issueId;
    });

    return issueId;
  }

  async reviewChangeUnit(input: {
    changeUnitId: string;
    reviewer: string;
    comment?: string;
    decision:
      | GovernanceReviewDecisionType.Approved
      | GovernanceReviewDecisionType.Rejected
      | GovernanceReviewDecisionType.Retry
      | GovernanceReviewDecisionType.EditAndContinue
      | GovernanceReviewDecisionType.Skip
      | GovernanceReviewDecisionType.Terminate;
  }) {
    const issueId = await this.prisma.$transaction(async (tx) => {
      const changeUnit = await tx.changeUnit.findUnique({
        where: { id: input.changeUnitId },
        include: { issue: true }
      });
      if (!changeUnit) {
        throw new NotFoundException(`Change unit not found: ${input.changeUnitId}`);
      }

      await tx.reviewDecision.create({
        data: {
          scopeId: changeUnit.issue.scopeId,
          subjectType: 'change_unit',
          subjectId: input.changeUnitId,
          decision: input.decision,
          comment: input.comment ?? null,
          reviewer: input.reviewer
        }
      });

      return changeUnit.issueId;
    });

    return issueId;
  }

  async reviewDeliveryArtifact(input: {
    deliveryArtifactId: string;
    reviewer: string;
    comment?: string;
    decision:
      | GovernanceReviewDecisionType.Approved
      | GovernanceReviewDecisionType.Rejected;
  }) {
    const issueId = await this.prisma.$transaction(async (tx) => {
      const artifact = await tx.deliveryArtifact.findUnique({
        where: { id: input.deliveryArtifactId }
      });
      if (!artifact) {
        throw new NotFoundException(
          `Delivery artifact not found: ${input.deliveryArtifactId}`
        );
      }

      await tx.reviewDecision.create({
        data: {
          scopeId: artifact.scopeId,
          subjectType: 'delivery_artifact',
          subjectId: input.deliveryArtifactId,
          decision: input.decision,
          comment: input.comment ?? null,
          reviewer: input.reviewer
        }
      });

      return artifact.issueId;
    });

    return issueId;
  }

  async findDeliveryArtifactById(id: string) {
    const artifact = await this.prisma.deliveryArtifact.findUnique({
      where: { id }
    });
    return artifact ? toDeliveryArtifactRecord(artifact) : null;
  }

  async findSpinOffIssueBySourceIssueId(issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: {
        spinOffOfIssueId: issueId
      },
      orderBy: [{ createdAt: 'desc' }]
    });
    return issue ? toGovernanceIssueRecord(issue) : null;
  }

  async createIssueWithAssessment(input: CreateIssueWithAssessmentInput) {
    const issueId = await this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.create({
        data: {
          scopeId: input.scopeId,
          title: input.title,
          statement: input.statement,
          kind: input.kind,
          categories: input.categories as Prisma.InputJsonValue,
          tags: (input.tags ?? []) as Prisma.InputJsonValue,
          relatedFindingIds: (input.relatedFindingIds ?? []) as Prisma.InputJsonValue,
          status: GovernanceIssueStatus.Open,
          affectedTargets: input.affectedTargets as Prisma.InputJsonValue,
          rootCause: input.rootCause ?? null,
          impactSummary: input.impactSummary,
          isRegression: input.isRegression ?? false,
          regressionOfIssueId: input.regressionOfIssueId ?? null,
          spinOffOfIssueId: input.spinOffOfIssueId ?? null
        }
      });

      await tx.issueAssessment.create({
        data: {
          issueId: issue.id,
          severity: input.assessment.severity,
          priority: input.assessment.priority,
          userImpact: input.assessment.userImpact,
          systemRisk: input.assessment.systemRisk,
          strategicValue: input.assessment.strategicValue,
          fixCost: input.assessment.fixCost,
          autoActionEligibility: input.assessment.autoActionEligibility,
          rationale: input.assessment.rationale as Prisma.InputJsonValue,
          assessedBy: input.assessment.assessedBy,
          assessedAt: input.assessment.assessedAt ?? new Date()
        }
      });

      if ((input.relatedFindingIds?.length ?? 0) > 0) {
        await tx.findingMergeRecord.create({
          data: {
            scopeId: input.scopeId,
            targetIssueId: issue.id,
            mergedFindingIds: input.relatedFindingIds as Prisma.InputJsonValue,
            trigger: 'human_merge',
            mergedAt: new Date()
          }
        });
        await tx.finding.updateMany({
          where: { id: { in: input.relatedFindingIds } },
          data: {
            status: GovernanceFindingStatus.Merged,
            version: { increment: 1 }
          }
        });
      }

      return issue.id;
    });

    const detail = await this.getIssueDetail(issueId);
    if (!detail) {
      throw new ConflictException(`Issue not found after create: ${issueId}`);
    }
    return detail;
  }

  async createChangePlanBundle(input: CreateChangePlanBundleInput) {
    const issueId = await this.createChangePlanBundleInternal(input, false);
    const detail = await this.getIssueDetail(issueId);
    if (!detail) {
      throw new ConflictException(`Issue not found after plan create: ${issueId}`);
    }
    return detail;
  }

  async createPlanningBundleFromAutomation(input: CreateChangePlanBundleInput) {
    const issueId = await this.createChangePlanBundleInternal(input, true);
    const detail = await this.getIssueDetail(issueId);
    if (!detail) {
      throw new ConflictException(`Issue not found after plan create: ${issueId}`);
    }
    return detail;
  }

  private async createChangePlanBundleInternal(
    input: CreateChangePlanBundleInput,
    supersedePrevious: boolean
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (supersedePrevious) {
        await tx.changePlan.updateMany({
          where: {
            issueId: input.issueId,
            status: {
              in: [
                GovernanceChangePlanStatus.Draft,
                GovernanceChangePlanStatus.Rejected
              ]
            }
          },
          data: {
            status: GovernanceChangePlanStatus.Superseded,
            version: { increment: 1 }
          }
        });
      }

      const changePlan = await tx.changePlan.create({
        data: {
          issueId: input.issueId,
          objective: input.objective,
          strategy: input.strategy,
          affectedTargets: input.affectedTargets as Prisma.InputJsonValue,
          proposedActions: input.proposedActions as Prisma.InputJsonValue,
          risks: input.risks as Prisma.InputJsonValue,
          rollbackPlan: input.rollbackPlan ?? null,
          ...(input.assumptions !== undefined && input.assumptions !== null
            ? { assumptions: input.assumptions as Prisma.InputJsonValue }
            : {}),
          baselineCommitSha: input.baselineCommitSha,
          status: input.status ?? GovernanceChangePlanStatus.Draft
        }
      });

      const createdUnits: PrismaChangeUnit[] = [];
      for (const unit of input.changeUnits) {
        const createdUnit = await tx.changeUnit.create({
          data: {
            changePlanId: changePlan.id,
            issueId: input.issueId,
            sourceActionId: unit.sourceActionId,
            dependsOnUnitIds: (unit.dependsOnUnitIds ?? []) as Prisma.InputJsonValue,
            title: unit.title,
            description: unit.description,
            scope: unit.scope as Prisma.InputJsonValue,
            executionMode: unit.executionMode,
            maxRetries: unit.maxRetries ?? 3,
            currentAttemptNo: unit.currentAttemptNo ?? 0,
            status: unit.status ?? GovernanceChangeUnitStatus.Pending,
            producedCommitIds: (unit.producedCommitIds ?? []) as Prisma.InputJsonValue
          }
        });
        createdUnits.push(createdUnit);
      }

      for (const verificationPlan of input.verificationPlans) {
        await tx.verificationPlan.create({
          data: {
            subjectType: verificationPlan.subjectType,
            changePlanId:
              verificationPlan.subjectType === 'change_plan'
                ? changePlan.id
                : null,
            changeUnitId:
              verificationPlan.subjectType === 'change_unit' &&
              verificationPlan.changeUnitIndex !== undefined
                ? createdUnits[verificationPlan.changeUnitIndex]?.id ?? null
                : null,
            issueId: input.issueId,
            checks: verificationPlan.checks as Prisma.InputJsonValue,
            passCriteria: verificationPlan.passCriteria as Prisma.InputJsonValue
          }
        });
      }

      return input.issueId;
    });
  }

  private async areChangeUnitDependenciesReady(changeUnitIds: string[]) {
    if (changeUnitIds.length === 0) {
      return true;
    }

    const dependencies = await this.prisma.changeUnit.findMany({
      where: {
        id: { in: changeUnitIds }
      },
      select: {
        status: true
      }
    });

    if (dependencies.length !== changeUnitIds.length) {
      return false;
    }

    return dependencies.every((unit) =>
      [
        GovernanceChangeUnitStatus.Verified,
        GovernanceChangeUnitStatus.Committed,
        GovernanceChangeUnitStatus.Merged
      ].includes(unit.status as GovernanceChangeUnitStatus)
    );
  }

  private async findLatestVerificationResultForChangeUnit(changeUnitId: string) {
    return findLatestVerificationResultForChangeUnitInternal(
      this.prisma,
      changeUnitId
    );
  }

  private async loadLatestAttemptsBySubject(input: {
    stageType: GovernanceAutomationStage;
    subjectType: GovernanceAutomationSubjectType;
    subjectIds: string[];
  }) {
    const latestBySubject = new Map<string, GovernanceExecutionAttemptRecord>();
    if (input.subjectIds.length === 0) {
      return latestBySubject;
    }

    const attempts = await this.prisma.governanceExecutionAttempt.findMany({
      where: {
        stageType: input.stageType,
        subjectType: input.subjectType,
        subjectId: { in: input.subjectIds }
      },
      orderBy: [{ subjectId: 'asc' }, { attemptNo: 'desc' }, { createdAt: 'desc' }]
    });

    for (const attempt of attempts) {
      if (!latestBySubject.has(attempt.subjectId)) {
        latestBySubject.set(
          attempt.subjectId,
          toGovernanceExecutionAttemptRecord(attempt)
        );
      }
    }

    return latestBySubject;
  }

  private async hasRunningSiblingInChangePlan(
    changePlanId: string,
    changeUnitId: string
  ) {
    const runningSibling = await this.prisma.changeUnit.findFirst({
      where: {
        changePlanId,
        id: { not: changeUnitId },
        status: GovernanceChangeUnitStatus.Running
      },
      select: { id: true }
    });

    return Boolean(runningSibling);
  }

  private async hasRunningCrossPlanTargetConflict(input: {
    scopeId: string;
    changePlanId: string;
    changeUnitId: string;
    targets: Array<{ kind: string; ref: string }>;
  }) {
    if (input.targets.length === 0) {
      return false;
    }

    const runningUnits = await this.prisma.changeUnit.findMany({
      where: {
        issue: { scopeId: input.scopeId },
        changePlanId: { not: input.changePlanId },
        id: { not: input.changeUnitId },
        status: GovernanceChangeUnitStatus.Running
      },
      select: {
        scope: true
      }
    });

    const targetRefs = new Set(
      input.targets.map((target) => `${target.kind}:${target.ref}`)
    );

    return runningUnits.some((unit) =>
      getTargetRefs(unit.scope).some((target) =>
        targetRefs.has(`${target.kind}:${target.ref}`)
      )
    );
  }
}

function toRepositoryProfileRecord(
  profile: PrismaRepositoryProfile
): RepositoryProfileRecord {
  return {
    id: profile.id,
    scopeId: profile.scopeId,
    branch: profile.branch,
    snapshotAt: profile.snapshotAt,
    modules: profile.modules,
    testBaseline: profile.testBaseline,
    buildStatus: profile.buildStatus as RepositoryProfileRecord['buildStatus'],
    metadata: profile.metadata,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function toGovernanceFindingRecord(
  finding: PrismaFinding,
  latestTriageAttempt: GovernanceExecutionAttemptRecord | null
): GovernanceFindingRecord {
  return {
    id: finding.id,
    scopeId: finding.scopeId,
    source: finding.source as GovernanceFindingRecord['source'],
    sourceRef: finding.sourceRef,
    title: finding.title,
    summary: finding.summary,
    evidence: finding.evidence,
    categories: finding.categories,
    tags: finding.tags,
    severityHint: finding.severityHint as GovernanceFindingRecord['severityHint'],
    confidence: finding.confidence,
    affectedTargets: finding.affectedTargets,
    metadata: finding.metadata,
    fingerprint: finding.fingerprint,
    discoveredAt: finding.discoveredAt,
    status: finding.status as GovernanceFindingRecord['status'],
    version: finding.version,
    latestTriageAttempt,
    createdAt: finding.createdAt,
    updatedAt: finding.updatedAt
  };
}

function toGovernanceIssueRecord(issue: PrismaIssue): GovernanceIssueRecord {
  return {
    id: issue.id,
    scopeId: issue.scopeId,
    title: issue.title,
    statement: issue.statement,
    kind: issue.kind as GovernanceIssueRecord['kind'],
    categories: issue.categories,
    tags: issue.tags,
    relatedFindingIds: issue.relatedFindingIds,
    status: issue.status as GovernanceIssueRecord['status'],
    affectedTargets: issue.affectedTargets,
    rootCause: issue.rootCause,
    impactSummary: issue.impactSummary,
    isRegression: issue.isRegression,
    regressionOfIssueId: issue.regressionOfIssueId,
    spinOffOfIssueId: issue.spinOffOfIssueId,
    version: issue.version,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt
  };
}

function toGovernancePolicyRecord(
  policy: {
    id: string;
    scopeId: string;
    priorityPolicy: Prisma.JsonValue;
    autoActionPolicy: Prisma.JsonValue;
    deliveryPolicy: Prisma.JsonValue;
    sourceSelection: Prisma.JsonValue;
    agentStrategy: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }
): GovernancePolicyRecord {
  return {
    id: policy.id,
    scopeId: policy.scopeId,
    priorityPolicy: parsePriorityPolicy(policy.priorityPolicy),
    autoActionPolicy: parseAutoActionPolicy(policy.autoActionPolicy),
    deliveryPolicy: parseDeliveryPolicy(policy.deliveryPolicy),
    sourceSelection: parseSourceSelection(policy.sourceSelection),
    agentStrategy: parseAgentStrategy(policy.agentStrategy),
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt
  };
}

function toIssueAssessmentRecord(
  assessment: PrismaIssueAssessment
): IssueAssessmentRecord {
  return {
    id: assessment.id,
    issueId: assessment.issueId,
    severity: assessment.severity as IssueAssessmentRecord['severity'],
    priority: assessment.priority as IssueAssessmentRecord['priority'],
    userImpact: assessment.userImpact,
    systemRisk: assessment.systemRisk,
    strategicValue: assessment.strategicValue,
    fixCost: assessment.fixCost,
    autoActionEligibility:
      assessment.autoActionEligibility as IssueAssessmentRecord['autoActionEligibility'],
    rationale: assessment.rationale,
    assessedBy: assessment.assessedBy as IssueAssessmentRecord['assessedBy'],
    assessedAt: assessment.assessedAt,
    createdAt: assessment.createdAt
  };
}

function toResolutionDecisionRecord(
  decision: PrismaResolutionDecision
): ResolutionDecisionRecord {
  return {
    id: decision.id,
    issueId: decision.issueId,
    resolution: decision.resolution as ResolutionDecisionRecord['resolution'],
    reason: decision.reason,
    deferUntil: decision.deferUntil,
    primaryIssueId: decision.primaryIssueId,
    approvedBy: decision.approvedBy,
    decidedAt: decision.decidedAt,
    createdAt: decision.createdAt
  };
}

function toChangePlanRecord(changePlan: PrismaChangePlan): ChangePlanRecord {
  return {
    id: changePlan.id,
    issueId: changePlan.issueId,
    objective: changePlan.objective,
    strategy: changePlan.strategy,
    affectedTargets: changePlan.affectedTargets,
    proposedActions: changePlan.proposedActions,
    risks: changePlan.risks,
    rollbackPlan: changePlan.rollbackPlan,
    assumptions: changePlan.assumptions,
    baselineCommitSha: changePlan.baselineCommitSha,
    status: changePlan.status as ChangePlanRecord['status'],
    version: changePlan.version,
    createdAt: changePlan.createdAt,
    updatedAt: changePlan.updatedAt
  };
}

function toChangeUnitRecord(
  changeUnit: PrismaChangeUnit,
  latestExecutionAttempt: GovernanceExecutionAttemptRecord | null = null,
  latestVerificationResult: VerificationResultRecord | null = null
): ChangeUnitRecord {
  return {
    id: changeUnit.id,
    changePlanId: changeUnit.changePlanId,
    issueId: changeUnit.issueId,
    sourceActionId: changeUnit.sourceActionId,
    dependsOnUnitIds: changeUnit.dependsOnUnitIds,
    title: changeUnit.title,
    description: changeUnit.description,
    scope: changeUnit.scope,
    executionMode: changeUnit.executionMode as ChangeUnitRecord['executionMode'],
    maxRetries: changeUnit.maxRetries,
    currentAttemptNo: changeUnit.currentAttemptNo,
    status: changeUnit.status as ChangeUnitRecord['status'],
    producedCommitIds: changeUnit.producedCommitIds,
    latestExecutionAttempt,
    latestVerificationResult,
    version: changeUnit.version,
    createdAt: changeUnit.createdAt,
    updatedAt: changeUnit.updatedAt
  };
}

function toVerificationPlanRecord(
  verificationPlan: PrismaVerificationPlan
): VerificationPlanRecord {
  return {
    id: verificationPlan.id,
    subjectType: verificationPlan.subjectType as VerificationPlanRecord['subjectType'],
    changeUnitId: verificationPlan.changeUnitId,
    changePlanId: verificationPlan.changePlanId,
    issueId: verificationPlan.issueId,
    checks: verificationPlan.checks,
    passCriteria: verificationPlan.passCriteria,
    createdAt: verificationPlan.createdAt
  };
}

function toVerificationResultRecord(
  verificationResult: PrismaVerificationResult
): VerificationResultRecord {
  return {
    id: verificationResult.id,
    verificationPlanId: verificationResult.verificationPlanId,
    subjectType:
      verificationResult.subjectType as VerificationResultRecord['subjectType'],
    changeUnitId: verificationResult.changeUnitId,
    changePlanId: verificationResult.changePlanId,
    issueId: verificationResult.issueId,
    executionAttemptNo: verificationResult.executionAttemptNo,
    status: verificationResult.status as VerificationResultRecord['status'],
    checkResults: verificationResult.checkResults,
    summary: verificationResult.summary,
    executedAt: verificationResult.executedAt,
    createdAt: verificationResult.createdAt
  };
}

function toDeliveryArtifactRecord(
  artifact: PrismaDeliveryArtifact
): DeliveryArtifactRecord {
  return {
    id: artifact.id,
    scopeId: artifact.scopeId,
    issueId: artifact.issueId,
    changePlanId: artifact.changePlanId,
    kind: artifact.kind as DeliveryArtifactRecord['kind'],
    title: artifact.title,
    body: artifact.body,
    linkedIssueIds: artifact.linkedIssueIds,
    linkedChangeUnitIds: artifact.linkedChangeUnitIds,
    linkedVerificationResultIds: artifact.linkedVerificationResultIds,
    bodyStrategy: artifact.bodyStrategy as DeliveryArtifactRecord['bodyStrategy'],
    externalRef: artifact.externalRef,
    status: artifact.status as DeliveryArtifactRecord['status'],
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt
  };
}

function toGovernanceExecutionAttemptRecord(
  attempt: PrismaGovernanceExecutionAttempt
): GovernanceExecutionAttemptRecord {
  return {
    id: attempt.id,
    scopeId: attempt.scopeId,
    stageType: attempt.stageType as GovernanceExecutionAttemptRecord['stageType'],
    subjectType: attempt.subjectType as GovernanceExecutionAttemptRecord['subjectType'],
    subjectId: attempt.subjectId,
    attemptNo: attempt.attemptNo,
    status: attempt.status as GovernanceExecutionAttemptRecord['status'],
    sessionId: attempt.sessionId,
    activeRequestMessageId: attempt.activeRequestMessageId,
    ownerLeaseToken: attempt.ownerLeaseToken,
    leaseExpiresAt: attempt.leaseExpiresAt,
    inputSnapshot: attempt.inputSnapshot,
    candidateOutput: attempt.candidateOutput,
    parsedOutput: attempt.parsedOutput,
    failureCode: attempt.failureCode,
    failureMessage: attempt.failureMessage,
    resolvedByReviewDecisionId: attempt.resolvedByReviewDecisionId,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt
  };
}

function getStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function getTargetRefs(value: Prisma.JsonValue): Array<{ kind: string; ref: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const targets = (value as { targets?: Prisma.JsonValue }).targets;
  return Array.isArray(targets)
    ? targets.filter(
        (item): item is { kind: string; ref: string } =>
          Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof (item as { kind?: unknown }).kind === 'string' &&
          typeof (item as { ref?: unknown }).ref === 'string'
      )
    : [];
}

function parsePriorityPolicy(value: Prisma.JsonValue): GovernancePolicyRecord['priorityPolicy'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_GOVERNANCE_POLICY_INPUT.priorityPolicy;
  }

  return {
    defaultPriority: isGovernancePriority(
      (value as { defaultPriority?: unknown }).defaultPriority
    )
      ? (value as { defaultPriority: GovernancePriority }).defaultPriority
      : DEFAULT_GOVERNANCE_POLICY_INPUT.priorityPolicy.defaultPriority,
    ...(isRecord((value as { severityOverrides?: unknown }).severityOverrides)
      ? {
          severityOverrides: filterRecord(
            (value as { severityOverrides: Record<string, unknown> })
              .severityOverrides,
            isGovernanceSeverity,
            isGovernancePriority
          )
        }
      : {})
  };
}

function parseAutoActionPolicy(
  value: Prisma.JsonValue
): GovernancePolicyRecord['autoActionPolicy'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_GOVERNANCE_POLICY_INPUT.autoActionPolicy;
  }

  return {
    defaultEligibility: isAutoActionEligibility(
      (value as { defaultEligibility?: unknown }).defaultEligibility
    )
      ? (value as { defaultEligibility: GovernanceAutoActionEligibility })
          .defaultEligibility
      : DEFAULT_GOVERNANCE_POLICY_INPUT.autoActionPolicy.defaultEligibility,
    ...(isRecord((value as { severityOverrides?: unknown }).severityOverrides)
      ? {
          severityOverrides: filterRecord(
            (value as { severityOverrides: Record<string, unknown> })
              .severityOverrides,
            isGovernanceSeverity,
            isAutoActionEligibility
          )
        }
      : {}),
    ...(isRecord((value as { issueKindOverrides?: unknown }).issueKindOverrides)
      ? {
          issueKindOverrides: filterRecord(
            (value as { issueKindOverrides: Record<string, unknown> })
              .issueKindOverrides,
            isGovernanceIssueKind,
            isAutoActionEligibility
          )
        }
      : {})
  };
}

function parseDeliveryPolicy(
  value: Prisma.JsonValue
): GovernancePolicyRecord['deliveryPolicy'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_GOVERNANCE_POLICY_INPUT.deliveryPolicy;
  }

  return {
    commitMode:
      (value as { commitMode?: unknown }).commitMode === GovernanceDeliveryCommitMode.Squash
        ? GovernanceDeliveryCommitMode.Squash
        : GovernanceDeliveryCommitMode.PerUnit,
    autoCloseIssueOnApprovedDelivery:
      typeof (value as { autoCloseIssueOnApprovedDelivery?: unknown })
        .autoCloseIssueOnApprovedDelivery === 'boolean'
        ? Boolean(
            (value as { autoCloseIssueOnApprovedDelivery: boolean })
              .autoCloseIssueOnApprovedDelivery
          )
        : DEFAULT_GOVERNANCE_POLICY_INPUT.deliveryPolicy
            .autoCloseIssueOnApprovedDelivery
  };
}

function parseSourceSelection(
  value: Prisma.JsonValue
): GovernancePolicyRecord['sourceSelection'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_GOVERNANCE_SOURCE_SELECTION;
  }

  return {
    repoBranch: getNullableString(
      (value as { repoBranch?: unknown }).repoBranch
    ) ?? null,
    docBranch: getNullableString(
      (value as { docBranch?: unknown }).docBranch
    ) ?? null
  };
}

function parseAgentStrategy(
  value: Prisma.JsonValue
): GovernancePolicyRecord['agentStrategy'] {
  if (!isRecord(value)) {
    return DEFAULT_GOVERNANCE_AGENT_STRATEGY;
  }

  return {
    defaultRunnerIds: getRunnerIdArray(
      (value as { defaultRunnerIds?: unknown }).defaultRunnerIds
    ),
    discovery: parseStageAgentStrategy(
      (value as { discovery?: unknown }).discovery
    ),
    triage: parseStageAgentStrategy(
      (value as { triage?: unknown }).triage
    ),
    planning: parseStageAgentStrategy(
      (value as { planning?: unknown }).planning
    ),
    execution: parseStageAgentStrategy(
      (value as { execution?: unknown }).execution
    )
  };
}

function parseStageAgentStrategy(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return {
    runnerIds: getRunnerIdArray((value as { runnerIds?: unknown }).runnerIds),
    fanoutCount: getPositiveInt((value as { fanoutCount?: unknown }).fanoutCount) ?? 1,
    mergeStrategy: isGovernanceAgentMergeStrategy(
      (value as { mergeStrategy?: unknown }).mergeStrategy
    )
      ? (value as { mergeStrategy: GovernanceAgentMergeStrategy }).mergeStrategy
      : GovernanceAgentMergeStrategy.Single
  };
}

function filterRecord<TKey extends string, TValue extends string>(
  value: Record<string, unknown>,
  isKey: (value: unknown) => value is TKey,
  isValue: (value: unknown) => value is TValue
) {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [TKey, TValue] => isKey(entry[0]) && isValue(entry[1])
    )
  ) as Partial<Record<TKey, TValue>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getRunnerIdArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function getPositiveInt(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function isGovernanceSeverity(value: unknown): value is GovernanceSeverity {
  return (
    value === GovernanceSeverity.Critical ||
    value === GovernanceSeverity.High ||
    value === GovernanceSeverity.Medium ||
    value === GovernanceSeverity.Low
  );
}

function isGovernancePriority(value: unknown): value is GovernancePriority {
  return (
    value === 'p0' || value === 'p1' || value === 'p2' || value === 'p3'
  );
}

function isGovernanceIssueKind(
  value: unknown
): value is GovernanceIssueKind {
  return (
    value === GovernanceIssueKind.Bug ||
    value === GovernanceIssueKind.Risk ||
    value === GovernanceIssueKind.Debt ||
    value === GovernanceIssueKind.Improvement ||
    value === GovernanceIssueKind.Gap ||
    value === GovernanceIssueKind.Violation
  );
}

function isAutoActionEligibility(
  value: unknown
): value is GovernanceAutoActionEligibility {
  return (
    value === GovernanceAutoActionEligibility.AutoAllowed ||
    value === GovernanceAutoActionEligibility.HumanReviewRequired ||
    value === GovernanceAutoActionEligibility.SuggestOnly ||
    value === GovernanceAutoActionEligibility.Forbidden
  );
}

function isGovernanceAgentMergeStrategy(
  value: unknown
): value is GovernanceAgentMergeStrategy {
  return (
    value === GovernanceAgentMergeStrategy.Single ||
    value === GovernanceAgentMergeStrategy.BestOfN ||
    value === GovernanceAgentMergeStrategy.UnionDedup
  );
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function toOptionalJson(value: unknown) {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

async function findLatestVerificationResultForChangeUnitInternal(
  prisma: PrismaService,
  changeUnitId: string
) {
  const result = await prisma.verificationResult.findFirst({
    where: {
      changeUnitId
    },
    orderBy: [{ executedAt: 'desc' }, { createdAt: 'desc' }]
  });
  return result ? toVerificationResultRecord(result) : null;
}

function isPlanningEligible(
  issue: PrismaIssue,
  latestResolution: PrismaResolutionDecision | null,
  latestChangePlan: Pick<PrismaChangePlan, 'status' | 'createdAt'> | null,
  latestAttempt: GovernanceExecutionAttemptRecord | null
) {
  if (issue.status !== GovernanceIssueStatus.Open) {
    return false;
  }

  if (!latestResolution) {
    return false;
  }

  if (
    ![
      GovernanceResolutionType.Fix,
      GovernanceResolutionType.Refactor,
      GovernanceResolutionType.Mitigate
    ].includes(latestResolution.resolution as GovernanceResolutionType)
  ) {
    return false;
  }

  if (
    latestChangePlan?.status === GovernanceChangePlanStatus.Draft &&
    latestChangePlan.createdAt >= latestResolution.createdAt
  ) {
    return false;
  }

  if (!latestAttempt) {
    return true;
  }

  return ![
    GovernanceExecutionAttemptStatus.Running,
    GovernanceExecutionAttemptStatus.WaitingRepair,
    GovernanceExecutionAttemptStatus.NeedsHumanReview
  ].includes(latestAttempt.status);
}

function resolveMergedIssueStatus(status: GovernanceIssueStatus) {
  switch (status) {
    case GovernanceIssueStatus.Closed:
      return GovernanceIssueStatus.Open;
    case GovernanceIssueStatus.WontFix:
    case GovernanceIssueStatus.AcceptedRisk:
    case GovernanceIssueStatus.Deferred:
    case GovernanceIssueStatus.Duplicate:
      return status;
    default:
      return status;
  }
}

function resolveMergedFindingStatus(status: GovernanceIssueStatus) {
  switch (status) {
    case GovernanceIssueStatus.WontFix:
    case GovernanceIssueStatus.AcceptedRisk:
    case GovernanceIssueStatus.Deferred:
    case GovernanceIssueStatus.Duplicate:
      return GovernanceFindingStatus.Dismissed;
    default:
      return GovernanceFindingStatus.Merged;
  }
}
