import http from 'node:http';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { HumanDecisionAction } from '@agent-workbench/shared';

import {
  getApp,
  getPrisma,
  resetDatabase,
  setupTestApp,
  teardownTestApp
} from './setup';
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
    status: string;
    order: number;
    retryCount: number;
    updatedAt: string;
  }>;
  artifacts: Array<{
    id: string;
    name: string;
    contentType: string;
  }>;
};

type SseEvent = {
  type: string;
  data: {
    eventId?: number;
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
    action: HumanDecisionAction,
    feedback?: string
  ) {
    const response = await api()
      .post(`/api/pipelines/${pipelineId}/decision`)
      .send({ decision: { action, feedback } });

    return expectSuccess(response, 200);
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
      const pipeline = await createDraftPipeline();

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
  });

  describe('human review resume and replay', () => {
    it('重启后仍可 approve 继续执行，eventId 保持单调递增且 afterEventId replay 不重复', async () => {
      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'paused');

      const beforeRestart = await getPrisma().pipeline.findUniqueOrThrow({
        where: { id: pipeline.id },
        select: { lastEventId: true }
      });

      await restartTestAppPreservingDatabase();

      await submitDecision(pipeline.id, HumanDecisionAction.Approve);
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

      const events = await getPrisma().pipelineEvent.findMany({
        where: { pipelineId: pipeline.id },
        orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
      });
      const eventIds = events.map((event) => event.eventId);
      expect(eventIds).toEqual([...new Set(eventIds)].sort((left, right) => left - right));
      expect(eventIds.at(-1)).toBe(afterRestart.lastEventId);
    });
  });

  describe('POST /pipelines/:id/decision', () => {
    it('modify/reject 必须提供反馈；modify 仅重跑 spec 之后的阶段', async () => {
      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'paused');

      expectError(
        await api()
          .post(`/api/pipelines/${pipeline.id}/decision`)
          .send({ decision: { action: HumanDecisionAction.Modify } }),
        400
      );

      const initialDetail = await getPipelineDetail(pipeline.id);
      const initialBreakdownUpdatedAt = initialDetail.stages.find(
        (stage) => stage.stageType === 'breakdown'
      )?.updatedAt;
      const initialSpecUpdatedAt = initialDetail.stages.find(
        (stage) => stage.stageType === 'spec'
      )?.updatedAt;

      await sleep(1100);
      await submitDecision(
        pipeline.id,
        HumanDecisionAction.Modify,
        '补充 AC 的失败路径'
      );
      await waitForPipelineStatus(pipeline.id, 'paused');

      const modifiedDetail = await getPipelineDetail(pipeline.id);
      const modifiedBreakdown = modifiedDetail.stages.find(
        (stage) => stage.stageType === 'breakdown'
      );
      const modifiedSpec = modifiedDetail.stages.find(
        (stage) => stage.stageType === 'spec'
      );

      expect(modifiedBreakdown?.updatedAt).toBe(initialBreakdownUpdatedAt);
      expect(modifiedSpec?.updatedAt).not.toBe(initialSpecUpdatedAt);
    });

    it('reject 会从 breakdown 重新执行', async () => {
      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'paused');

      const initialDetail = await getPipelineDetail(pipeline.id);
      const initialBreakdownUpdatedAt = initialDetail.stages.find(
        (stage) => stage.stageType === 'breakdown'
      )?.updatedAt;

      await sleep(1100);
      await submitDecision(
        pipeline.id,
        HumanDecisionAction.Reject,
        '请重新拆分任务粒度'
      );
      await waitForPipelineStatus(pipeline.id, 'paused');

      const rejectedDetail = await getPipelineDetail(pipeline.id);
      const rejectedBreakdown = rejectedDetail.stages.find(
        (stage) => stage.stageType === 'breakdown'
      );

      expect(rejectedBreakdown?.updatedAt).not.toBe(initialBreakdownUpdatedAt);
    });
  });

  describe('worker state transitions', () => {
    it('evaluation 连续失败时应按 maxRetry 进入 failed，并发出 stage_failed/pipeline_failed', async () => {
      const pipeline = await createDraftPipeline({
        featureRequest: '[invalid-breakdown] 用户可以搜索文章'
      });
      await startPipeline(pipeline.id, { maxRetry: 1 });

      await waitForPipelineStatus(pipeline.id, 'failed', 10_000);

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
      expect(eventKinds).toContain('pipeline_failed');
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
      expect(finalPipeline.status).toBe('cancelled');

      const eventKinds = (
        await getPrisma().pipelineEvent.findMany({
          where: { pipelineId: pipeline.id },
          orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
        })
      ).map((event) => event.kind);
      expect(eventKinds).toContain('pipeline_cancelled');
      expect(eventKinds).not.toContain('pipeline_completed');
    });

    it('paused 状态下取消应保持 cancelled，并通过 SSE replay 可见', async () => {
      const pipeline = await createDraftPipeline();
      await startPipeline(pipeline.id);
      await waitForPipelineStatus(pipeline.id, 'paused');

      const response = await api().post(`/api/pipelines/${pipeline.id}/cancel`);
      const cancelled = expectSuccess<PipelineSummary>(response, 200);
      expect(cancelled.status).toBe('cancelled');

      const replay = await collectSse(`/api/pipelines/${pipeline.id}/events`);
      expect(replay.events.map((event) => event.type)).toContain('pipeline_cancelled');
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
