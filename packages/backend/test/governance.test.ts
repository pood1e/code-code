import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_GOVERNANCE_POLICY_INPUT,
  GovernanceAssessmentSource,
  GovernanceAutomationStage,
  GovernanceAutoActionEligibility,
  GovernanceChangeActionType,
  GovernanceChangePlanStatus,
  GovernanceChangeUnitStatus,
  GovernanceDeliveryArtifactKind,
  GovernanceDeliveryArtifactStatus,
  GovernanceDeliveryBodyStrategy,
  GovernanceDeliveryCommitMode,
  GovernanceExecutionMode,
  GovernanceFindingSource,
  GovernanceIssueDetail,
  GovernanceIssueKind,
  GovernanceIssueStatus,
  GovernancePriority,
  GovernanceReviewDecisionType,
  GovernanceReviewSubjectType,
  GovernanceAgentMergeStrategy,
  type GovernanceAgentStrategy,
  GovernanceVerificationResultStatus,
  GovernanceSeverity,
  GovernanceVerificationCheckType,
  GovernanceVerificationSubjectType,
  GovernanceViolationPolicy,
  type UpdateGovernancePolicyInput
} from '@agent-workbench/shared';

import { GovernanceAutomationService } from '../src/modules/governance/governance-automation.service';
import { GovernanceRepository } from '../src/modules/governance/governance.repository';
import type { GovernanceSessionResult } from '../src/modules/governance/governance-runner-bridge.service';
import { GovernanceRunnerBridgeService } from '../src/modules/governance/governance-runner-bridge.service';
import { GovernanceRunnerResolverService } from '../src/modules/governance/governance-runner-resolver.service';
import { GovernanceService } from '../src/modules/governance/governance.service';
import { GovernanceWorkspaceService } from '../src/modules/governance/governance-workspace.service';
import { api, expectError, expectSuccess, seedAgentRunner, seedProject } from './helpers';
import { getApp, getPrisma, resetDatabase, setupTestApp, teardownTestApp } from './setup';

describe('Governance API', () => {
  const tempWorkspaces: string[] = [];

  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
    for (const workspacePath of tempWorkspaces) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('应创建 finding', async () => {
    const project = await seedProject();

    const response = await api().post('/api/governance/findings').send({
      scopeId: project.id,
      source: GovernanceFindingSource.AgentReview,
      title: '重复的空判断',
      summary: '同一个 service 内存在重复空判断逻辑',
      evidence: [{ kind: 'file', ref: 'src/service.ts' }],
      categories: ['clean_code'],
      tags: ['duplication'],
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
      confidence: 0.8
    });

    const finding = expectSuccess<{ id: string; status: string }>(response, 201);
    expect(finding.id).toBeTruthy();
    expect(finding.status).toBe('pending');
  });

  it('repository profile refresh 应生成快照并更新 overview', async () => {
    const workspace = createRepositoryProfileWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });

    const refreshResponse = await api().post(
      `/api/governance/scopes/${project.id}/repository-profile/refresh`
    );
    const profile = expectSuccess<{
      branch: string;
      modules: Array<{ path: string }>;
      testBaseline: { coveragePercent?: number };
    }>(refreshResponse, 201);

    expect(profile.branch).toBe('master');
    expect(profile.modules.length).toBeGreaterThanOrEqual(2);
    expect(profile.testBaseline.coveragePercent).toBe(82);

    const overviewResponse = await api().get(
      `/api/governance/scopes/${project.id}/overview`
    );
    const overview = expectSuccess<{
      repositoryProfile: { id: string } | null;
      latestBaselineAttempt: { status: string } | null;
      findingCounts: Record<string, number>;
    }>(overviewResponse);

    expect(overview.repositoryProfile?.id).toBeTruthy();
    expect(overview.latestBaselineAttempt?.status).toBe('succeeded');
    expect(overview.findingCounts.pending).toBe(0);
  });

  it('repository profile refresh 在非 git workspaceRootPath 下也应成功', async () => {
    const repository = createRepositoryProfileWorkspace(tempWorkspaces);
    const workspaceRootPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'governance-non-git-root-')
    );
    tempWorkspaces.push(workspaceRootPath);

    const project = await seedProject({
      repoGitUrl: repository.repositoryPath,
      workspaceRootPath
    });

    const refreshResponse = await api().post(
      `/api/governance/scopes/${project.id}/repository-profile/refresh`
    );
    const profile = expectSuccess<{
      branch: string;
      modules: Array<{ path: string }>;
    }>(refreshResponse, 201);

    expect(profile.branch).toBe('master');
    expect(profile.modules.length).toBeGreaterThanOrEqual(2);

    const overviewResponse = await api().get(
      `/api/governance/scopes/${project.id}/overview`
    );
    const overview = expectSuccess<{
      latestBaselineAttempt: { status: string } | null;
    }>(overviewResponse);
    expect(overview.latestBaselineAttempt?.status).toBe('succeeded');
  });

  it('repository profile refresh 应按 policy.repoBranch 生成快照', async () => {
    const workspace = createRepositoryProfileWorkspace(tempWorkspaces);
    execSync('git checkout -b feature/governance', {
      cwd: workspace.repositoryPath,
      stdio: 'pipe'
    });
    fs.writeFileSync(
      path.join(workspace.repositoryPath, 'src', 'feature.ts'),
      'export const feature = "branch";\n'
    );
    execSync('git add .', { cwd: workspace.repositoryPath, stdio: 'pipe' });
    execSync('git commit -m "branch change"', {
      cwd: workspace.repositoryPath,
      stdio: 'pipe'
    });
    execSync('git checkout master', {
      cwd: workspace.repositoryPath,
      stdio: 'pipe'
    });

    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });

    await api()
      .put(`/api/governance/scopes/${project.id}/policy`)
      .send(
        createGovernancePolicyInput({
          sourceSelection: {
            repoBranch: 'feature/governance',
            docBranch: null
          }
        })
      )
      .expect(200);

    const refreshResponse = await api().post(
      `/api/governance/scopes/${project.id}/repository-profile/refresh`
    );
    const profile = expectSuccess<{ branch: string }>(refreshResponse, 201);

    expect(profile.branch).toBe('feature/governance');
  });

  it('governance runner resolver 在未配置 runner 时应返回 null', async () => {
    const resolver = getApp().get(GovernanceRunnerResolverService);
    const project = await seedProject();

    await seedAgentRunner({ name: 'MiniMax 2.7 Runner' });

    await expect(
      resolver.resolveStageAgentStrategy({
        scopeId: project.id,
        stageType: GovernanceAutomationStage.Discovery
      })
    ).resolves.toBeNull();
  });

  it('governance runner resolver 应优先使用 stage override，其次使用 scope 默认 runner', async () => {
    const resolver = getApp().get(GovernanceRunnerResolverService);
    const project = await seedProject();
    const defaultRunner = await seedAgentRunner({
      name: 'Governance Default Runner'
    });
    const executionRunner = await seedAgentRunner({
      name: 'Governance Execution Runner'
    });

    await api()
      .put(`/api/governance/scopes/${project.id}/policy`)
      .send(
        createGovernancePolicyInput({
          agentStrategy: {
            defaultRunnerIds: [defaultRunner.id],
            discovery: null,
            triage: null,
            planning: null,
            execution: {
              runnerIds: [executionRunner.id],
              fanoutCount: 1,
              mergeStrategy: GovernanceAgentMergeStrategy.Single
            }
          }
        })
      )
      .expect(200);

    await expect(
      resolver.resolveStageAgentStrategy({
        scopeId: project.id,
        stageType: GovernanceAutomationStage.Discovery
      })
    ).resolves.toEqual({
      runnerIds: [defaultRunner.id],
      fanoutCount: 1,
      mergeStrategy: GovernanceAgentMergeStrategy.Single
    });
    await expect(
      resolver.resolveStageAgentStrategy({
        scopeId: project.id,
        stageType: GovernanceAutomationStage.Execution
      })
    ).resolves.toEqual({
      runnerIds: [executionRunner.id],
      fanoutCount: 1,
      mergeStrategy: GovernanceAgentMergeStrategy.Single
    });
  });

  it('governance runner resolver 在配置 runner 不存在时应返回 null', async () => {
    const resolver = getApp().get(GovernanceRunnerResolverService);
    const project = await seedProject();

    await api()
      .put(`/api/governance/scopes/${project.id}/policy`)
      .send(
        createGovernancePolicyInput({
          agentStrategy: {
            defaultRunnerIds: ['missing-runner-id'],
            discovery: null,
            triage: null,
            planning: null,
            execution: null
          }
        })
      )
      .expect(200);

    await expect(
      resolver.resolveStageAgentStrategy({
        scopeId: project.id,
        stageType: GovernanceAutomationStage.Triage
      })
    ).resolves.toBeNull();
  });

  it('应返回默认 governance policy 并支持更新', async () => {
    const project = await seedProject();
    const defaultRunner = await seedAgentRunner({
      name: 'Governance Default Runner'
    });

    const initialResponse = await api().get(
      `/api/governance/scopes/${project.id}/policy`
    );
    const initialPolicy = expectSuccess<{
      scopeId: string;
      priorityPolicy: { defaultPriority: string };
      deliveryPolicy: { commitMode: string };
      sourceSelection: { repoBranch: string | null };
      agentStrategy: { defaultRunnerIds: string[] };
    }>(initialResponse);
    expect(initialPolicy.scopeId).toBe(project.id);
    expect(initialPolicy.priorityPolicy.defaultPriority).toBe('p2');
    expect(initialPolicy.deliveryPolicy.commitMode).toBe('per_unit');
    expect(initialPolicy.sourceSelection.repoBranch).toBeNull();
    expect(initialPolicy.agentStrategy.defaultRunnerIds).toEqual([]);

    const updateResponse = await api()
      .put(`/api/governance/scopes/${project.id}/policy`)
      .send({
        priorityPolicy: {
          defaultPriority: 'p1',
          severityOverrides: {
            critical: 'p0',
            high: 'p1',
            medium: 'p2',
            low: 'p3'
          }
        },
        autoActionPolicy: {
          defaultEligibility: 'suggest_only',
          severityOverrides: {
            critical: 'forbidden',
            high: 'human_review_required'
          },
          issueKindOverrides: {
            risk: 'forbidden',
            improvement: 'suggest_only'
          }
        },
        deliveryPolicy: {
          commitMode: GovernanceDeliveryCommitMode.Squash,
          autoCloseIssueOnApprovedDelivery: false
        },
        sourceSelection: {
          repoBranch: 'release/governance',
          docBranch: 'docs'
        },
        agentStrategy: {
          defaultRunnerIds: [defaultRunner.id],
          discovery: null,
          triage: null,
          planning: null,
          execution: null
        }
      })
      .expect(200);
    const updatedPolicy = expectSuccess<{
      priorityPolicy: { defaultPriority: string };
      autoActionPolicy: { defaultEligibility: string };
      deliveryPolicy: { commitMode: string; autoCloseIssueOnApprovedDelivery: boolean };
      sourceSelection: { repoBranch: string | null; docBranch: string | null };
      agentStrategy: { defaultRunnerIds: string[] };
    }>(updateResponse);
    expect(updatedPolicy.priorityPolicy.defaultPriority).toBe('p1');
    expect(updatedPolicy.autoActionPolicy.defaultEligibility).toBe('suggest_only');
    expect(updatedPolicy.deliveryPolicy.commitMode).toBe('squash');
    expect(updatedPolicy.deliveryPolicy.autoCloseIssueOnApprovedDelivery).toBe(false);
    expect(updatedPolicy.sourceSelection.repoBranch).toBe('release/governance');
    expect(updatedPolicy.sourceSelection.docBranch).toBe('docs');
    expect(updatedPolicy.agentStrategy.defaultRunnerIds).toEqual([defaultRunner.id]);
  });

  it('discovery run 应创建 pending findings 且重复执行不重复插入', async () => {
    const workspace = createRepositoryProfileWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const runner = await seedAgentRunner();

    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceResult({
        findings: [
          {
            source: 'agent_review',
            title: '治理台缺少概览摘要',
            summary: '当前治理台缺少自动发现摘要，triage 成本偏高。',
            evidence: [{ kind: 'file', ref: 'src/feature.ts' }],
            categories: ['maintainability'],
            tags: ['governance'],
            severityHint: 'medium',
            confidence: 0.75,
            affectedTargets: [{ kind: 'file', ref: 'src/feature.ts' }]
          }
        ]
      }),
      createCompletedGovernanceResult({
        findings: [
          {
            source: 'agent_review',
            title: '治理台缺少概览摘要',
            summary: '当前治理台缺少自动发现摘要，triage 成本偏高。',
            evidence: [{ kind: 'file', ref: 'src/feature.ts' }],
            categories: ['maintainability'],
            tags: ['governance'],
            severityHint: 'medium',
            confidence: 0.75,
            affectedTargets: [{ kind: 'file', ref: 'src/feature.ts' }]
          }
        ]
      })
    ]);

    try {
      await api()
        .put(`/api/governance/scopes/${project.id}/policy`)
        .send(
          createGovernancePolicyInput({
          priorityPolicy: {
            defaultPriority: GovernancePriority.P1
          },
          autoActionPolicy: {
            defaultEligibility: GovernanceAutoActionEligibility.SuggestOnly
          },
          deliveryPolicy: {
            commitMode: GovernanceDeliveryCommitMode.Squash,
            autoCloseIssueOnApprovedDelivery: false
          },
          agentStrategy: {
            defaultRunnerIds: [],
            discovery: {
              runnerIds: [runner.id],
              fanoutCount: 1,
              mergeStrategy: GovernanceAgentMergeStrategy.Single
            },
            triage: null,
            planning: null,
            execution: null
          }
          })
        )
        .expect(200);

      await api()
        .post(`/api/governance/scopes/${project.id}/repository-profile/refresh`)
        .expect(201);

      const firstRun = await api()
        .post(`/api/governance/scopes/${project.id}/discovery/run`)
        .expect(200);
      const firstOverview = expectSuccess<{
        latestDiscoveryAttempt: { status: string } | null;
        findingCounts: Record<string, number>;
      }>(firstRun);
      expect(firstOverview.latestDiscoveryAttempt?.status).toBe('succeeded');
      expect(firstOverview.findingCounts.pending).toBe(1);

      const findingsAfterFirstRun = expectSuccess<Array<{ title: string; fingerprint?: string }>>(
        await api().get('/api/governance/findings').query({ scopeId: project.id })
      );
      expect(findingsAfterFirstRun).toHaveLength(1);
      expect(findingsAfterFirstRun[0]?.fingerprint).toBeTruthy();

      const secondRun = await api()
        .post(`/api/governance/scopes/${project.id}/discovery/run`)
        .expect(200);
      const secondOverview = expectSuccess<{
        findingCounts: Record<string, number>;
      }>(secondRun);
      expect(secondOverview.findingCounts.pending).toBe(1);

      const findingsAfterSecondRun = expectSuccess<Array<{ title: string }>>(
        await api().get('/api/governance/findings').query({ scopeId: project.id })
      );
      expect(findingsAfterSecondRun).toHaveLength(1);
      expect(automationBridge.createSessionSpy).toHaveBeenCalled();
      expect(automationBridge.createSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('"commitMode": "squash"')
        })
      );
      expect(automationBridge.waitForResultSpy).toHaveBeenCalled();
    } finally {
      automationBridge.restore();
    }
  });

  it('discovery fanout 应并行多 runner 并按 union_dedup 合并结果', async () => {
    const workspace = createRepositoryProfileWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const runnerA = await seedAgentRunner({ name: 'Discovery Runner A' });
    const runnerB = await seedAgentRunner({ name: 'Discovery Runner B' });

    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceResult({
        findings: [
          {
            source: 'agent_review',
            title: '治理台缺少概览摘要',
            summary: '需要增加概要信息。',
            evidence: [{ kind: 'file', ref: 'src/feature.ts' }],
            categories: ['maintainability'],
            tags: ['overview'],
            severityHint: 'medium',
            confidence: 0.75,
            affectedTargets: [{ kind: 'file', ref: 'src/feature.ts' }]
          }
        ]
      }),
      createCompletedGovernanceResult({
        findings: [
          {
            source: 'agent_review',
            title: '缺少最近执行摘要',
            summary: '需要展示最近执行摘要。',
            evidence: [{ kind: 'file', ref: 'src/panel.tsx' }],
            categories: ['ux'],
            tags: ['summary'],
            severityHint: 'low',
            confidence: 0.7,
            affectedTargets: [{ kind: 'file', ref: 'src/panel.tsx' }]
          }
        ]
      })
    ]);

    try {
      await api()
        .put(`/api/governance/scopes/${project.id}/policy`)
        .send(
          createGovernancePolicyInput({
            agentStrategy: {
              defaultRunnerIds: [],
              discovery: {
                runnerIds: [runnerA.id, runnerB.id],
                fanoutCount: 2,
                mergeStrategy: GovernanceAgentMergeStrategy.UnionDedup
              },
              triage: null,
              planning: null,
              execution: null
            }
          })
        )
        .expect(200);

      await api()
        .post(`/api/governance/scopes/${project.id}/repository-profile/refresh`)
        .expect(201);

      await api()
        .post(`/api/governance/scopes/${project.id}/discovery/run`)
        .expect(200);

      const findings = expectSuccess<Array<{ title: string }>>(
        await api().get('/api/governance/findings').query({ scopeId: project.id })
      );
      expect(findings).toHaveLength(2);
      expect(automationBridge.createSessionSpy).toHaveBeenCalledTimes(2);
    } finally {
      automationBridge.restore();
    }
  });

  it('创建 finding 时 project 不存在应返回 404', async () => {
    const response = await api().post('/api/governance/findings').send({
      scopeId: 'missing-project',
      source: GovernanceFindingSource.AgentReview,
      title: '缺少 project',
      summary: '缺少 project',
      evidence: [{ kind: 'file', ref: 'src/service.ts' }],
      categories: ['clean_code'],
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }]
    });

    expectError(response, 404);
  });

  it('应返回 issue 列表与详情聚合', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '移除重复逻辑',
      strategy: '提取公共 helper',
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '提取 helper',
          targets: [{ kind: 'file', ref: 'src/service.ts' }]
        }
      ],
      risks: ['可能影响现有调用链'],
      baselineCommitSha: 'abc123',
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '提取 helper',
          description: '提取公共方法',
          scope: {
            targets: [{ kind: 'file', ref: 'src/service.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto
        }
      ],
      verificationPlans: [
        {
          subjectType: GovernanceVerificationSubjectType.ChangeUnit,
          changeUnitIndex: 0,
          checks: [
            {
              id: 'check-1',
              type: GovernanceVerificationCheckType.UnitTest,
              required: true
            }
          ],
          passCriteria: ['局部单测通过']
        }
      ]
    });

    const listResponse = await api()
      .get('/api/governance/issues')
      .query({ scopeId: project.id });
    const issues = expectSuccess<Array<{ id: string; latestAssessment: object | null }>>(
      listResponse
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe(issue.id);
    expect(issues[0]?.latestAssessment).not.toBeNull();

    const detailResponse = await api().get(`/api/governance/issues/${issue.id}`);
    const detail = expectSuccess<GovernanceIssueDetail>(detailResponse);

    expect(detail.changePlan?.objective).toBe('移除重复逻辑');
    expect(detail.changeUnits).toHaveLength(1);
    expect(detail.verificationPlans).toHaveLength(1);
  });

  it('duplicate 缺少 primaryIssueId 时应返回 400', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);

    const response = await api()
      .post(`/api/governance/issues/${issue.id}/resolution-decisions`)
      .send({
        resolution: 'duplicate',
        reason: '与主 issue 重复'
      });

    expectError(response, 400);
  });

  it('defer 未提供 deferUntil 时应默认延期 30 天并改为 deferred', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);

    const response = await api()
      .post(`/api/governance/issues/${issue.id}/resolution-decisions`)
      .send({
        resolution: 'defer',
        reason: '排期靠后'
      });

    const detail = expectSuccess<GovernanceIssueDetail>(response, 201);
    expect(detail.status).toBe('deferred');
    expect(detail.latestResolutionDecision?.deferUntil).toBeTruthy();

    const deferUntil = new Date(detail.latestResolutionDecision!.deferUntil!);
    const days = Math.round(
      (deferUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    expect(days).toBeGreaterThanOrEqual(29);
    expect(days).toBeLessThanOrEqual(31);
  });

  it('finding dismiss 应将 finding 状态置为 dismissed', async () => {
    const project = await seedProject();
    const findingResponse = await api().post('/api/governance/findings').send({
      scopeId: project.id,
      source: GovernanceFindingSource.AgentReview,
      title: '误报',
      summary: '这是一条误报',
      evidence: [{ kind: 'file', ref: 'src/service.ts' }],
      categories: ['testing'],
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }]
    });
    const finding = expectSuccess<{ id: string }>(findingResponse, 201);

    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.Finding,
      subjectId: finding.id,
      decision: GovernanceReviewDecisionType.Dismissed,
      reviewer: 'reviewer-1',
      comment: '确认为误报'
    });

    const listResponse = await api()
      .get('/api/governance/findings')
      .query({ scopeId: project.id, status: 'dismissed' });

    const findings = expectSuccess<Array<{ id: string; status: string }>>(listResponse);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.id).toBe(finding.id);
    expect(findings[0]?.status).toBe('dismissed');
  });

  it('assessment override 应刷新 issue detail 的最新 assessment', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);

    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.Assessment,
      subjectId: issue.latestAssessment!.id,
      decision: GovernanceReviewDecisionType.Approved,
      reviewer: 'architect-1',
      assessmentOverride: {
        severity: GovernanceSeverity.Low,
        autoActionEligibility: GovernanceAutoActionEligibility.AutoAllowed
      }
    });

    const detailResponse = await api().get(`/api/governance/issues/${issue.id}`);
    const detail = expectSuccess<GovernanceIssueDetail>(detailResponse);

    expect(detail.latestAssessment?.severity).toBe(GovernanceSeverity.Low);
    expect(detail.latestAssessment?.autoActionEligibility).toBe(
      GovernanceAutoActionEligibility.AutoAllowed
    );
    expect(detail.latestAssessment?.assessedBy).toBe('human');
  });

  it('change plan approved/rejected 应驱动 issue planned/open', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const withPlan = await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '抽取 helper',
      strategy: '拆分重构',
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '抽取 helper',
          targets: [{ kind: 'file', ref: 'src/service.ts' }]
        }
      ],
      risks: ['范围扩散'],
      baselineCommitSha: 'abc123',
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '抽取 helper',
          description: '抽取 helper',
          scope: {
            targets: [{ kind: 'file', ref: 'src/service.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto
        }
      ],
      verificationPlans: []
    });

    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.ChangePlan,
      subjectId: withPlan.changePlan!.id,
      decision: GovernanceReviewDecisionType.Approved,
      reviewer: 'lead-1'
    });

    let detail = expectSuccess<GovernanceIssueDetail>(
      await api().get(`/api/governance/issues/${issue.id}`)
    );
    expect(detail.status).toBe('planned');
    expect(detail.changePlan?.status).toBe('approved');

    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.ChangePlan,
      subjectId: withPlan.changePlan!.id,
      decision: GovernanceReviewDecisionType.Rejected,
      reviewer: 'lead-1'
    });

    detail = expectSuccess<GovernanceIssueDetail>(
      await api().get(`/api/governance/issues/${issue.id}`)
    );
    expect(detail.status).toBe('open');
    expect(detail.changePlan?.status).toBe('rejected');
  });

  it('triage worker 应消费 pending finding 并创建 issue', async () => {
    const project = await seedProject();
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceResult({
        action: 'create_issue',
        issue: {
          title: '重复分支逻辑',
          statement: 'service 内部存在重复分支逻辑',
          kind: 'debt',
          categories: ['clean_code'],
          tags: ['duplication'],
          affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
          rootCause: '重复条件分支缺少抽象',
          impactSummary: '增加维护成本'
        },
        assessment: {
          severity: 'medium',
          priority: 'p2',
          userImpact: 2,
          systemRisk: 3,
          strategicValue: 4,
          fixCost: 2,
          autoActionEligibility: 'human_review_required',
          rationale: ['需要进入 backlog']
        }
      })
    ]);

    try {
      await api()
        .put(`/api/governance/scopes/${project.id}/policy`)
        .send(
          createGovernancePolicyInput({
          priorityPolicy: {
            defaultPriority: GovernancePriority.P1,
            severityOverrides: {
              medium: GovernancePriority.P2
            }
          },
          autoActionPolicy: {
            defaultEligibility: GovernanceAutoActionEligibility.Forbidden,
            issueKindOverrides: {
              debt: GovernanceAutoActionEligibility.HumanReviewRequired
            }
          },
          deliveryPolicy: {
            commitMode: GovernanceDeliveryCommitMode.PerUnit,
            autoCloseIssueOnApprovedDelivery: true
          },
          agentStrategy: {
            defaultRunnerIds: [],
            discovery: null,
            triage: {
              runnerIds: [runner.id],
              fanoutCount: 1,
              mergeStrategy: GovernanceAgentMergeStrategy.Single
            },
            planning: null,
            execution: null
          }
          })
        )
        .expect(200);

      const findingResponse = await api().post('/api/governance/findings').send({
        scopeId: project.id,
        source: GovernanceFindingSource.AgentReview,
        title: '重复分支逻辑',
        summary: 'service 内部存在重复分支逻辑',
        evidence: [{ kind: 'file', ref: 'src/service.ts' }],
        categories: ['clean_code'],
        tags: ['duplication'],
        affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }]
      });
      expectSuccess<{ id: string }>(findingResponse, 201);

      const processed = await automationService.runTriageCycle();
      expect(processed).toBe(true);
      expect(automationBridge.createSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('"defaultPriority": "p1"')
        })
      );
      expect(automationBridge.createSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('"defaultEligibility": "forbidden"')
        })
      );

      const issues = expectSuccess<Array<{ id: string; relatedFindingCount: number }>>(
        await api().get('/api/governance/issues').query({ scopeId: project.id })
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]?.relatedFindingCount).toBe(1);
      const detail = expectSuccess<GovernanceIssueDetail>(
        await api().get(`/api/governance/issues/${issues[0]!.id}`)
      );
      expect(detail.latestAssessment?.priority).toBe(GovernancePriority.P2);
      expect(detail.latestAssessment?.autoActionEligibility).toBe(
        GovernanceAutoActionEligibility.HumanReviewRequired
      );

      const findings = expectSuccess<Array<{ status: string }>>(
        await api().get('/api/governance/findings').query({ scopeId: project.id })
      );
      expect(findings[0]?.status).toBe('merged');
    } finally {
      automationBridge.restore();
    }
  });

  it('triage merge 到 closed issue 时应 reopen', async () => {
    const project = await seedProject();
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceResult({
        action: 'merge_into_issue',
        targetIssueId: issue.id,
        clusterBasis: ['same_target'],
        rationale: '命中同一 issue'
      })
    ]);

    try {
      await assignGovernanceRunnerSelection(project.id, {
        defaultRunnerIds: [],
        discovery: null,
        triage: {
          runnerIds: [runner.id],
          fanoutCount: 1,
          mergeStrategy: GovernanceAgentMergeStrategy.Single
        },
        planning: null,
        execution: null
      });

      await getPrisma().issue.update({
        where: { id: issue.id },
        data: {
          status: GovernanceIssueStatus.Closed
        }
      });

      await api().post('/api/governance/findings').send({
        scopeId: project.id,
        source: GovernanceFindingSource.AgentReview,
        title: `[triage-merge:${issue.id}] 复现同类问题`,
        summary: '与已关闭 issue 属于同一目标',
        evidence: [{ kind: 'file', ref: 'src/service.ts' }],
        categories: ['clean_code'],
        affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }]
      });

      const processed = await automationService.runTriageCycle();
      expect(processed).toBe(true);

      const detail = expectSuccess<GovernanceIssueDetail>(
        await api().get(`/api/governance/issues/${issue.id}`)
      );
      expect(detail.status).toBe('open');
      expect(detail.relatedFindings).toHaveLength(1);
    } finally {
      automationBridge.restore();
    }
  });

  it('triage merge 到 deferred issue 时应静默归并并 dismiss finding', async () => {
    const project = await seedProject();
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceResult({
        action: 'merge_into_issue',
        targetIssueId: issue.id,
        clusterBasis: ['same_target'],
        rationale: '命中 deferred issue'
      })
    ]);

    try {
      await assignGovernanceRunnerSelection(project.id, {
        defaultRunnerIds: [],
        discovery: null,
        triage: {
          runnerIds: [runner.id],
          fanoutCount: 1,
          mergeStrategy: GovernanceAgentMergeStrategy.Single
        },
        planning: null,
        execution: null
      });

      await api()
        .post(`/api/governance/issues/${issue.id}/resolution-decisions`)
        .send({
          resolution: 'defer',
          reason: '排到后续版本',
          deferUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        })
        .expect(201);

      await api().post('/api/governance/findings').send({
        scopeId: project.id,
        source: GovernanceFindingSource.AgentReview,
        title: `[triage-merge:${issue.id}] 延期 issue 再次命中`,
        summary: '命中一个已延期的问题，不应唤醒原 issue',
        evidence: [{ kind: 'file', ref: 'src/service.ts' }],
        categories: ['clean_code'],
        affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }]
      });

      const processed = await automationService.runTriageCycle();
      expect(processed).toBe(true);

      const detail = expectSuccess<GovernanceIssueDetail>(
        await api().get(`/api/governance/issues/${issue.id}`)
      );
      expect(detail.status).toBe('deferred');
      expect(detail.relatedFindings).toHaveLength(1);

      const findings = expectSuccess<Array<{ status: string }>>(
        await api().get('/api/governance/findings').query({ scopeId: project.id })
      );
      expect(findings[0]?.status).toBe('dismissed');
    } finally {
      automationBridge.restore();
    }
  });

  it('wakeDeferredIssues 应将到期 deferred issue 唤醒为 open', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const governanceRepository = getApp().get(GovernanceRepository);
    const issue = await seedIssue(governanceService, project.id);

    await api()
      .post(`/api/governance/issues/${issue.id}/resolution-decisions`)
      .send({
        resolution: 'defer',
        reason: '暂缓处理',
        deferUntil: new Date(Date.now() - 60_000).toISOString()
      })
      .expect(201);

    const wokenCount = await governanceRepository.wakeDeferredIssues(new Date());
    expect(wokenCount).toBe(1);

    const detail = expectSuccess<GovernanceIssueDetail>(
      await api().get(`/api/governance/issues/${issue.id}`)
    );
    expect(detail.status).toBe('open');
  });

  it('claimNextExecutableChangeUnit 应避免 cross-plan target 冲突', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const governanceRepository = getApp().get(GovernanceRepository);
    const issueOne = await seedIssue(governanceService, project.id);
    const issueTwo = await governanceService.createIssueWithAssessment({
      scopeId: project.id,
      title: '第二个 issue',
      statement: '同一文件上的另一个治理项',
      kind: GovernanceIssueKind.Debt,
      categories: ['clean_code'],
      tags: [],
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
      impactSummary: '同文件并发风险',
      assessment: {
        severity: GovernanceSeverity.Medium,
        priority: GovernancePriority.P2,
        userImpact: 1,
        systemRisk: 2,
        strategicValue: 2,
        fixCost: 1,
        autoActionEligibility: GovernanceAutoActionEligibility.HumanReviewRequired,
        rationale: ['需要避免并发修改'],
        assessedBy: GovernanceAssessmentSource.Agent
      }
    });

    const planOne = await governanceService.createChangePlanBundle({
      issueId: issueOne.id,
      objective: '计划一',
      strategy: '修改相同文件',
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '计划一动作',
          targets: [{ kind: 'file', ref: 'src/service.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: 'abc123',
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '计划一 unit',
          description: '运行中的 unit',
          scope: {
            targets: [{ kind: 'file', ref: 'src/service.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto,
          status: GovernanceChangeUnitStatus.Ready
        }
      ],
      verificationPlans: []
    });
    const planTwo = await governanceService.createChangePlanBundle({
      issueId: issueTwo.id,
      objective: '计划二',
      strategy: '也修改相同文件',
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
      proposedActions: [
        {
          id: 'action-2',
          type: GovernanceChangeActionType.CodeChange,
          description: '计划二动作',
          targets: [{ kind: 'file', ref: 'src/service.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: 'abc123',
      changeUnits: [
        {
          sourceActionId: 'action-2',
          title: '计划二 unit',
          description: '应被冲突阻塞',
          scope: {
            targets: [{ kind: 'file', ref: 'src/service.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto,
          status: GovernanceChangeUnitStatus.Ready
        }
      ],
      verificationPlans: []
    });

    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.ChangePlan,
      subjectId: planOne.changePlan!.id,
      decision: GovernanceReviewDecisionType.Approved,
      reviewer: 'lead-1'
    });
    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.ChangePlan,
      subjectId: planTwo.changePlan!.id,
      decision: GovernanceReviewDecisionType.Approved,
      reviewer: 'lead-1'
    });

    await governanceRepository.updateChangeUnitExecutionState({
      changeUnitId: planOne.changeUnits[0]!.id,
      status: GovernanceChangeUnitStatus.Running,
      ownerLeaseToken: 'worker-1',
      leaseExpiresAt: new Date(Date.now() + 60_000)
    });

    const claimed = await governanceRepository.claimNextExecutableChangeUnit({
      ownerLeaseToken: 'worker-2',
      now: new Date(),
      leaseExpiresAt: new Date(Date.now() + 60_000)
    });
    expect(claimed).toBeNull();
  });

  it('planning worker 应基于 resolution 生成 draft change plan', async () => {
    const workspace = createTempGitWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceResult({
        objective: 'Resolve 重复判空逻辑',
        strategy: 'Constrain the fix to a focused refactor.',
        affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
        proposedActions: [
          {
            id: 'action-1',
            type: 'code_change',
            description: '提取重复判空逻辑',
            targets: [{ kind: 'file', ref: 'src/service.ts' }]
          }
        ],
        risks: ['改动 service 边界'],
        rollbackPlan: '回滚本次重构提交',
        assumptions: ['无需修改共享契约'],
        changeUnits: [
          {
            sourceActionId: 'action-1',
            title: '提取 helper',
            description: '收敛重复分支',
            scope: {
              targets: [{ kind: 'file', ref: 'src/service.ts' }],
              maxFiles: 2,
              maxDiffLines: 120,
              violationPolicy: 'warn'
            },
            executionMode: 'semi_auto',
            maxRetries: 1
          }
        ],
        verificationPlans: [
          {
            subjectType: 'change_unit',
            changeUnitIndex: 0,
            checks: [{ id: 'check-1', type: 'typecheck', required: true }],
            passCriteria: ['类型检查通过']
          }
        ]
      })
    ]);

    try {
      await api()
        .put(`/api/governance/scopes/${project.id}/policy`)
        .send(
          createGovernancePolicyInput({
          priorityPolicy: {
            defaultPriority: GovernancePriority.P2
          },
          autoActionPolicy: {
            defaultEligibility:
              GovernanceAutoActionEligibility.HumanReviewRequired
          },
          deliveryPolicy: {
            commitMode: GovernanceDeliveryCommitMode.Squash,
            autoCloseIssueOnApprovedDelivery: false
          },
          agentStrategy: {
            defaultRunnerIds: [],
            discovery: null,
            triage: null,
            planning: {
              runnerIds: [runner.id],
              fanoutCount: 1,
              mergeStrategy: GovernanceAgentMergeStrategy.Single
            },
            execution: null
          }
          })
        )
        .expect(200);

      await api()
        .post(`/api/governance/issues/${issue.id}/resolution-decisions`)
        .send({
          resolution: 'fix',
          reason: '进入自动规划'
        });

      const processed = await automationService.runPlanningCycle();
      expect(processed).toBe(true);
      expect(automationBridge.createSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('"commitMode": "squash"')
        })
      );
      expect(automationBridge.createSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining(
            '"autoCloseIssueOnApprovedDelivery": false'
          )
        })
      );

      const detail = expectSuccess<GovernanceIssueDetail>(
        await api().get(`/api/governance/issues/${issue.id}`)
      );
      expect(detail.changePlan?.status).toBe(GovernanceChangePlanStatus.Draft);
      expect(detail.changeUnits.length).toBeGreaterThan(0);
      expect(detail.verificationPlans.length).toBeGreaterThan(0);
      expect(detail.latestPlanningAttempt?.status).toBe('succeeded');
    } finally {
      automationBridge.restore();
    }
  });

  it('planning policy 为 forbidden 时应直接进入 needs_human_review', async () => {
    const workspace = createTempGitWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const automationBridge = mockGovernanceAutomationBridge([]);

    try {
      await api()
        .put(`/api/governance/scopes/${project.id}/policy`)
        .send(
          createGovernancePolicyInput({
          priorityPolicy: {
            defaultPriority: GovernancePriority.P1
          },
          autoActionPolicy: {
            defaultEligibility: GovernanceAutoActionEligibility.Forbidden
          },
          deliveryPolicy: {
            commitMode: GovernanceDeliveryCommitMode.PerUnit,
            autoCloseIssueOnApprovedDelivery: true
          },
          agentStrategy: {
            defaultRunnerIds: [],
            discovery: null,
            triage: null,
            planning: {
              runnerIds: [runner.id],
              fanoutCount: 1,
              mergeStrategy: GovernanceAgentMergeStrategy.Single
            },
            execution: null
          }
          })
        )
        .expect(200);

      await api()
        .post(`/api/governance/issues/${issue.id}/resolution-decisions`)
        .send({
          resolution: 'fix',
          reason: '策略禁止自动规划'
        });

      const processed = await automationService.runPlanningCycle();
      expect(processed).toBe(false);
      expect(automationBridge.createSessionSpy).not.toHaveBeenCalled();

      const detail = expectSuccess<GovernanceIssueDetail>(
        await api().get(`/api/governance/issues/${issue.id}`)
      );
      expect(detail.latestPlanningAttempt?.status).toBe('needs_human_review');
    } finally {
      automationBridge.restore();
    }
  });

  it('planning policy 为 suggest_only 时应将 change unit 降级为 manual', async () => {
    const workspace = createTempGitWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceResult({
        objective: 'Resolve 重复判空逻辑',
        strategy: 'Keep a single automated proposal.',
        affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
        proposedActions: [
          {
            id: 'action-1',
            type: 'code_change',
            description: '提取重复判空逻辑',
            targets: [{ kind: 'file', ref: 'src/service.ts' }]
          }
        ],
        risks: [],
        changeUnits: [
          {
            sourceActionId: 'action-1',
            title: '提取 helper',
            description: '收敛重复分支',
            scope: {
              targets: [{ kind: 'file', ref: 'src/service.ts' }],
              violationPolicy: 'warn'
            },
            executionMode: 'auto',
            maxRetries: 1
          }
        ],
        verificationPlans: [
          {
            subjectType: 'change_unit',
            changeUnitIndex: 0,
            checks: [{ id: 'check-1', type: 'typecheck', required: true }],
            passCriteria: ['类型检查通过']
          }
        ]
      })
    ]);

    try {
      await api()
        .put(`/api/governance/scopes/${project.id}/policy`)
        .send(
          createGovernancePolicyInput({
          priorityPolicy: {
            defaultPriority: GovernancePriority.P2
          },
          autoActionPolicy: {
            defaultEligibility: GovernanceAutoActionEligibility.SuggestOnly
          },
          deliveryPolicy: {
            commitMode: GovernanceDeliveryCommitMode.PerUnit,
            autoCloseIssueOnApprovedDelivery: true
          },
          agentStrategy: {
            defaultRunnerIds: [],
            discovery: null,
            triage: null,
            planning: {
              runnerIds: [runner.id],
              fanoutCount: 1,
              mergeStrategy: GovernanceAgentMergeStrategy.Single
            },
            execution: null
          }
          })
        )
        .expect(200);

      await api()
        .post(`/api/governance/issues/${issue.id}/resolution-decisions`)
        .send({
          resolution: 'fix',
          reason: '进入自动规划'
        });

      const processed = await automationService.runPlanningCycle();
      expect(processed).toBe(true);

      const detail = expectSuccess<GovernanceIssueDetail>(
        await api().get(`/api/governance/issues/${issue.id}`)
      );
      expect(detail.changeUnits[0]?.executionMode).toBe(
        GovernanceExecutionMode.Manual
      );
    } finally {
      automationBridge.restore();
    }
  });

  it('应支持 change-unit 与 delivery-artifact 列表查询', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const governanceRepository = getApp().get(GovernanceRepository);
    const issue = await seedIssue(governanceService, project.id);
    const detail = await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '拆分治理查询',
      strategy: '补独立列表接口',
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '补 change unit 列表',
          targets: [{ kind: 'file', ref: 'src/service.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: 'baseline-sha',
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '补 change unit 列表',
          description: '独立查询',
          scope: {
            targets: [{ kind: 'file', ref: 'src/service.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto,
          status: GovernanceChangeUnitStatus.Verified
        }
      ],
      verificationPlans: []
    });

    await governanceRepository.createOrUpdateDeliveryArtifact({
      scopeId: project.id,
      issueId: issue.id,
      changePlanId: detail.changePlan!.id,
      kind: GovernanceDeliveryArtifactKind.ReviewRequest,
      title: '治理交付单',
      body: '等待审批',
      linkedIssueIds: [issue.id],
      linkedChangeUnitIds: [detail.changeUnits[0]!.id],
      linkedVerificationResultIds: [],
      bodyStrategy: GovernanceDeliveryBodyStrategy.AutoAggregate,
      status: GovernanceDeliveryArtifactStatus.Submitted
    });

    const changeUnitsResponse = await api()
      .get('/api/governance/change-units')
      .query({ scopeId: project.id, issueId: issue.id });
    const changeUnits = expectSuccess<Array<{ id: string; title: string }>>(
      changeUnitsResponse
    );
    expect(changeUnits).toHaveLength(1);
    expect(changeUnits[0]?.title).toBe('补 change unit 列表');

    const deliveryArtifactsResponse = await api()
      .get('/api/governance/delivery-artifacts')
      .query({ scopeId: project.id, status: 'submitted' });
    const deliveryArtifacts = expectSuccess<Array<{ id: string; title: string }>>(
      deliveryArtifactsResponse
    );
    expect(deliveryArtifacts).toHaveLength(1);
    expect(deliveryArtifacts[0]?.title).toBe('治理交付单');
  });

  it('planning needs_human_review 后应允许 retry-planning', async () => {
    const workspace = createTempGitWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const governanceService = getApp().get(GovernanceService);
    const issue = await governanceService.createIssueWithAssessment({
      scopeId: project.id,
      title: '[planning-parse-fail-always] 缺少关键路径单测',
      statement: '需要规划但输出会持续 parse 失败',
      kind: GovernanceIssueKind.Debt,
      categories: ['testing'],
      tags: [],
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
      impactSummary: '缺少回归保护',
      assessment: {
        severity: GovernanceSeverity.Medium,
        priority: GovernancePriority.P2,
        userImpact: 2,
        systemRisk: 3,
        strategicValue: 4,
        fixCost: 2,
        autoActionEligibility: GovernanceAutoActionEligibility.HumanReviewRequired,
        rationale: ['需要进入人工恢复'],
        assessedBy: GovernanceAssessmentSource.Agent
      }
    });

    await api()
      .post(`/api/governance/issues/${issue.id}/resolution-decisions`)
      .send({
        resolution: 'fix',
        reason: '先让 planning 失败'
      });

    const automationBridge = mockGovernanceAutomationBridge(
      Array.from({ length: 6 }, () =>
        createCompletedGovernanceRawResult('```json governance-output\n{"broken": true\n```')
      )
    );

    try {
      await assignGovernanceRunnerSelection(project.id, {
        defaultRunnerIds: [],
        discovery: null,
        triage: null,
        planning: {
          runnerIds: [runner.id],
          fanoutCount: 1,
          mergeStrategy: GovernanceAgentMergeStrategy.Single
        },
        execution: null
      });

      await automationService.runPlanningCycle();
      await automationService.runPlanningCycle();
      await automationService.runPlanningCycle();

      let detail = expectSuccess<GovernanceIssueDetail>(
        await api().get(`/api/governance/issues/${issue.id}`)
      );
      expect(detail.latestPlanningAttempt?.status).toBe('needs_human_review');

      const retryResponse = await api().post(
        `/api/governance/issues/${issue.id}/retry-planning`
      );
      detail = expectSuccess<GovernanceIssueDetail>(retryResponse, 200);
      expect(detail.latestPlanningAttempt?.status).toBe('resolved_by_human');
    } finally {
      automationBridge.restore();
    }
  });

  it('execution worker 应验证 change unit 并推进 issue 到 in_review', async () => {
    const workspace = createTempGitWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceRawResult(
        'Mock governance execution completed in the workspace.'
      )
    ]);

    const planDetail = await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '修复目标文件',
      strategy: '只改目标文件并执行轻量验证',
      affectedTargets: [{ kind: 'file', ref: 'src/feature.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '更新目标文件',
          targets: [{ kind: 'file', ref: 'src/feature.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: workspace.baselineCommitSha,
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '更新目标文件',
          description: '修改 feature 文件',
          scope: {
            targets: [{ kind: 'file', ref: 'src/feature.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto
        }
      ],
      verificationPlans: [
        {
          subjectType: GovernanceVerificationSubjectType.ChangeUnit,
          changeUnitIndex: 0,
          checks: [
            {
              id: 'check-unit',
              type: GovernanceVerificationCheckType.Custom,
              required: true,
              command: 'node -e "process.exit(0)"'
            }
          ],
          passCriteria: ['命令成功']
        },
        {
          subjectType: GovernanceVerificationSubjectType.ChangePlan,
          checks: [
            {
              id: 'check-plan',
              type: GovernanceVerificationCheckType.Custom,
              required: true,
              command: 'node -e "process.exit(0)"'
            }
          ],
          passCriteria: ['计划级验证通过']
        }
      ]
    });

    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.ChangePlan,
      subjectId: planDetail.changePlan!.id,
      decision: GovernanceReviewDecisionType.Approved,
      reviewer: 'lead-1'
    });

    try {
      await assignGovernanceRunnerSelection(project.id, {
        defaultRunnerIds: [],
        discovery: null,
        triage: null,
        planning: null,
        execution: {
          runnerIds: [runner.id],
          fanoutCount: 1,
          mergeStrategy: GovernanceAgentMergeStrategy.Single
        }
      });

      const flowRepositoryPath = await ensureGovernanceFlowRepositoryPath(project.id);
      fs.writeFileSync(
        path.join(flowRepositoryPath, 'src', 'feature.ts'),
        'export const feature = "updated";\n'
      );

      const processed = await automationService.runExecutionCycle();
      expect(processed).toBe(true);

      const detail = expectSuccess<GovernanceIssueDetail>(
        await api().get(`/api/governance/issues/${issue.id}`)
      );
      expect(detail.changeUnits[0]?.status).toBe('verified');
      expect(detail.changeUnits[0]?.latestExecutionAttempt?.status).toBe('succeeded');
      expect(detail.verificationResults.length).toBe(2);
      expect(detail.status).toBe('in_review');
    } finally {
      automationBridge.restore();
    }
  });

  it('change unit approve 后应创建 commit 和 delivery artifact，artifact approve 后关闭 issue', async () => {
    const workspace = createTempGitWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceRawResult(
        'Mock governance execution completed in the workspace.'
      )
    ]);

    const planDetail = await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '修复目标文件',
      strategy: '只改目标文件并执行轻量验证',
      affectedTargets: [{ kind: 'file', ref: 'src/feature.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '更新目标文件',
          targets: [{ kind: 'file', ref: 'src/feature.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: workspace.baselineCommitSha,
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '更新目标文件',
          description: '修改 feature 文件',
          scope: {
            targets: [{ kind: 'file', ref: 'src/feature.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto
        }
      ],
      verificationPlans: [
        {
          subjectType: GovernanceVerificationSubjectType.ChangeUnit,
          changeUnitIndex: 0,
          checks: [
            {
              id: 'check-unit',
              type: GovernanceVerificationCheckType.Custom,
              required: true,
              command: 'node -e "process.exit(0)"'
            }
          ],
          passCriteria: ['命令成功']
        },
        {
          subjectType: GovernanceVerificationSubjectType.ChangePlan,
          checks: [
            {
              id: 'check-plan',
              type: GovernanceVerificationCheckType.Custom,
              required: true,
              command: 'node -e "process.exit(0)"'
            }
          ],
          passCriteria: ['计划级验证通过']
        }
      ]
    });

    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.ChangePlan,
      subjectId: planDetail.changePlan!.id,
      decision: GovernanceReviewDecisionType.Approved,
      reviewer: 'lead-1'
    });

    try {
      await assignGovernanceRunnerSelection(project.id, {
        defaultRunnerIds: [],
        discovery: null,
        triage: null,
        planning: null,
        execution: {
          runnerIds: [runner.id],
          fanoutCount: 1,
          mergeStrategy: GovernanceAgentMergeStrategy.Single
        }
      });

      const flowRepositoryPath = await ensureGovernanceFlowRepositoryPath(project.id);
      fs.writeFileSync(
        path.join(flowRepositoryPath, 'src', 'feature.ts'),
        'export const feature = "updated";\n'
      );

      await automationService.runExecutionCycle();

      let detail = expectSuccess<GovernanceIssueDetail>(
        await api().post('/api/governance/review-decisions').send({
          subjectType: GovernanceReviewSubjectType.ChangeUnit,
          subjectId: planDetail.changeUnits[0]!.id,
          decision: GovernanceReviewDecisionType.Approved,
          reviewer: 'reviewer-1'
        }),
        201
      );

      expect(detail.changeUnits[0]?.status).toBe('committed');
      expect(detail.changeUnits[0]?.producedCommitIds.length).toBe(1);
      expect(detail.deliveryArtifact?.status).toBe('submitted');
      expect(detail.status).toBe('resolved');

      detail = expectSuccess<GovernanceIssueDetail>(
        await api().post('/api/governance/review-decisions').send({
          subjectType: GovernanceReviewSubjectType.DeliveryArtifact,
          subjectId: detail.deliveryArtifact!.id,
          decision: GovernanceReviewDecisionType.Approved,
          reviewer: 'lead-1'
        }),
        201
      );

      expect(detail.status).toBe('closed');
      expect(detail.deliveryArtifact?.status).toBe('merged');
      expect(detail.changeUnits[0]?.status).toBe('merged');
    } finally {
      automationBridge.restore();
    }
  });

  it('manual ready change unit 不应允许直接 approve', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const planDetail = await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '需要人工修改',
      strategy: '由人工完成代码修正后再继续验证',
      affectedTargets: [{ kind: 'file', ref: 'src/manual.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '人工修改目标文件',
          targets: [{ kind: 'file', ref: 'src/manual.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: 'baseline-sha',
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '人工修正',
          description: '手工修改后再跑验证',
          scope: {
            targets: [{ kind: 'file', ref: 'src/manual.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.Manual,
          status: GovernanceChangeUnitStatus.Ready
        }
      ],
      verificationPlans: []
    });

    const error = expectError(
      await api().post('/api/governance/review-decisions').send({
        subjectType: GovernanceReviewSubjectType.ChangeUnit,
        subjectId: planDetail.changeUnits[0]!.id,
        decision: GovernanceReviewDecisionType.Approved,
        reviewer: 'reviewer-1'
      }),
      409
    );

    expect(error.message).toContain('requires status "verified"');
  });

  it('verified change unit 在没有 scoped diff 时 approve 应返回 409', async () => {
    const workspace = createTempGitWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const planDetail = await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '验证空 diff 拦截',
      strategy: '不修改工作区直接审批',
      affectedTargets: [{ kind: 'file', ref: 'src/feature.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '等待人工补改动',
          targets: [{ kind: 'file', ref: 'src/feature.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: workspace.baselineCommitSha,
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '空 diff 审批',
          description: '此时工作区无目标改动',
          scope: {
            targets: [{ kind: 'file', ref: 'src/feature.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto,
          status: GovernanceChangeUnitStatus.Verified
        }
      ],
      verificationPlans: []
    });

    const error = expectError(
      await api().post('/api/governance/review-decisions').send({
        subjectType: GovernanceReviewSubjectType.ChangeUnit,
        subjectId: planDetail.changeUnits[0]!.id,
        decision: GovernanceReviewDecisionType.Approved,
        reviewer: 'reviewer-1'
      }),
      409
    );

    expect(error.message).toContain('No scoped workspace changes');
  });

  it('submitted 之外的 delivery artifact 不应允许审批', async () => {
    const project = await seedProject();
    const governanceService = getApp().get(GovernanceService);
    const governanceRepository = getApp().get(GovernanceRepository);
    const issue = await seedIssue(governanceService, project.id);
    const detail = await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '验证 delivery guard',
      strategy: '只校验审批前置状态',
      affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '生成交付物',
          targets: [{ kind: 'file', ref: 'src/service.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: 'baseline-sha',
      changeUnits: [],
      verificationPlans: []
    });

    const artifact = await governanceRepository.createOrUpdateDeliveryArtifact({
      scopeId: project.id,
      issueId: issue.id,
      changePlanId: detail.changePlan!.id,
      kind: GovernanceDeliveryArtifactKind.ReviewRequest,
      title: '已关闭交付单',
      body: '不可再审批',
      linkedIssueIds: [issue.id],
      linkedChangeUnitIds: [],
      linkedVerificationResultIds: [],
      bodyStrategy: GovernanceDeliveryBodyStrategy.AutoAggregate,
      status: GovernanceDeliveryArtifactStatus.Closed
    });

    const error = expectError(
      await api().post('/api/governance/review-decisions').send({
        subjectType: GovernanceReviewSubjectType.DeliveryArtifact,
        subjectId: artifact.id,
        decision: GovernanceReviewDecisionType.Approved,
        reviewer: 'lead-1'
      }),
      409
    );

    expect(error.message).toContain('requires status "submitted"');
  });

  it('squash commit mode 应在 delivery approve 时统一提交且不自动关闭 issue', async () => {
    const workspace = createTempGitWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const governanceService = getApp().get(GovernanceService);
    const governanceRepository = getApp().get(GovernanceRepository);
    const issue = await seedIssue(governanceService, project.id);

    await api()
      .put(`/api/governance/scopes/${project.id}/policy`)
      .send({
        priorityPolicy: {
          defaultPriority: GovernancePriority.P2
        },
        autoActionPolicy: {
          defaultEligibility: GovernanceAutoActionEligibility.HumanReviewRequired
        },
        deliveryPolicy: {
          commitMode: GovernanceDeliveryCommitMode.Squash,
          autoCloseIssueOnApprovedDelivery: false
        }
      })
      .expect(200);

    const planDetail = await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '用 squash 模式交付',
      strategy: '先审核单元，再统一提交',
      affectedTargets: [{ kind: 'file', ref: 'src/feature.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '更新目标文件',
          targets: [{ kind: 'file', ref: 'src/feature.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: workspace.baselineCommitSha,
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '更新目标文件',
          description: '修改 feature 文件',
          scope: {
            targets: [{ kind: 'file', ref: 'src/feature.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto,
          status: GovernanceChangeUnitStatus.Verified
        }
      ],
      verificationPlans: []
    });

    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.ChangePlan,
      subjectId: planDetail.changePlan!.id,
      decision: GovernanceReviewDecisionType.Approved,
      reviewer: 'lead-1'
    });

    const flowRepositoryPath = await ensureGovernanceFlowRepositoryPath(project.id);
    fs.writeFileSync(
      path.join(flowRepositoryPath, 'src', 'feature.ts'),
      'export const feature = "squash";\n'
    );

    let detail = expectSuccess<GovernanceIssueDetail>(
      await api().post('/api/governance/review-decisions').send({
        subjectType: GovernanceReviewSubjectType.ChangeUnit,
        subjectId: planDetail.changeUnits[0]!.id,
        decision: GovernanceReviewDecisionType.Approved,
        reviewer: 'reviewer-1'
      }),
      201
    );

    expect(detail.changeUnits[0]?.status).toBe('committed');
    expect(detail.changeUnits[0]?.producedCommitIds).toHaveLength(0);
    expect(detail.deliveryArtifact?.status).toBe('submitted');
    expect(detail.status).toBe('resolved');

    detail = expectSuccess<GovernanceIssueDetail>(
      await api().post('/api/governance/review-decisions').send({
        subjectType: GovernanceReviewSubjectType.DeliveryArtifact,
        subjectId: detail.deliveryArtifact!.id,
        decision: GovernanceReviewDecisionType.Approved,
        reviewer: 'lead-1'
      }),
      201
    );

    expect(detail.deliveryArtifact?.status).toBe('merged');
    expect(detail.changeUnits[0]?.status).toBe('merged');
    expect(detail.changeUnits[0]?.producedCommitIds).toHaveLength(1);
    expect(detail.status).toBe('resolved');

    const gitHead = execSync('git rev-parse HEAD', {
      cwd: flowRepositoryPath,
      stdio: 'pipe'
    })
      .toString()
      .trim();
    expect(detail.changeUnits[0]?.producedCommitIds[0]).toBe(gitHead);
  });

  it('partially_resolved issue 在 delivery approve 后应创建 spin-off issue', async () => {
    const workspace = createTempGitWorkspace(tempWorkspaces);
    const project = await seedProject({
      repoGitUrl: workspace.repositoryPath,
      workspaceRootPath: workspace.workspaceRootPath
    });
    const runner = await seedAgentRunner();
    const automationService = getApp().get(GovernanceAutomationService);
    const governanceService = getApp().get(GovernanceService);
    const issue = await seedIssue(governanceService, project.id);
    const automationBridge = mockGovernanceAutomationBridge([
      createCompletedGovernanceRawResult(
        'Mock governance execution completed in the workspace.'
      )
    ]);

    const planDetail = await governanceService.createChangePlanBundle({
      issueId: issue.id,
      objective: '部分交付',
      strategy: '一个单元完成，一个单元取消',
      affectedTargets: [{ kind: 'file', ref: 'src/feature.ts' }],
      proposedActions: [
        {
          id: 'action-1',
          type: GovernanceChangeActionType.CodeChange,
          description: '完成主修复',
          targets: [{ kind: 'file', ref: 'src/feature.ts' }]
        },
        {
          id: 'action-2',
          type: GovernanceChangeActionType.TestAddition,
          description: '后续验证补充',
          targets: [{ kind: 'file', ref: 'src/feature.ts' }]
        }
      ],
      risks: [],
      baselineCommitSha: workspace.baselineCommitSha,
      changeUnits: [
        {
          sourceActionId: 'action-1',
          title: '主修复',
          description: '完成并提交',
          scope: {
            targets: [{ kind: 'file', ref: 'src/feature.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto
        },
        {
          sourceActionId: 'action-2',
          title: '后续验证',
          description: '本轮取消',
          scope: {
            targets: [{ kind: 'file', ref: 'src/feature.ts' }],
            violationPolicy: GovernanceViolationPolicy.Warn
          },
          executionMode: GovernanceExecutionMode.SemiAuto
        }
      ],
      verificationPlans: [
        {
          subjectType: GovernanceVerificationSubjectType.ChangeUnit,
          changeUnitIndex: 0,
          checks: [
            {
              id: 'check-unit',
              type: GovernanceVerificationCheckType.Custom,
              required: true,
              command: 'node -e "process.exit(0)"'
            }
          ],
          passCriteria: ['命令成功']
        },
        {
          subjectType: GovernanceVerificationSubjectType.ChangePlan,
          checks: [
            {
              id: 'check-plan',
              type: GovernanceVerificationCheckType.Custom,
              required: true,
              command: 'node -e "process.exit(0)"'
            }
          ],
          passCriteria: ['计划级验证通过']
        }
      ]
    });

    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.ChangePlan,
      subjectId: planDetail.changePlan!.id,
      decision: GovernanceReviewDecisionType.Approved,
      reviewer: 'lead-1'
    });
    await api().post('/api/governance/review-decisions').send({
      subjectType: GovernanceReviewSubjectType.ChangeUnit,
      subjectId: planDetail.changeUnits[1]!.id,
      decision: GovernanceReviewDecisionType.Skip,
      reviewer: 'reviewer-1'
    });

    try {
      await assignGovernanceRunnerSelection(project.id, {
        defaultRunnerIds: [],
        discovery: null,
        triage: null,
        planning: null,
        execution: {
          runnerIds: [runner.id],
          fanoutCount: 1,
          mergeStrategy: GovernanceAgentMergeStrategy.Single
        }
      });

      const flowRepositoryPath = await ensureGovernanceFlowRepositoryPath(project.id);
      fs.writeFileSync(
        path.join(flowRepositoryPath, 'src', 'feature.ts'),
        'export const feature = "partial";\n'
      );

      await automationService.runExecutionCycle();

      let detail = expectSuccess<GovernanceIssueDetail>(
        await api().post('/api/governance/review-decisions').send({
          subjectType: GovernanceReviewSubjectType.ChangeUnit,
          subjectId: planDetail.changeUnits[0]!.id,
          decision: GovernanceReviewDecisionType.Approved,
          reviewer: 'reviewer-1'
        }),
        201
      );

      expect(detail.status).toBe('partially_resolved');
      expect(detail.deliveryArtifact?.status).toBe('submitted');

      detail = expectSuccess<GovernanceIssueDetail>(
        await api().post('/api/governance/review-decisions').send({
          subjectType: GovernanceReviewSubjectType.DeliveryArtifact,
          subjectId: detail.deliveryArtifact!.id,
          decision: GovernanceReviewDecisionType.Approved,
          reviewer: 'lead-1'
        }),
        201
      );
      expect(detail.status).toBe('closed');

      const issues = expectSuccess<Array<{ id: string; status: string; spinOffOfIssueId?: string }>>(
        await api().get('/api/governance/issues').query({ scopeId: project.id })
      );
      expect(issues).toHaveLength(2);
      const spinOffIssue = issues.find((item) => item.id !== issue.id);
      expect(spinOffIssue?.status).toBe('open');
      expect(spinOffIssue?.spinOffOfIssueId).toBe(issue.id);
    } finally {
      automationBridge.restore();
    }
  });
});

async function seedIssue(governanceService: GovernanceService, scopeId: string) {
  return governanceService.createIssueWithAssessment({
    scopeId,
    title: '重复判空逻辑',
    statement: '同一模块有重复判空逻辑',
    kind: GovernanceIssueKind.Debt,
    categories: ['clean_code'],
    tags: ['duplication'],
    affectedTargets: [{ kind: 'file', ref: 'src/service.ts' }],
    impactSummary: '增加维护成本',
    assessment: {
      severity: GovernanceSeverity.Medium,
      priority: GovernancePriority.P2,
      userImpact: 2,
      systemRisk: 3,
      strategicValue: 4,
      fixCost: 2,
      autoActionEligibility: GovernanceAutoActionEligibility.HumanReviewRequired,
      rationale: ['重复逻辑会持续扩散'],
      assessedBy: GovernanceAssessmentSource.Agent
    }
  });
}

async function assignGovernanceRunnerSelection(
  scopeId: string,
  agentStrategy: GovernanceAgentStrategy
) {
  const governanceService = getApp().get(GovernanceService);

  await governanceService.updateGovernancePolicy(
    scopeId,
    createGovernancePolicyInput({ agentStrategy })
  );
}

async function ensureGovernanceFlowRepositoryPath(scopeId: string) {
  const governanceWorkspaceService = getApp().get(GovernanceWorkspaceService);
  const project = await getPrisma().project.findUnique({
    where: { id: scopeId },
    select: {
      id: true,
      repoGitUrl: true,
      workspaceRootPath: true
    }
  });

  if (!project) {
    throw new Error(`Project not found: ${scopeId}`);
  }

  const workspace = await governanceWorkspaceService.ensureCodeWorkspace(project);
  return workspace.repositoryPath;
}

function createGovernancePolicyInput(
  overrides: Partial<UpdateGovernancePolicyInput> = {}
): UpdateGovernancePolicyInput {
  return {
    priorityPolicy:
      overrides.priorityPolicy ??
      DEFAULT_GOVERNANCE_POLICY_INPUT.priorityPolicy,
    autoActionPolicy:
      overrides.autoActionPolicy ??
      DEFAULT_GOVERNANCE_POLICY_INPUT.autoActionPolicy,
    deliveryPolicy:
      overrides.deliveryPolicy ??
      DEFAULT_GOVERNANCE_POLICY_INPUT.deliveryPolicy,
    ...(overrides.sourceSelection !== undefined
      ? { sourceSelection: overrides.sourceSelection }
      : {}),
    ...(overrides.agentStrategy !== undefined
      ? { agentStrategy: overrides.agentStrategy }
      : {})
  };
}

function createTempGitWorkspace(tempWorkspaces: string[]) {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-repo-'));
  const workspaceRootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), 'governance-flow-root-')
  );
  tempWorkspaces.push(repositoryPath, workspaceRootPath);
  execSync('git init -b master', { cwd: repositoryPath, stdio: 'pipe' });
  execSync('git config user.email "test@example.com"', {
    cwd: repositoryPath,
    stdio: 'pipe'
  });
  execSync('git config user.name "Governance Test"', {
    cwd: repositoryPath,
    stdio: 'pipe'
  });
  fs.mkdirSync(path.join(repositoryPath, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(repositoryPath, 'src', 'feature.ts'),
    'export const feature = "initial";\n'
  );
  execSync('git add .', { cwd: repositoryPath, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: repositoryPath, stdio: 'pipe' });
  const baselineCommitSha = execSync('git rev-parse HEAD', {
    cwd: repositoryPath,
    stdio: 'pipe'
  })
    .toString()
    .trim();

  return {
    repositoryPath,
    workspaceRootPath,
    baselineCommitSha
  };
}

function createRepositoryProfileWorkspace(tempWorkspaces: string[]) {
  const workspace = createTempGitWorkspace(tempWorkspaces);
  const repositoryPath = workspace.repositoryPath;

  fs.writeFileSync(
    path.join(repositoryPath, 'package.json'),
    JSON.stringify(
      {
        name: 'governance-workspace',
        private: true,
        workspaces: ['packages/*']
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(repositoryPath, 'pnpm-workspace.yaml'),
    'packages:\n  - packages/*\n'
  );
  fs.mkdirSync(path.join(repositoryPath, 'packages', 'sample', 'src'), {
    recursive: true
  });
  fs.writeFileSync(
    path.join(repositoryPath, 'packages', 'sample', 'package.json'),
    JSON.stringify(
      {
        name: '@repo/sample',
        version: '1.0.0',
        dependencies: {
          zod: '^3.0.0'
        }
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(repositoryPath, 'packages', 'sample', 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022'
        }
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(repositoryPath, 'packages', 'sample', 'src', 'index.ts'),
    'export const sample = true;\n'
  );
  fs.mkdirSync(path.join(repositoryPath, 'coverage'), { recursive: true });
  fs.writeFileSync(
    path.join(repositoryPath, 'coverage', 'coverage-summary.json'),
    JSON.stringify(
      {
        total: {
          lines: {
            pct: 82
          }
        }
      },
      null,
      2
    )
  );
  execSync('git add .', { cwd: repositoryPath, stdio: 'pipe' });
  execSync('git commit -m "add workspace structure"', {
    cwd: repositoryPath,
    stdio: 'pipe'
  });

  return workspace;
}

function mockGovernanceAutomationBridge(
  results: GovernanceSessionResult[]
) {
  const bridge = getApp().get(GovernanceRunnerBridgeService);
  const governanceRepository = getApp().get(GovernanceRepository);
  const queue = [...results];
  let callNo = 0;

  const createSessionSpy = vi
    .spyOn(bridge, 'createSessionAndSendPrompt')
    .mockImplementation(async () => {
      callNo += 1;
      return {
        sessionId: `governance-test-session-${callNo}`,
        messageId: `governance-test-message-${callNo}`
      };
    });
  const sendFollowUpPromptSpy = vi
    .spyOn(bridge, 'sendFollowUpPrompt')
    .mockImplementation(async () => {
      callNo += 1;
      return `governance-test-repair-${callNo}`;
    });
  const waitForResultSpy = vi
    .spyOn(bridge, 'waitForResult')
    .mockImplementation(async () => {
      const next = queue.shift();
      if (!next) {
        throw new Error('No mocked governance wait result remaining');
      }
      return next;
    });
  const attachAutomationAttemptSessionSpy = vi
    .spyOn(governanceRepository, 'attachAutomationAttemptSession')
    .mockResolvedValue(true);

  return {
    createSessionSpy,
    waitForResultSpy,
    restore() {
      attachAutomationAttemptSessionSpy.mockRestore();
      waitForResultSpy.mockRestore();
      sendFollowUpPromptSpy.mockRestore();
      createSessionSpy.mockRestore();
    }
  };
}

function createCompletedGovernanceResult(payload: Record<string, unknown>): GovernanceSessionResult {
  return createCompletedGovernanceRawResult(
    ['```json governance-output', JSON.stringify(payload), '```'].join('\n')
  );
}

function createCompletedGovernanceRawResult(outputText: string): GovernanceSessionResult {
  return {
    status: 'completed',
    sessionId: 'governance-test-session',
    messageId: `governance-test-message-${Math.random().toString(36).slice(2)}`,
    outputText
  };
}
