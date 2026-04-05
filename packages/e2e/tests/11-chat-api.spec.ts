import { test, expect } from '@playwright/test';

import {
  API_BASE,
  apiDelete,
  apiGet,
  apiPost,
  cleanupTestData,
  seedMockRunner,
  seedProject,
  type ApiRecord
} from './helpers';

test.describe('Chat REST API', () => {
  let project: ApiRecord;
  let runner: ApiRecord;

  test.beforeAll(async () => {
    await cleanupTestData();
    project = await seedProject('Chat API Test Project');
    runner = await seedMockRunner();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('创建时 scopeId 不存在应返回 404', async () => {
    const response = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopeId: 'nonexistent-project-id',
        runnerId: runner.id,
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      })
    });

    expect(response.status).toBe(404);
  });

  test('创建时 runnerId 不存在应返回 404', async () => {
    const response = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopeId: project.id,
        runnerId: 'nonexistent-runner-id',
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      })
    });

    expect(response.status).toBe(404);
  });

  test('DTO 边界非法 payload 应返回 400', async () => {
    const response = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopeId: project.id,
        runnerId: runner.id,
        skillIds: [123],
        ruleIds: [],
        mcps: [{}],
        runnerSessionConfig: [],
        initialMessage: {
          input: 'not-an-object'
        }
      })
    });

    expect(response.status).toBe(400);
  });

  test('创建 chat 后应返回 session 映射与 runner 元数据', async () => {
    const chat = await apiPost('/chats', {
      scopeId: project.id,
      runnerId: runner.id,
      title: 'API Chat',
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    expect(chat.scopeId).toBe(project.id);
    expect(chat.sessionId).toBeTruthy();
    expect(chat.title).toBe('API Chat');
    expect(chat.runnerId).toBe(runner.id);
    expect(chat.runnerType).toBe('mock');
    expect(chat.status).toBeTruthy();

    await apiDelete(`/chats/${chat.id}`);
  });

  test('GET /chats?scopeId= 应只返回该 project 的 chats', async () => {
    const otherProject = await seedProject('Other Chat Project');

    const chatA = await apiPost('/chats', {
      scopeId: project.id,
      runnerId: runner.id,
      title: 'Project A Chat',
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });
    const chatB = await apiPost('/chats', {
      scopeId: otherProject.id,
      runnerId: runner.id,
      title: 'Project B Chat',
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const list = await apiGet(`/chats?scopeId=${project.id}`);
    const records = Array.isArray(list) ? list : [];
    const ids = records.map((chat) => chat.id);

    expect(ids).toContain(chatA.id);
    expect(ids).not.toContain(chatB.id);

    await apiDelete(`/chats/${chatA.id}`);
    await apiDelete(`/chats/${chatB.id}`);
    await apiDelete(`/projects/${otherProject.id}`);
  });

  test('GET /chats/:id 应返回 chat detail，PATCH 应更新标题', async () => {
    const chat = await apiPost('/chats', {
      scopeId: project.id,
      runnerId: runner.id,
      title: 'Original Title',
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    const detail = await apiGet(`/chats/${chat.id}`);
    expect(Array.isArray(detail)).toBe(false);
    if (!Array.isArray(detail)) {
      expect(detail.id).toBe(chat.id);
      expect(detail.sessionId).toBe(chat.sessionId);
      expect(detail.title).toBe('Original Title');
    }

    const updateResponse = await fetch(`${API_BASE}/chats/${chat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Renamed Title'
      })
    });
    expect(updateResponse.status).toBe(200);

    const updatedBody = (await updateResponse.json()) as {
      data: { title: string | null };
    };
    expect(updatedBody.data.title).toBe('Renamed Title');

    await apiDelete(`/chats/${chat.id}`);
  });

  test('DELETE /chats/:id 应删除 chat，并一并处置底层 session', async () => {
    const chat = await apiPost('/chats', {
      scopeId: project.id,
      runnerId: runner.id,
      title: 'Disposable Chat',
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });

    await apiDelete(`/chats/${chat.id}`);

    const chatResponse = await fetch(`${API_BASE}/chats/${chat.id}`);
    expect(chatResponse.status).toBe(404);

    const sessionResponse = await fetch(`${API_BASE}/sessions/${chat.sessionId}`);
    expect(sessionResponse.status).toBe(404);
  });
});
