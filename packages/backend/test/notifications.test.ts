import 'reflect-metadata';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

import {
  setupTestApp,
  teardownTestApp,
  resetDatabase,
  getPrisma
} from './setup';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOPE_A = 'project_alpha';
const SCOPE_B = 'project_beta';
const CHANNEL_TYPE = 'mock';

// ─── Helper ───────────────────────────────────────────────────────────────────

function api() {
  return request(getApp().getHttpServer());
}

let _app: Awaited<ReturnType<typeof setupTestApp>>;
function getApp() {
  return _app;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  _app = await setupTestApp();
});
afterAll(() => teardownTestApp());
beforeEach(() => resetDatabase());

// ═══════════════════════════════════════════════════════════════════════════════
// Group 1: Channel CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('Channel CRUD', () => {
  it('T01 - creates a channel and returns it', async () => {
    const res = await api()
      .post('/api/notifications/channels')
      .send({
        scopeId: SCOPE_A,
        name: 'Session Alerts',
        channelType: CHANNEL_TYPE,
        config: {},
        filter: { eventTypes: ['session.completed'] }
      })
      .expect(201);

    const ch = res.body.data;
    expect(ch.id).toBeTruthy();
    expect(ch.scopeId).toBe(SCOPE_A);
    expect(ch.name).toBe('Session Alerts');
    expect(ch.channelType).toBe(CHANNEL_TYPE);
    expect(ch.enabled).toBe(true);
    expect(ch.filter.eventTypes).toEqual(['session.completed']);
  });

  it('T02 - lists channels filtered by scopeId', async () => {
    // Create one in scope A and one in scope B
    await api()
      .post('/api/notifications/channels')
      .send({ scopeId: SCOPE_A, name: 'A', channelType: CHANNEL_TYPE, filter: { eventTypes: ['*'] } })
      .expect(201);
    await api()
      .post('/api/notifications/channels')
      .send({ scopeId: SCOPE_B, name: 'B', channelType: CHANNEL_TYPE, filter: { eventTypes: ['*'] } })
      .expect(201);

    const res = await api()
      .get('/api/notifications/channels')
      .query({ scopeId: SCOPE_A })
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('A');
  });

  it('T03 - rejects duplicate name within same scope → 409', async () => {
    const body = { scopeId: SCOPE_A, name: 'Dup', channelType: CHANNEL_TYPE, filter: { eventTypes: ['session.*'] } };
    await api().post('/api/notifications/channels').send(body).expect(201);
    await api().post('/api/notifications/channels').send(body).expect(409);
  });

  it('T04 - allows same name in different scopes', async () => {
    const nameBody = (scope: string) => ({
      scopeId: scope,
      name: 'SharedName',
      channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['session.completed'] }
    });
    await api().post('/api/notifications/channels').send(nameBody(SCOPE_A)).expect(201);
    await api().post('/api/notifications/channels').send(nameBody(SCOPE_B)).expect(201);
  });

  it('T05 - updates a channel (enable/disable)', async () => {
    const createRes = await api()
      .post('/api/notifications/channels')
      .send({ scopeId: SCOPE_A, name: 'Toggle', channelType: CHANNEL_TYPE, filter: { eventTypes: ['x'] } })
      .expect(201);

    const id = createRes.body.data.id as string;
    const patchRes = await api()
      .patch(`/api/notifications/channels/${id}`)
      .send({ enabled: false })
      .expect(200);

    expect(patchRes.body.data.enabled).toBe(false);
  });

  it('T06 - deletes a channel with no active tasks', async () => {
    const createRes = await api()
      .post('/api/notifications/channels')
      .send({ scopeId: SCOPE_A, name: 'DeleteMe', channelType: CHANNEL_TYPE, filter: { eventTypes: ['x'] } })
      .expect(201);

    const id = createRes.body.data.id as string;
    await api().delete(`/api/notifications/channels/${id}`).expect(200);

    await api().get(`/api/notifications/channels/${id}`).expect(404);
  });

  it('T07 - GET /channel-types returns registered types array', async () => {
    const res = await api().get('/api/notifications/channel-types').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Group 2: Filter matching via /receive
// ═══════════════════════════════════════════════════════════════════════════════

describe('Filter matching via /receive', () => {
  async function createChannel(filter: object, name = 'TestChannel') {
    const res = await api()
      .post('/api/notifications/channels')
      .send({ scopeId: SCOPE_A, name, channelType: CHANNEL_TYPE, filter })
      .expect(201);
    return res.body.data.id as string;
  }

  async function receiveEvent(eventType: string, payload: object = {}) {
    const res = await api()
      .post('/api/notifications/receive')
      .send({ scopeId: SCOPE_A, eventType, payload })
      .expect(201);
    return res.body.data.eventId as string;
  }

  async function getTasksForEvent(eventId: string) {
    const res = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: SCOPE_A, eventId })
      .expect(200);
    return res.body.data as Array<{ channelId: string; status: string }>;
  }

  it('T08 - exact eventType match creates task', async () => {
    const chId = await createChannel({ eventTypes: ['session.completed'] });
    const eventId = await receiveEvent('session.completed');

    const tasks = await getTasksForEvent(eventId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].channelId).toBe(chId);
  });

  it('T09 - wildcard session.* matches session.failed', async () => {
    await createChannel({ eventTypes: ['session.*'] });
    const eventId = await receiveEvent('session.failed');

    const tasks = await getTasksForEvent(eventId);
    expect(tasks).toHaveLength(1);
  });

  it('T10 - session.* does NOT match order.created', async () => {
    await createChannel({ eventTypes: ['session.*'] });
    const eventId = await receiveEvent('order.created');

    const tasks = await getTasksForEvent(eventId);
    expect(tasks).toHaveLength(0);
  });

  it('T11 - multiple eventTypes as OR: either matches', async () => {
    await createChannel({ eventTypes: ['session.completed', 'session.failed'] });

    const eventId1 = await receiveEvent('session.completed');
    const eventId2 = await receiveEvent('session.failed');

    expect(await getTasksForEvent(eventId1)).toHaveLength(1);
    expect(await getTasksForEvent(eventId2)).toHaveLength(1);
  });

  it('T12 - In operator: field value in set → matches', async () => {
    await createChannel({
      eventTypes: ['session.*'],
      conditions: [{ field: 'severity', operator: 'In', values: ['critical', 'high'] }]
    });

    const matchId = await receiveEvent('session.failed', { severity: 'critical' });
    const noMatchId = await receiveEvent('session.failed', { severity: 'low' });

    expect(await getTasksForEvent(matchId)).toHaveLength(1);
    expect(await getTasksForEvent(noMatchId)).toHaveLength(0);
  });

  it('T13 - NotIn operator: field excluded by list → no match', async () => {
    await createChannel({
      eventTypes: ['session.*'],
      conditions: [{ field: 'env', operator: 'NotIn', values: ['test', 'staging'] }]
    });

    const matchId = await receiveEvent('session.completed', { env: 'production' });
    const noMatchId = await receiveEvent('session.completed', { env: 'test' });

    expect(await getTasksForEvent(matchId)).toHaveLength(1);
    expect(await getTasksForEvent(noMatchId)).toHaveLength(0);
  });

  it('T14 - Exists operator: field present → matches; absent → no match', async () => {
    await createChannel({
      eventTypes: ['session.*'],
      conditions: [{ field: 'errorCode', operator: 'Exists' }]
    });

    const matchId = await receiveEvent('session.failed', { errorCode: 'E001' });
    const noMatchId = await receiveEvent('session.failed', { other: 'data' });

    expect(await getTasksForEvent(matchId)).toHaveLength(1);
    expect(await getTasksForEvent(noMatchId)).toHaveLength(0);
  });

  it('T15 - Prefix operator: field starts with prefix → matches', async () => {
    await createChannel({
      eventTypes: ['session.*'],
      conditions: [{ field: 'source', operator: 'Prefix', values: ['agent-'] }]
    });

    const matchId = await receiveEvent('session.completed', { source: 'agent-001' });
    const noMatchId = await receiveEvent('session.completed', { source: 'runner-001' });

    expect(await getTasksForEvent(matchId)).toHaveLength(1);
    expect(await getTasksForEvent(noMatchId)).toHaveLength(0);
  });

  it('T16 - multiple conditions AND logic: all must match', async () => {
    await createChannel({
      eventTypes: ['session.*'],
      conditions: [
        { field: 'severity', operator: 'In', values: ['critical'] },
        { field: 'env', operator: 'NotIn', values: ['test'] }
      ]
    });

    const matchId = await receiveEvent('session.failed', { severity: 'critical', env: 'production' });
    const partial1 = await receiveEvent('session.failed', { severity: 'low', env: 'production' });
    const partial2 = await receiveEvent('session.failed', { severity: 'critical', env: 'test' });

    expect(await getTasksForEvent(matchId)).toHaveLength(1);
    expect(await getTasksForEvent(partial1)).toHaveLength(0);
    expect(await getTasksForEvent(partial2)).toHaveLength(0);
  });

  it('T17 - disabled channel does not generate tasks', async () => {
    const chId = await createChannel({ eventTypes: ['session.completed'] });
    await api().patch(`/api/notifications/channels/${chId}`).send({ enabled: false });

    const eventId = await receiveEvent('session.completed');
    const tasks = await getTasksForEvent(eventId);
    expect(tasks).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Group 3: Scope isolation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scope isolation', () => {
  it('T18 - channels in different scopes do not interfere on receive', async () => {
    // Scope A channel: session.completed
    await api().post('/api/notifications/channels').send({
      scopeId: SCOPE_A,
      name: 'Alpha Channel',
      channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['session.completed'] }
    }).expect(201);

    // Send to scope B — should NOT create tasks for scope A channel
    const res = await api().post('/api/notifications/receive').send({
      scopeId: SCOPE_B,
      eventType: 'session.completed',
      payload: {}
    }).expect(201);

    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: SCOPE_A, eventId: res.body.data.eventId })
      .expect(200);

    expect(tasks.body.data).toHaveLength(0);
  });

  it('T19 - listTasks with scopeId filter returns only that scope', async () => {
    // Create channel and receive event in each scope
    for (const scope of [SCOPE_A, SCOPE_B]) {
      await api().post('/api/notifications/channels').send({
        scopeId: scope,
        name: 'Ch',
        channelType: CHANNEL_TYPE,
        filter: { eventTypes: ['ping'] }
      }).expect(201);
      await api().post('/api/notifications/receive').send({ scopeId: scope, eventType: 'ping', payload: {} }).expect(201);
    }

    const resA = await api().get('/api/notifications/tasks').query({ scopeId: SCOPE_A }).expect(200);
    const resB = await api().get('/api/notifications/tasks').query({ scopeId: SCOPE_B }).expect(200);

    expect(resA.body.data.every((t: { scopeId: string }) => t.scopeId === SCOPE_A)).toBe(true);
    expect(resB.body.data.every((t: { scopeId: string }) => t.scopeId === SCOPE_B)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Group 4: Sending history (listTasks by channelId)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Sending history by channelId', () => {
  it('T20 - listTasks?channelId= returns only that channel tasks', async () => {
    const chARes = await api().post('/api/notifications/channels').send({
      scopeId: SCOPE_A, name: 'ChA', channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['ping'] }
    }).expect(201);
    const chBRes = await api().post('/api/notifications/channels').send({
      scopeId: SCOPE_A, name: 'ChB', channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['pong'] }
    }).expect(201);

    await api().post('/api/notifications/receive').send({ scopeId: SCOPE_A, eventType: 'ping', payload: {} }).expect(201);
    await api().post('/api/notifications/receive').send({ scopeId: SCOPE_A, eventType: 'pong', payload: {} }).expect(201);

    const resA = await api().get('/api/notifications/tasks').query({ channelId: chARes.body.data.id }).expect(200);
    const resB = await api().get('/api/notifications/tasks').query({ channelId: chBRes.body.data.id }).expect(200);

    expect(resA.body.data).toHaveLength(1);
    expect(resB.body.data).toHaveLength(1);
    expect(resA.body.data[0].channelId).toBe(chARes.body.data.id);
  });

  it('T21 - task includes channelName in response', async () => {
    await api().post('/api/notifications/channels').send({
      scopeId: SCOPE_A, name: 'Named Channel', channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['ping'] }
    }).expect(201);

    await api().post('/api/notifications/receive').send({ scopeId: SCOPE_A, eventType: 'ping', payload: {} }).expect(201);

    const res = await api().get('/api/notifications/tasks').query({ scopeId: SCOPE_A }).expect(200);
    expect(res.body.data[0].channelName).toBe('Named Channel');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Group 5: Dispatcher + retry
// ═══════════════════════════════════════════════════════════════════════════════

import { NotificationDispatcherService } from '../src/modules/notifications/notification-dispatcher.service';
import { NotificationChannelRegistry } from '../src/modules/notifications/notification-channel-registry';

describe('Dispatcher and task processing', () => {
  it('T22 - pollOnce returns false when no pending tasks', async () => {
    const dispatcher = getApp().get(NotificationDispatcherService);
    const claimed = await dispatcher.pollOnce();
    expect(claimed).toBe(false);
  });

  it('T23 - creates task via receive; pollOnce returns true', async () => {
    // Create a channel and send event to get a task
    await api().post('/api/notifications/channels').send({
      scopeId: SCOPE_A, name: 'Dispatch Ch', channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['dispatch.test'] }
    }).expect(201);

    await api().post('/api/notifications/receive').send({
      scopeId: SCOPE_A, eventType: 'dispatch.test', payload: {}
    }).expect(201);

    const dispatcher = getApp().get(NotificationDispatcherService);
    const claimed = await dispatcher.pollOnce();
    expect(claimed).toBe(true);
  });

  it('T24 - channelRegistry.registeredChannelTypes returns array', () => {
    const registry = getApp().get(NotificationChannelRegistry);
    expect(Array.isArray(registry.registeredChannelTypes())).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Group 6: Task retry endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task retry', () => {
  it('T25 - cannot retry a non-failed task → 409', async () => {
    // Create a pending task via receive
    await api().post('/api/notifications/channels').send({
      scopeId: SCOPE_A, name: 'Retry Ch', channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['retry.test'] }
    }).expect(201);

    await api().post('/api/notifications/receive').send({
      scopeId: SCOPE_A, eventType: 'retry.test', payload: {}
    }).expect(201);

    const tasksRes = await api().get('/api/notifications/tasks').query({ scopeId: SCOPE_A }).expect(200);
    const taskId = tasksRes.body.data[0].id as string;

    // Pending task cannot be retried
    await api().post(`/api/notifications/tasks/${taskId}/retry`).expect(409);
  });

  it('T26 - 404 when retrying non-existent task', async () => {
    await api().post('/api/notifications/tasks/nonexistent/retry').expect(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Group 7: Channel deletion guard
// ═══════════════════════════════════════════════════════════════════════════════

describe('Channel deletion guard', () => {
  it('T27 - cannot delete channel with pending tasks → 409', async () => {
    const chRes = await api().post('/api/notifications/channels').send({
      scopeId: SCOPE_A, name: 'Guard Ch', channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['guard.test'] }
    }).expect(201);
    const chId = chRes.body.data.id as string;

    // Create a pending task
    await api().post('/api/notifications/receive').send({
      scopeId: SCOPE_A, eventType: 'guard.test', payload: {}
    }).expect(201);

    await api().delete(`/api/notifications/channels/${chId}`).expect(409);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Group 8: Maintenance (timeout reset + cleanup) — fake timers
// ═══════════════════════════════════════════════════════════════════════════════

import { NotificationMaintenanceService } from '../src/modules/notifications/notification-maintenance.service';
import { NotificationRepositoryService } from '../src/modules/notifications/notification-repository.service';
import { NotificationTaskStatus } from '@agent-workbench/shared';

describe('Maintenance service', () => {
  it('T28 - resetTimedOutTasks resets stale processing tasks', async () => {
    // Create a channel and task first
    await api().post('/api/notifications/channels').send({
      scopeId: SCOPE_A, name: 'Maint Ch', channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['maint.test'] }
    }).expect(201);
    await api().post('/api/notifications/receive').send({
      scopeId: SCOPE_A, eventType: 'maint.test', payload: {}
    }).expect(201);

    // Claim the task
    const repo = getApp().get(NotificationRepositoryService);
    const claimed = await repo.claimPendingTask();
    expect(claimed).not.toBeNull();
    expect(claimed!.status).toBe(NotificationTaskStatus.Processing);

    // Manually set updatedAt far in past to simulate timeout
    const prisma = getPrisma();
    await prisma.notificationTask.update({
      where: { id: claimed!.id },
      data: { updatedAt: new Date(Date.now() - 20 * 60 * 1000) } // 20 minutes ago
    });

    const resetCount = await repo.resetTimedOutTasks(10);
    expect(resetCount).toBe(1);

    const task = await prisma.notificationTask.findUnique({ where: { id: claimed!.id } });
    expect(task!.status).toBe(NotificationTaskStatus.Pending);
  });

  it('T29 - cleanupOldTasks removes completed tasks beyond retention', async () => {
    const repo = getApp().get(NotificationRepositoryService);
    const prisma = getPrisma();

    // Create a channel and task
    await api().post('/api/notifications/channels').send({
      scopeId: SCOPE_A, name: 'Cleanup Ch', channelType: CHANNEL_TYPE,
      filter: { eventTypes: ['cleanup.test'] }
    }).expect(201);
    await api().post('/api/notifications/receive').send({
      scopeId: SCOPE_A, eventType: 'cleanup.test', payload: {}
    }).expect(201);

    const tasks = await repo.listTasks({ scopeId: SCOPE_A });
    const taskId = tasks[0].id;

    // Mark as success and set old createdAt
    await prisma.notificationTask.update({
      where: { id: taskId },
      data: {
        status: NotificationTaskStatus.Success,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
      }
    });

    const deletedCount = await repo.cleanupOldTasks(7);
    expect(deletedCount).toBe(1);

    const remaining = await repo.listTasks({ scopeId: SCOPE_A });
    expect(remaining).toHaveLength(0);
  });
});
