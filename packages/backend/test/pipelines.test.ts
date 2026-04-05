import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PipelineArtifactKey } from '@agent-workbench/shared';

import { PipelinesService } from '../src/modules/pipelines/pipelines.service';
import { getApp, resetDatabase, setupTestApp, teardownTestApp } from './setup';
import {
  api,
  expectError,
  expectSuccess,
  seedProject
} from './helpers';

describe('Pipelines API', () => {
  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function createPipeline(scopeId: string, name: string) {
    const response = await api()
      .post('/api/pipelines')
      .send({
        scopeId,
        name
      });

    return expectSuccess<{ id: string; scopeId: string; name: string }>(
      response,
      201
    );
  }

  async function createArtifact(
    pipelineId: string,
    name: string,
    content: string
  ) {
    const pipelinesService = getApp().get(PipelinesService);

    return pipelinesService.createArtifact(pipelineId, {
      name,
      contentType: 'text/plain',
      content
    });
  }

  it('应返回当前 pipeline 下 artifact 的原始内容', async () => {
    const project = await seedProject();
    const pipeline = await createPipeline(project.id, '文档流水线');
    const artifact = await createArtifact(
      pipeline.id,
      'summary.txt',
      'artifact-content'
    );

    const response = await api()
      .get(`/api/pipelines/${pipeline.id}/artifacts/${artifact.id}/content`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toBe('artifact-content');
  });

  it('artifact 不存在时应返回 404', async () => {
    const project = await seedProject();
    const pipeline = await createPipeline(project.id, '空流水线');

    expectError(
      await api().get(
        `/api/pipelines/${pipeline.id}/artifacts/nonexistent-artifact/content`
      ),
      404
    );
  });

  it('artifact 与 pipeline 不匹配时应返回 404', async () => {
    const project = await seedProject();
    const pipelineA = await createPipeline(project.id, '流水线 A');
    const pipelineB = await createPipeline(project.id, '流水线 B');
    const artifact = await createArtifact(
      pipelineA.id,
      'cross-scope.txt',
      'should-not-leak'
    );

    expectError(
      await api().get(
        `/api/pipelines/${pipelineB.id}/artifacts/${artifact.id}/content`
      ),
      404
    );
  });

  it('并发写入同一 artifactKey 时应分配唯一且单调的 version', async () => {
    const project = await seedProject();
    const pipeline = await createPipeline(project.id, '版本化流水线');
    const pipelinesService = getApp().get(PipelinesService);

    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        pipelinesService.createManagedArtifact(pipeline.id, {
          artifactKey: PipelineArtifactKey.Prd,
          attempt: index + 1,
          name: 'prd.json',
          contentType: 'application/json',
          content: JSON.stringify({ version: index + 1 })
        })
      )
    );

    const prdArtifacts = await waitForPrdArtifacts(pipeline.id);

    expect(prdArtifacts).toHaveLength(6);
    expect(prdArtifacts.map((artifact) => artifact.metadata?.version)).toEqual([
      6,
      5,
      4,
      3,
      2,
      1
    ]);
    expect(new Set(prdArtifacts.map((artifact) => artifact.metadata?.version)).size).toBe(
      6
    );
  });

  it('同名多版本 artifact 下载内容应保持各自历史版本，不得被后续版本覆盖', async () => {
    const project = await seedProject();
    const pipeline = await createPipeline(project.id, '多版本内容流水线');
    const pipelinesService = getApp().get(PipelinesService);

    await pipelinesService.createManagedArtifact(pipeline.id, {
      artifactKey: PipelineArtifactKey.Prd,
      attempt: 1,
      name: 'prd.json',
      contentType: 'application/json',
      content: JSON.stringify({ version: 1, body: 'first' })
    });
    await pipelinesService.createManagedArtifact(pipeline.id, {
      artifactKey: PipelineArtifactKey.Prd,
      attempt: 2,
      name: 'prd.json',
      contentType: 'application/json',
      content: JSON.stringify({ version: 2, body: 'second' })
    });

    const artifacts = await waitForArtifactCount(pipeline.id, PipelineArtifactKey.Prd, 2);
    const [latestArtifact, previousArtifact] = artifacts;

    const latestResponse = await api()
      .get(`/api/pipelines/${pipeline.id}/artifacts/${latestArtifact.id}/content`)
      .expect(200);
    const previousResponse = await api()
      .get(`/api/pipelines/${pipeline.id}/artifacts/${previousArtifact.id}/content`)
      .expect(200);

    expect(JSON.parse(latestResponse.text)).toEqual({
      version: 2,
      body: 'second'
    });
    expect(JSON.parse(previousResponse.text)).toEqual({
      version: 1,
      body: 'first'
    });
  });
});

async function waitForPrdArtifacts(pipelineId: string, timeoutMs = 5_000) {
  return waitForArtifactCount(pipelineId, PipelineArtifactKey.Prd, 6, timeoutMs);
}

async function waitForArtifactCount(
  pipelineId: string,
  artifactKey: PipelineArtifactKey,
  expectedCount: number,
  timeoutMs = 5_000
) {
  const pipelinesService = getApp().get(PipelinesService);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const detail = await pipelinesService.getDetail(pipelineId);
    const artifacts = detail.artifacts.filter(
      (artifact) => artifact.metadata?.artifactKey === artifactKey
    );

    if (artifacts.length === expectedCount) {
      return artifacts;
    }

    await sleep(50);
  }

  const detail = await pipelinesService.getDetail(pipelineId);
  return detail.artifacts.filter(
    (artifact) => artifact.metadata?.artifactKey === artifactKey
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
