import http from 'node:http';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HumanReviewAction,
  MessageRole,
  MessageStatus,
  PipelineArtifactKey,
  PipelineStageStatus,
  PipelineStageType,
  StageExecutionAttemptStatus
} from '@agent-workbench/shared';

import {
  ARTIFACT_STORAGE,
  type ArtifactStorage
} from '../src/modules/pipelines/artifact-storage/artifact-storage.interface';
import {
  getApp,
  getPrisma,
  resetDatabase,
  setupTestApp,
  teardownTestApp
} from './setup';
import { PipelineRuntimeCommandService } from '../src/modules/pipelines/pipeline-runtime-command.service';
import { PipelineSessionBridgeService } from '../src/modules/pipelines/pipeline-session-bridge.service';
import {
  api,
  expectError,
  expectSuccess,
  seedAgentRunner,
  seedProject
} from './helpers';

type PipelineSummary = {
  id: string;
  scopeId: string;
  runnerId: string | null;
  name: string;
  status: string;
  currentStageId: string | null;
};

type PipelineDetail = PipelineSummary & {
  stages: Array<{
    id: string;
    stageType: string;
    name: string;
    status: PipelineStageStatus;
    order: number;
    retryCount: number;
    updatedAt: string;
  }>;
  artifacts: Array<{
    id: string;
    name: string;
    contentType: string;
    metadata: {
      artifactKey: PipelineArtifactKey;
      attempt: number;
      version: number;
    } | null;
  }>;
  humanReview: {
    candidateOutput: unknown | null;
  } | null;
};

type SseEvent = {
  type: string;
  data: {
    eventId?: number;
    stageType?: string;
  };
};

describe('Pipelines Runtime API', () => {
  let projectId: string;
  let runnerId: string;

  beforeAll(async () => {
    await setupTestApp();
    await ensureServerListening();
  });

  afterAll(async () => {
    delete process.env.PIPELINE_STEP_DELAY_MS;
    await teardownTestApp();
  });

  beforeEach(async () => {
    delete process.env.PIPELINE_STEP_DELAY_MS;
    await resetDatabase();
    const project = await seedProject({ name: 'Pipeline Test Project' });
    const runner = await seedAgentRunner({ name: 'Pipeline Test Runner' });
    projectId = project.id;
    runnerId = runner.id;
  });

  async function createDraftPipeline(
    overrides: {
      name?: string;
      featureRequest?: string;
    } = {}
  ) {
    const response = await api()
      .post('/api/pipelines')
      .send({
        scopeId: projectId,
        name: overrides.name ?? 'Test Pipeline',
        featureRequest: overrides.featureRequest ?? '用户可以搜索文章'
      });

    return expectSuccess<PipelineSummary>(response, 201);
  }

  async function startPipeline(
    pipelineId: string,
    options: {
      runnerId?: string;
      maxRetry?: number;
    } = {}
  ) {
    const response = await api()
      .post(`/api/pipelines/${pipelineId}/start`)
      .send({
        runnerId: options.runnerId ?? runnerId,
        ...(options.maxRetry !== undefined ? { maxRetry: options.maxRetry } : {})
      });

    return expectSuccess<PipelineSummary>(response, 200);
  }

  async function submitDecision(
    pipelineId: string,
    decision: Record<string, unknown>
  ) {
    const response = await api()
      .post(`/api/pipelines/${pipelineId}/decision`)
      .send({ decision });

    return expectSuccess(response, 200);
  }

  async function submitEditAndContinueCurrentOutput(
    pipelineId: string,
    comment = 'accept current output'
  ) {
    const detail = await getPipelineDetail(pipelineId);
    expect(detail.humanReview?.candidateOutput).not.toBeNull();

    return submitDecision(pipelineId, {
      action: HumanReviewAction.EditAndContinue,
      comment,
      editedOutput: detail.humanReview?.candidateOutput
    });
  }

  async function getPipelineDetail(pipelineId: string) {
    const response = await api().get(`/api/pipelines/${pipelineId}`);
    return expectSuccess<PipelineDetail>(response, 200);
  }

  async function getPipelineSummary(pipelineId: string) {
    const response = await api().get(`/api/pipelines/${pipelineId}`);
    return expectSuccess<PipelineSummary>(response, 200);
  }

  async function waitForPipelineStatus(
    pipelineId: string,
    targetStatus: string,
    timeoutMs = 8_000
  ) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const pipeline = await getPipelineSummary(pipelineId);
      if (pipeline.status === targetStatus) {
        return pipeline;
      }
      await sleep(50);
    }

    const current = await getPipelineSummary(pipelineId);
    throw new Error(
      `Pipeline ${pipelineId} did not reach '${targetStatus}', current: ${current.status}`
    );
  }

  async function restartTestAppPreservingDatabase() {
    await teardownTestApp({ preserveDb: true });
    await setupTestApp({ resetDb: false });
    await ensureServerListening();
  }

  describe('POST /pipelines/:id/start', () => {
    it('应校验 runnerId 存在并持久化到 pipeline', async () => {
      const pipeline = await createDraftPipeline({
        featureRequest: '[invalid-breakdown] 用户可以搜索文章'
      });

      expectError(
        await api()
          .post(`/api/pipelines/${pipeline.id}/start`)
          .send({ runnerId: 'runner-missing' }),
        404
      );

      const started = await startPipeline(pipeline.id);
      expect(started.runnerId).toBe(runnerId);

      await waitForPipelineStatus(pipeline.id, 'paused');
      const detail = await getPipelineDetail(pipeline.id);

      expect(detail.runnerId).toBe(runnerId);
      expect(detail.stages).toHaveLength(5);
    });

    it('并发 start 同一个 draft pipeline 时应返回一个 200 和一个 409', async () => {
      const pipeline = await createDraftPipeline();

      const [first, second] = await Promise.all([
        api().post(`/api/pipelines/${pipeline.id}/start`).send({ runnerId }),
        api().post(`/api/pipelines/${pipeline.id}/start`).send({ runnerId })
      ]);

      expect([first.status, second.status].sort((left, right) => left - right)).toEqual([
        200,
        409
      ]);

      await waitForPipelineStatus(pipeline.id, 'paused');
      const detail = await getPipelineDetail(pipeline.id);
      expect(detail.stages).toHaveLength(5);
    });

    it('start 成功后 live SSE 应收到 pipeline_started', async () => {
      const pipeline = await createDraftPipeline();
      const streamPromise = collectSse(
        `/api/pipelines/${pipeline.id}/events`,
        800
      );

      await sleep(50);
      await startPipeline(pipeline.id);

      const stream = await streamPromise;
      expect(stream.events.map((event) => event.type)).toContain(
        'pipeline_started'
      );
    });

    it('storage materialization 失败时仍应进入 paused，且 artifact 内容可直接读取', async () => {
      const artifactStorage = getApp().get<ArtifactStorage>(ARTIFACT_STORAGE);
      const writeSpy = vi
        .spyOn(artifactStorage, 'write')
        .mockRejectedValue(new Error('storage unavailable'));

      try {
        const pipeline = await createDraftPipeline();
        await startPipeline(pipeline.id);
        await waitForPipelineStatus(pipeline.id, 'paused');

        const detail = await getPipelineDetail(pipeline.id);
        const planReportArtifact = detail.artifacts.find(
          (artifact) =>
            artifact.metadata?.artifactKey === PipelineArtifactKey.PlanReport
        );

        expect(planReportArtifact).toBeDefined();

        const contentResponse = await api()
          .get(
            `/api/pipelines/${pipeline.id}/artifacts/${planReportArtifact?.id}/content`
          )
          .expect(200);

        expect(contentResponse.headers['content-type']).toContain('application/json');
        expect(contentResponse.text.length).toBeGreaterThan(0);

        const failedMaterialization = await waitForArtifactMaterializationFailure(
          planReportArtifact!.id
        );
        expect(failedMaterialization.storageRef).toBeNull();
        expect(failedMaterialization.lastError).toContain('storage unavailable');
      } finally {
        writeSpy.mockRestore();
      }
    });
  });

  describe('human review resume and replay', () => {
    it('WAITING_REPAIR 恢复后若 repair 响应已存在则不重复发送 follow-up prompt', async () => {
      const pipeline = await createDraftPipeline({
        featureRequest: '[parse-fail-once] 用户可以搜索文章'
      });
      const bridgeService = getApp().get(PipelineSessionBridgeService);
      const originalWaitForResult = bridgeService.waitForResult.bind(bridgeService);
      const gate = createGate();
      let waitInvocationCount = 0;
      const waitSpy = vi
        .spyOn(bridgeService, 'waitForResult')
        .mockImplementation(async (sessionId, messageId, timeoutMs) => {
          waitInvocationCount += 1;
          if (waitInvocationCount === 2) {
            await gate.wait();
          }

          return originalWaitForResult(sessionId, messageId, timeoutMs);
        });

      try {
        await startPipeline(pipeline.id);
        await waitForCondition(async () => {
          const attempt = await getLatestAttemptByStageType(
            pipeline.id,
            PipelineStageType.Breakdown
          );
          return attempt?.status === StageExecutionAttemptStatus.WaitingRepair;
        }, 10_000);

        const waitingRepairAttempt = await getLatestAttemptByStageType(
          pipeline.id,
          PipelineStageType.Breakdown
        );
        expect(waitingRepairAttempt?.sessionId).toBeTruthy();

        const sessionId = waitingRepairAttempt?.sessionId as string;
        await waitForAssistantMessagesReady(sessionId, 2, 10_000);

        const expiredAt = new Date(Date.now() - 60_000);
        await getPrisma().pipeline.update({
          where: { id: pipeline.id },
          data: {
            executionLeaseExpiresAt: expiredAt
          }
        });
        await getPrisma().stageExecutionAttempt.update({
          where: { id: waitingRepairAttempt!.id },
          data: {
            leaseExpiresAt: expiredAt
          }
        });

        await restartTestAppPreservingDatabase();
        gate.release();

        await waitForPipelineStatus(pipeline.id, 'paused', 10_000);

        const assistantMessages = await getPrisma().sessionMessage.findMany({
          where: {
            sessionId,
            role: MessageRole.Assistant
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        });

        expect(assistantMessages).toHaveLength(2);
      } finally {
        gate.release();
        waitSpy.mockRestore();
      }
    });

    it('重启后仍可通过 edit_and_continue 继续执行，eventId 保持单调递增且 afterEventId replay 不重复', async () => {
      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'paused');

      const beforeRestart = await getPrisma().pipeline.findUniqueOrThrow({
        where: { id: pipeline.id },
        select: { lastEventId: true }
      });

      await restartTestAppPreservingDatabase();

      await submitEditAndContinueCurrentOutput(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'completed');

      const afterRestart = await getPrisma().pipeline.findUniqueOrThrow({
        where: { id: pipeline.id },
        select: { lastEventId: true }
      });
      expect(afterRestart.lastEventId).toBeGreaterThan(beforeRestart.lastEventId);

      const replay = await collectSse(
        `/api/pipelines/${pipeline.id}/events?lastEventId=${beforeRestart.lastEventId}`
      );
      const replayIds = replay.events
        .map((event) => event.data.eventId ?? -1)
        .filter((eventId) => eventId >= 0);

      expect(replayIds.length).toBeGreaterThan(0);
      expect(replayIds.every((eventId) => eventId > beforeRestart.lastEventId)).toBe(
        true
      );
      expect(new Set(replayIds).size).toBe(replayIds.length);

      const fullReplay = await collectSse(`/api/pipelines/${pipeline.id}/events`);
      expect(fullReplay.events.map((event) => event.type)).toContain('pipeline_started');
      const stageEvents = fullReplay.events.filter((event) =>
        event.type.startsWith('stage_')
      );
      expect(stageEvents.length).toBeGreaterThan(0);
      expect(stageEvents.every((event) => Boolean(event.data.stageType))).toBe(true);

      const events = await getPrisma().pipelineEvent.findMany({
        where: { pipelineId: pipeline.id },
        orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
      });
      const eventIds = events.map((event) => event.eventId);
      expect(eventIds).toEqual([...new Set(eventIds)].sort((left, right) => left - right));
      expect(eventIds.at(-1)).toBe(afterRestart.lastEventId);
    });

    it('submitDecision 恢复后应写出 pipeline_resumed 事件', async () => {
      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'paused');

      const beforeDecision = await getPrisma().pipeline.findUniqueOrThrow({
        where: { id: pipeline.id },
        select: { lastEventId: true }
      });

      await submitDecision(
        pipeline.id,
        {
          action: HumanReviewAction.Retry,
          comment: '重新估算边界条件'
        }
      );
      await waitForPipelineStatus(pipeline.id, 'paused');

      const replay = await collectSse(
        `/api/pipelines/${pipeline.id}/events?lastEventId=${beforeDecision.lastEventId}`
      );
      expect(replay.events.map((event) => event.type)).toContain('pipeline_resumed');
    });
  });

  describe('POST /pipelines/:id/decision', () => {
    it('skip 必须提供反馈；retry 成功 review 时应仅重跑 estimate', async () => {
      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'paused');

      expectError(
        await api()
          .post(`/api/pipelines/${pipeline.id}/decision`)
          .send({ decision: { action: HumanReviewAction.Skip } }),
        400
      );

      const initialDetail = await getPipelineDetail(pipeline.id);
      const initialEstimateUpdatedAt = initialDetail.stages.find(
        (stage) => stage.stageType === 'estimate'
      )?.updatedAt;

      await sleep(1100);
      await submitDecision(
        pipeline.id,
        {
          action: HumanReviewAction.Retry,
          comment: '重新执行 estimate'
        }
      );
      await waitForPipelineStatus(pipeline.id, 'paused');

      const modifiedDetail = await getPipelineDetail(pipeline.id);
      const modifiedSpec = modifiedDetail.stages.find(
        (stage) => stage.stageType === 'spec'
      );
      const modifiedEstimate = modifiedDetail.stages.find(
        (stage) => stage.stageType === 'estimate'
      );
      expect(modifiedSpec?.updatedAt).toBe(
        initialDetail.stages.find((stage) => stage.stageType === 'spec')?.updatedAt
      );
      expect(modifiedEstimate?.updatedAt).not.toBe(initialEstimateUpdatedAt);
      await waitForArtifactVersions(pipeline.id, PipelineArtifactKey.PlanReport, [2, 1]);
    });

    it('evaluation reject 进入 human_review 后 retry 会从 breakdown 重新执行', async () => {
      const pipeline = await createDraftPipeline({
        featureRequest: '[invalid-breakdown] 用户可以搜索文章'
      });
      await api()
        .post(`/api/pipelines/${pipeline.id}/start`)
        .send({ runnerId, maxRetry: 1 });
      await waitForPipelineStatus(pipeline.id, 'paused');

      const initialDetail = await getPipelineDetail(pipeline.id);
      const initialBreakdownUpdatedAt = initialDetail.stages.find(
        (stage) => stage.stageType === 'breakdown'
      )?.updatedAt;

      await sleep(1100);
      await submitDecision(
        pipeline.id,
        {
          action: HumanReviewAction.Retry,
          comment: '请重新拆分任务粒度'
        }
      );
      await waitForPipelineStatus(pipeline.id, 'paused');

      const rejectedDetail = await getPipelineDetail(pipeline.id);
      const rejectedBreakdown = rejectedDetail.stages.find(
        (stage) => stage.stageType === 'breakdown'
      );
      expect(rejectedBreakdown?.updatedAt).not.toBe(initialBreakdownUpdatedAt);
      await waitForArtifactVersions(pipeline.id, PipelineArtifactKey.Prd, [3, 2, 1]);

      const readyRejectedDetail = await getPipelineDetail(pipeline.id);
      const readyPrdArtifacts = readyRejectedDetail.artifacts.filter(
        (artifact) => artifact.metadata?.artifactKey === PipelineArtifactKey.Prd
      );

      expect(readyPrdArtifacts.map((artifact) => artifact.metadata?.attempt)).toEqual([
        3,
        2,
        1
      ]);
    });
  });

  describe('worker state transitions', () => {
    it('stale running lease 在重启恢复后会复用同一 attempt 继续推进', async () => {
      const pipeline = await createDraftPipeline();
      const bridgeService = getApp().get(PipelineSessionBridgeService);
      const originalWaitForResult = bridgeService.waitForResult.bind(bridgeService);
      const gate = createGate();
      const waitSpy = vi
        .spyOn(bridgeService, 'waitForResult')
        .mockImplementation(async (sessionId, messageId, timeoutMs) => {
          await gate.wait();
          return originalWaitForResult(sessionId, messageId, timeoutMs);
        });

      try {
        await startPipeline(pipeline.id);
        await waitForCondition(async () => {
          const attempt = await getLatestAttemptByStageType(
            pipeline.id,
            PipelineStageType.Breakdown
          );
          return (
            attempt?.status === StageExecutionAttemptStatus.Running &&
            Boolean(attempt.sessionId) &&
            Boolean(attempt.activeRequestMessageId)
          );
        }, 10_000);

        const staleAttempt = await getLatestAttemptByStageType(
          pipeline.id,
          PipelineStageType.Breakdown
        );
        expect(staleAttempt).not.toBeNull();

        const sessionId = staleAttempt?.sessionId as string;
        await waitForAssistantMessagesReady(sessionId, 1, 10_000);

        const expiredAt = new Date(Date.now() - 60_000);
        await getPrisma().pipeline.update({
          where: { id: pipeline.id },
          data: {
            executionLeaseExpiresAt: expiredAt
          }
        });
        await getPrisma().stageExecutionAttempt.update({
          where: { id: staleAttempt!.id },
          data: {
            leaseExpiresAt: expiredAt
          }
        });

        await restartTestAppPreservingDatabase();
        gate.release();

        await waitForPipelineStatus(pipeline.id, 'paused', 10_000);

        const recoveredAttempt = await getLatestAttemptByStageType(
          pipeline.id,
          PipelineStageType.Breakdown
        );
        const assistantMessages = await getPrisma().sessionMessage.findMany({
          where: {
            sessionId,
            role: MessageRole.Assistant
          }
        });

        expect(recoveredAttempt?.id).toBe(staleAttempt?.id);
        expect(recoveredAttempt?.attemptNo).toBe(1);
        expect(recoveredAttempt?.status).toBe(StageExecutionAttemptStatus.Succeeded);
        expect(assistantMessages).toHaveLength(1);
      } finally {
        gate.release();
        waitSpy.mockRestore();
      }
    });

    it('failed 终态会清理 active attempts 并阻止旧 worker 覆盖结果', async () => {
      const pipeline = await createDraftPipeline();
      const bridgeService = getApp().get(PipelineSessionBridgeService);
      const runtimeCommandService = getApp().get(PipelineRuntimeCommandService);
      const originalWaitForResult = bridgeService.waitForResult.bind(bridgeService);
      const gate = createGate();
      let completedWaitCount = 0;
      const waitSpy = vi
        .spyOn(bridgeService, 'waitForResult')
        .mockImplementation(async (sessionId, messageId, timeoutMs) => {
          try {
            await gate.wait();
            return originalWaitForResult(sessionId, messageId, timeoutMs);
          } finally {
            completedWaitCount += 1;
          }
        });

      try {
        await startPipeline(pipeline.id);
        await waitForCondition(async () => {
          const attempt = await getLatestAttemptByStageType(
            pipeline.id,
            PipelineStageType.Breakdown
          );
          return (
            attempt?.status === StageExecutionAttemptStatus.Running &&
            Boolean(attempt.sessionId) &&
            Boolean(attempt.activeRequestMessageId)
          );
        }, 10_000);

        const activeAttempt = await getLatestAttemptByStageType(
          pipeline.id,
          PipelineStageType.Breakdown
        );
        expect(activeAttempt).not.toBeNull();

        const execution = await getPrisma().pipeline.findUniqueOrThrow({
          where: { id: pipeline.id },
          select: {
            executionOwnerId: true,
            version: true
          }
        });
        expect(execution.executionOwnerId).toBeTruthy();

        const failed = await runtimeCommandService.failExecution(
          pipeline.id,
          execution.executionOwnerId as string,
          'forced failure for cleanup test',
          execution.version
        );
        expect(failed).toBe(true);

        gate.release();
        await waitForPipelineStatus(pipeline.id, 'failed', 10_000);
        await waitForCondition(() => completedWaitCount > 0, 10_000);

        const finalAttempt = await getPrisma().stageExecutionAttempt.findUniqueOrThrow({
          where: { id: activeAttempt!.id }
        });
        const activeAttempts = await getPrisma().stageExecutionAttempt.findMany({
          where: {
            stage: { pipelineId: pipeline.id },
            status: {
              in: [
                StageExecutionAttemptStatus.Pending,
                StageExecutionAttemptStatus.Running,
                StageExecutionAttemptStatus.WaitingRepair
              ]
            }
          }
        });

        expect(activeAttempts).toHaveLength(0);
        expect(finalAttempt.status).toBe(StageExecutionAttemptStatus.Failed);
        expect(finalAttempt.failureCode).toBe('PIPELINE_FAILED');
        expect(finalAttempt.failureMessage).toBe('forced failure for cleanup test');

        const followUpPipeline = await createDraftPipeline({
          featureRequest:
            '[invalid-breakdown] follow-up pipeline should still be claimable'
        });
        await startPipeline(followUpPipeline.id, { maxRetry: 1 });
        await waitForPipelineStatus(followUpPipeline.id, 'paused', 10_000);
      } finally {
        gate.release();
        waitSpy.mockRestore();
      }
    });

    it('evaluation reject 耗尽预算时应进入 human_review，并发出 stage_failed/pipeline_paused', async () => {
      const pipeline = await createDraftPipeline({
        featureRequest: '[invalid-breakdown] 用户可以搜索文章'
      });
      await startPipeline(pipeline.id, { maxRetry: 1 });

      await waitForPipelineStatus(pipeline.id, 'paused', 10_000);

      const detail = await getPipelineDetail(pipeline.id);
      const evaluationStage = detail.stages.find(
        (stage) => stage.stageType === 'evaluation'
      );

      expect(evaluationStage?.status).toBe('failed');
      expect(evaluationStage?.retryCount).toBe(2);

      const eventKinds = (
        await getPrisma().pipelineEvent.findMany({
          where: { pipelineId: pipeline.id },
          orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
        })
      ).map((event) => event.kind);
      expect(eventKinds).toContain('stage_failed');
      expect(eventKinds).toContain('pipeline_paused');
    });

    it('running 状态下取消后不得再被 worker 覆盖为其他终态', async () => {
      process.env.PIPELINE_STEP_DELAY_MS = '350';

      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'running', 5_000);

      const response = await api().post(`/api/pipelines/${pipeline.id}/cancel`);
      const cancelled = expectSuccess<PipelineSummary>(response, 200);
      expect(cancelled.status).toBe('cancelled');

      await sleep(700);
      const finalPipeline = await getPipelineSummary(pipeline.id);
      const finalDetail = await getPipelineDetail(pipeline.id);
      expect(finalPipeline.status).toBe('cancelled');
      expect(finalDetail.currentStageId).toBeNull();
      expect(
        finalDetail.stages.some(
          (stage) => stage.status === PipelineStageStatus.Cancelled
        )
      ).toBe(true);
      expect(
        finalDetail.stages.some(
          (stage) =>
            stage.status === PipelineStageStatus.Running ||
            stage.status === PipelineStageStatus.AwaitingReview
        )
      ).toBe(false);

      const eventKinds = (
        await getPrisma().pipelineEvent.findMany({
          where: { pipelineId: pipeline.id },
          orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
        })
      ).map((event) => event.kind);
      expect(eventKinds).toContain('pipeline_cancelled');
      expect(eventKinds).not.toContain('pipeline_completed');

      const activeAttempts = await getPrisma().stageExecutionAttempt.findMany({
        where: {
          stage: { pipelineId: pipeline.id },
          status: {
            in: [
              StageExecutionAttemptStatus.Pending,
              StageExecutionAttemptStatus.Running,
              StageExecutionAttemptStatus.WaitingRepair
            ]
          }
        }
      });
      expect(activeAttempts).toHaveLength(0);
    });

    it('paused 状态下取消应保持 cancelled，并通过 SSE replay 可见', async () => {
      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'paused');

      const response = await api().post(`/api/pipelines/${pipeline.id}/cancel`);
      const cancelled = expectSuccess<PipelineSummary>(response, 200);
      expect(cancelled.status).toBe('cancelled');

      const detail = await getPipelineDetail(pipeline.id);
      const humanReviewStage = detail.stages.find(
        (stage) => stage.stageType === 'human_review'
      );
      expect(detail.currentStageId).toBeNull();
      expect(humanReviewStage?.status).toBe(PipelineStageStatus.Cancelled);

      const replay = await collectSse(`/api/pipelines/${pipeline.id}/events`);
      expect(replay.events.map((event) => event.type)).toContain('pipeline_cancelled');
    });

    it('cancel 与 complete 并发时只能收敛为一个终态事件', async () => {
      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'paused');

      const runtimeCommandService = getApp().get(PipelineRuntimeCommandService);
      const originalCompleteExecution =
        runtimeCommandService.completeExecution.bind(runtimeCommandService);
      const gate = createGate();
      const completeSpy = vi
        .spyOn(runtimeCommandService, 'completeExecution')
        .mockImplementation(
          async (pipelineId: string, ownerId: string, expectedVersion: number) => {
          await gate.wait();
            return originalCompleteExecution(pipelineId, ownerId, expectedVersion);
          }
        );

      try {
        const decisionPromise = submitDecision(
          pipeline.id,
          {
            action: HumanReviewAction.EditAndContinue,
            comment: 'accept current output',
            editedOutput: (await getPipelineDetail(pipeline.id)).humanReview
              ?.candidateOutput
          }
        );
        await waitForCondition(() => completeSpy.mock.calls.length > 0);

        const cancelResponse = await api().post(`/api/pipelines/${pipeline.id}/cancel`);
        const cancelled = expectSuccess<PipelineSummary>(cancelResponse, 200);
        expect(cancelled.status).toBe('cancelled');

        gate.release();
        await decisionPromise;
        await waitForPipelineStatus(pipeline.id, 'cancelled');

        const terminalEvents = (
          await getPrisma().pipelineEvent.findMany({
            where: {
              pipelineId: pipeline.id,
              kind: {
                in: ['pipeline_completed', 'pipeline_failed', 'pipeline_cancelled']
              }
            },
            orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
          })
        ).map((event) => event.kind);

        expect(terminalEvents).toEqual(['pipeline_cancelled']);
      } finally {
        gate.release();
        completeSpy.mockRestore();
      }
    });

    it('cancel 与 pause 并发时只能收敛为一个终态事件', async () => {
      const pipeline = await createDraftPipeline({
        featureRequest: '[invalid-breakdown] 用户可以搜索文章'
      });
      const runtimeCommandService = getApp().get(PipelineRuntimeCommandService);
      const originalPauseForHumanReview =
        runtimeCommandService.pauseForHumanReview.bind(runtimeCommandService);
      const gate = createGate();
      const pauseSpy = vi
        .spyOn(runtimeCommandService, 'pauseForHumanReview')
        .mockImplementation(
          async (
            pipelineId: string,
            ownerId: string,
            expectedVersion: number,
            runtimeState
          ) => {
            await gate.wait();
            return originalPauseForHumanReview(
              pipelineId,
              ownerId,
              expectedVersion,
              runtimeState
            );
          }
        );

      try {
        await startPipeline(pipeline.id, { maxRetry: 1 });
        await waitForCondition(() => pauseSpy.mock.calls.length > 0, 10_000);

        const cancelResponse = await api().post(`/api/pipelines/${pipeline.id}/cancel`);
        const cancelled = expectSuccess<PipelineSummary>(cancelResponse, 200);
        expect(cancelled.status).toBe('cancelled');

        gate.release();
        await waitForPipelineStatus(pipeline.id, 'cancelled');

        const terminalEvents = (
          await getPrisma().pipelineEvent.findMany({
            where: {
              pipelineId: pipeline.id,
              kind: {
                in: ['pipeline_completed', 'pipeline_failed', 'pipeline_cancelled']
              }
            },
            orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
          })
        ).map((event) => event.kind);

        expect(terminalEvents).toEqual(['pipeline_cancelled']);
      } finally {
        gate.release();
        pauseSpy.mockRestore();
      }
    });
  });
});

async function ensureServerListening() {
  const server = getApp().getHttpServer() as http.Server;
  if (!server.listening) {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
  }
}

function collectSse(
  path: string,
  collectMs = 400
): Promise<{ statusCode: number; events: SseEvent[] }> {
  return new Promise((resolve) => {
    const server = getApp().getHttpServer() as http.Server;
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const chunks: string[] = [];
    const request = http.get(
      `http://127.0.0.1:${port}${path}`,
      { headers: { Accept: 'text/event-stream' } },
      (response) => {
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => chunks.push(chunk));

        setTimeout(() => {
          const contentType = String(response.headers['content-type'] ?? '');
          response.destroy();
          const events = contentType.includes('text/event-stream')
            ? parseSseEvents(chunks.join(''))
            : [];
          resolve({
            statusCode: response.statusCode ?? 0,
            events
          });
        }, collectMs);
      }
    );

    request.on('error', () => resolve({ statusCode: 0, events: [] }));
  });
}

function parseSseEvents(payload: string): SseEvent[] {
  return payload
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      const type =
        lines.find((line) => line.startsWith('event:'))?.replace(/^event:\s*/, '') ??
        'message';
      const rawData =
        lines.find((line) => line.startsWith('data:'))?.replace(/^data:\s*/, '') ??
        'null';

      return {
        type,
        data: JSON.parse(rawData) as SseEvent['data']
      };
    });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createGate() {
  let released = false;
  let releasePromise: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    releasePromise = () => {
      if (released) {
        return;
      }
      released = true;
      resolve();
    };
  });

  return {
    wait: () => promise,
    release: () => releasePromise?.()
  };
}

async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5_000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await sleep(25);
  }

  throw new Error('Condition was not met before timeout');
}

async function getLatestAttemptByStageType(
  pipelineId: string,
  stageType: PipelineStageType
) {
  return getPrisma().stageExecutionAttempt.findFirst({
    where: {
      stage: {
        pipelineId,
        stageType
      }
    },
    orderBy: [{ attemptNo: 'desc' }, { createdAt: 'desc' }]
  });
}

async function waitForAssistantMessageCount(
  sessionId: string,
  expectedCount: number,
  timeoutMs = 5_000
) {
  await waitForCondition(async () => {
    const count = await getPrisma().sessionMessage.count({
      where: {
        sessionId,
        role: MessageRole.Assistant
      }
    });

    return count === expectedCount;
  }, timeoutMs);
}

async function waitForAssistantMessagesReady(
  sessionId: string,
  expectedCount: number,
  timeoutMs = 5_000
) {
  await waitForCondition(async () => {
    const messages = await getPrisma().sessionMessage.findMany({
      where: {
        sessionId,
        role: MessageRole.Assistant
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    return (
      messages.length === expectedCount &&
      messages.every((message) => message.status === MessageStatus.Complete)
    );
  }, timeoutMs);
}

async function waitForArtifactVersions(
  pipelineId: string,
  artifactKey: PipelineArtifactKey,
  expectedVersions: number[],
  timeoutMs = 5_000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const detail = await fetchPipelineDetail(pipelineId);
    const versions = detail.artifacts
      .filter((artifact) => artifact.metadata?.artifactKey === artifactKey)
      .map((artifact) => artifact.metadata?.version);

    if (JSON.stringify(versions) === JSON.stringify(expectedVersions)) {
      return;
    }

    await sleep(50);
  }

  const detail = await fetchPipelineDetail(pipelineId);
  const versions = detail.artifacts
    .filter((artifact) => artifact.metadata?.artifactKey === artifactKey)
    .map((artifact) => artifact.metadata?.version);
  throw new Error(
    `Artifact versions for ${artifactKey} did not match ${expectedVersions.join(
      ','
    )}, current: ${versions.join(',')}`
  );
}

async function fetchPipelineDetail(pipelineId: string) {
  const response = await api().get(`/api/pipelines/${pipelineId}`);
  return expectSuccess<PipelineDetail>(response, 200);
}

async function waitForArtifactMaterializationFailure(
  artifactId: string,
  timeoutMs = 5_000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const artifact = await getPrisma().pipelineArtifact.findUnique({
      where: { id: artifactId },
      select: {
        id: true,
        storageRef: true,
        lastError: true
      }
    });

    if (artifact?.lastError) {
      return artifact;
    }

    await sleep(50);
  }

  const artifact = await getPrisma().pipelineArtifact.findUniqueOrThrow({
    where: { id: artifactId },
    select: {
      id: true,
      storageRef: true,
      lastError: true
    }
  });
  throw new Error(
    `Artifact ${artifactId} did not record materialization failure, current error: ${
      artifact.lastError ?? 'null'
    }`
  );
}
