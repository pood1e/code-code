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
      artifactKey: PipelineArtifactKey.Prd,
      attempt: 1,
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
});
