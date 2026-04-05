import 'reflect-metadata';

import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { z } from 'zod';

import { NotificationTaskStatus } from '@agent-workbench/shared';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: vi.fn()
}));

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn()
}));

vi.mock('node-notifier', () => ({
  default: {
    notify: notifyMock
  }
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();

  return {
    ...actual,
    execFile: execFileMock
  };
});

import { NotificationDispatcherService } from '../src/modules/notifications/notification-dispatcher.service';
import { NotificationMaintenanceService } from '../src/modules/notifications/notification-maintenance.service';
import { NotificationCapabilityRegistry } from '../src/modules/notifications/notification-capability.registry';
import { NotificationRepositoryService } from '../src/modules/notifications/notification-repository.service';
import {
  getPrisma,
  resetDatabase,
  setupTestApp,
  teardownTestApp
} from './setup';

const PROJECT_A = 'project_alpha';
const PROJECT_B = 'project_beta';
const LOCAL_CAPABILITY_ID = 'local-notification';

function api() {
  return request(getApp().getHttpServer());
}

let app: Awaited<ReturnType<typeof setupTestApp>>;
function getApp() {
  return app;
}

async function createProject(id: string) {
  return getPrisma().project.create({
    data: {
      id,
      name: `Project ${id}`,
      gitUrl: `git@github.com:example/${id}.git`,
      workspacePath: `/tmp/${id}`
    }
  });
}

async function seedProjects() {
  await createProject(PROJECT_A);
  await createProject(PROJECT_B);
}

function createChannel(overrides?: Record<string, unknown>) {
  return api()
    .post('/api/notifications/channels')
    .send({
      scopeId: PROJECT_A,
      name: '本地通知',
      capabilityId: LOCAL_CAPABILITY_ID,
      filter: { messageTypes: ['session.*'] },
      enabled: true,
      ...overrides
    });
}

function receiveMessage(overrides?: Record<string, unknown>) {
  return api()
    .post('/api/notifications/receive')
    .send({
      scopeId: PROJECT_A,
      type: 'session.completed',
      title: '会话执行完成',
      body: 'Project Agent Workbench 的会话已完成。',
      severity: 'success',
      metadata: { severity: 'high', env: 'production' },
      ...overrides
    });
}

function mockNotifySuccess() {
  notifyMock.mockImplementation(
    (
      _options: Record<string, unknown>,
      callback?: (error: Error | null) => void
    ) => {
      callback?.(null);
    }
  );

  execFileMock.mockImplementation(
    (
      _file: string,
      _args: readonly string[],
      callback?: (error: Error | null) => void
    ) => {
      callback?.(null);
    }
  );
}

function mockNotifyFailure(message = 'notify failed') {
  notifyMock.mockImplementation(
    (
      _options: Record<string, unknown>,
      callback?: (error: Error | null) => void
    ) => {
      callback?.(new Error(message));
    }
  );

  execFileMock.mockImplementation(
    (
      _file: string,
      _args: readonly string[],
      callback?: (error: Error | null) => void
    ) => {
      callback?.(new Error(message));
    }
  );
}

function expectLocalNotificationSent() {
  if (process.platform === 'darwin') {
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).not.toHaveBeenCalled();
    return;
  }

  expect(notifyMock).toHaveBeenCalledTimes(1);
  expect(execFileMock).not.toHaveBeenCalled();
}

async function waitForTaskStatus(
  taskId: string,
  expectedStatus: NotificationTaskStatus
) {
  const repository = getApp().get(NotificationRepositoryService);

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const task = await repository.findTaskById(taskId);
    if (task.status === expectedStatus) {
      return task;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const latest = await repository.findTaskById(taskId);
  throw new Error(
    `Timed out waiting for task ${taskId} to reach ${expectedStatus}. Current status: ${latest.status}`
  );
}

beforeAll(async () => {
  app = await setupTestApp();
});

afterAll(async () => {
  await teardownTestApp();
});

beforeEach(async () => {
  notifyMock.mockReset();
  execFileMock.mockReset();
  mockNotifySuccess();
  await resetDatabase();
  await seedProjects();
});

describe('Notification capabilities', () => {
  it('列出已注册的通知能力', async () => {
    const response = await api().get('/api/notifications/capabilities').expect(200);

    expect(response.body.data).toEqual([
      {
        id: LOCAL_CAPABILITY_ID,
        name: '本地通知',
        description: '通过宿主机系统通知中心发送本地通知。',
        configSchema: { fields: [] }
      }
    ]);
  });

  it('能力 registry 可发现本地通知插件', () => {
    const registry = getApp().get(NotificationCapabilityRegistry);

    expect(registry.has(LOCAL_CAPABILITY_ID)).toBe(true);
    expect(registry.getAllResponses()).toHaveLength(1);
  });
});

describe('Channel CRUD', () => {
  it('创建通道并返回 capabilityId 与过滤器', async () => {
    const response = await createChannel().expect(201);

    expect(response.body.data.scopeId).toBe(PROJECT_A);
    expect(response.body.data.capabilityId).toBe(LOCAL_CAPABILITY_ID);
    expect(response.body.data.filter.messageTypes).toEqual(['session.*']);
    expect(response.body.data.enabled).toBe(true);
  });

  it('拒绝为不存在的项目创建通道', async () => {
    await api()
      .post('/api/notifications/channels')
      .send({
        scopeId: 'missing-project',
        name: '无效通道',
        capabilityId: LOCAL_CAPABILITY_ID,
        filter: { messageTypes: ['session.*'] }
      })
      .expect(404);
  });

  it('拒绝创建未注册能力的通道', async () => {
    await api()
      .post('/api/notifications/channels')
      .send({
        scopeId: PROJECT_A,
        name: '无效能力',
        capabilityId: 'slack',
        filter: { messageTypes: ['session.*'] }
      })
      .expect(400);
  });

  it('按能力 schema 校验配置', async () => {
    const registry = getApp().get(NotificationCapabilityRegistry);
    registry.register({
      id: 'webhook-test',
      name: 'Webhook Test',
      description: '需要 endpoint 的测试能力',
      configSchema: z.object({
        endpoint: z.url()
      }),
      mapMessage: () => ({ payload: 'ok' }),
      send: async () => {}
    });

    await api()
      .post('/api/notifications/channels')
      .send({
        scopeId: PROJECT_A,
        name: 'Webhook 非法配置',
        capabilityId: 'webhook-test',
        config: {},
        filter: { messageTypes: ['session.*'] }
      })
      .expect(400);

    await api()
      .post('/api/notifications/channels')
      .send({
        scopeId: PROJECT_A,
        name: 'Webhook 合法配置',
        capabilityId: 'webhook-test',
        config: {
          endpoint: 'https://example.com/hook'
        },
        filter: { messageTypes: ['session.*'] }
      })
      .expect(201);
  });

  it('同项目下重名通道返回 409', async () => {
    await createChannel({ name: '重复名称' }).expect(201);
    await createChannel({ name: '重复名称' }).expect(409);
  });

  it('不同项目允许同名通道', async () => {
    await createChannel({ name: '共享名称' }).expect(201);

    await api()
      .post('/api/notifications/channels')
      .send({
        scopeId: PROJECT_B,
        name: '共享名称',
        capabilityId: LOCAL_CAPABILITY_ID,
        filter: { messageTypes: ['session.*'] }
      })
      .expect(201);
  });

  it('更新通道重名冲突时返回 409', async () => {
    const first = await createChannel({ name: '通道 A' }).expect(201);
    await createChannel({ name: '通道 B' }).expect(201);

    await api()
      .patch(`/api/notifications/channels/${first.body.data.id}`)
      .send({ name: '通道 B' })
      .expect(409);
  });

  it('空 PATCH payload 返回 400', async () => {
    const channel = await createChannel().expect(201);

    await api()
      .patch(`/api/notifications/channels/${channel.body.data.id}`)
      .send({})
      .expect(400);
  });

  it('非法 matcher 组合返回 400', async () => {
    await api()
      .post('/api/notifications/channels')
      .send({
        scopeId: PROJECT_A,
        name: '非法过滤器',
        capabilityId: LOCAL_CAPABILITY_ID,
        filter: {
          messageTypes: ['session.*'],
          conditions: [
            {
              field: 'severity',
              operator: 'Exists',
              values: ['high']
            }
          ]
        }
      })
      .expect(400);
  });
});

describe('Structured message receive and filtering', () => {
  it('接收结构化消息后为匹配通道创建任务', async () => {
    const channel = await createChannel({
      filter: {
        messageTypes: ['session.completed']
      }
    }).expect(201);

    const receiveResponse = await receiveMessage().expect(200);

    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: receiveResponse.body.data.messageId })
      .expect(200);

    expect(receiveResponse.body.data.createdTaskCount).toBe(1);
    expect(tasks.body.data).toHaveLength(1);
    expect(tasks.body.data[0].channelId).toBe(channel.body.data.id);
    expect(tasks.body.data[0].messageType).toBe('session.completed');
    expect(tasks.body.data[0].messageTitle).toBe('会话执行完成');
  });

  it('通道改名后，历史任务仍展示创建时的通道名快照', async () => {
    const channel = await createChannel({ name: '旧通道名' }).expect(201);
    const receiveResponse = await receiveMessage().expect(200);

    await api()
      .patch(`/api/notifications/channels/${channel.body.data.id}`)
      .send({ name: '新通道名' })
      .expect(200);

    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: receiveResponse.body.data.messageId })
      .expect(200);

    expect(tasks.body.data).toHaveLength(1);
    expect(tasks.body.data[0].channelName).toBe('旧通道名');
    expect(tasks.body.data[0].channelDeleted).toBe(false);
  });

  it('按 metadata 条件匹配消息', async () => {
    await createChannel({
      filter: {
        messageTypes: ['session.*'],
        conditions: [
          { field: 'severity', operator: 'In', values: ['critical', 'high'] },
          { field: 'env', operator: 'NotIn', values: ['test'] }
        ]
      }
    }).expect(201);

    const matched = await receiveMessage().expect(200);
    const filteredOut = await receiveMessage({
      metadata: { severity: 'low', env: 'production' }
    }).expect(200);

    const matchedTasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: matched.body.data.messageId })
      .expect(200);
    const filteredOutTasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: filteredOut.body.data.messageId })
      .expect(200);

    expect(matchedTasks.body.data).toHaveLength(1);
    expect(filteredOutTasks.body.data).toHaveLength(0);
  });

  it('禁用通道不会创建任务', async () => {
    const channel = await createChannel().expect(201);

    await api()
      .patch(`/api/notifications/channels/${channel.body.data.id}`)
      .send({ enabled: false })
      .expect(200);

    const receiveResponse = await receiveMessage().expect(200);
    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: receiveResponse.body.data.messageId })
      .expect(200);

    expect(tasks.body.data).toHaveLength(0);
  });

  it('不存在项目时拒绝接收消息', async () => {
    await api()
      .post('/api/notifications/receive')
      .send({
        scopeId: 'missing-project',
        type: 'session.completed',
        title: 'Missing Project',
        body: 'This should fail.'
      })
      .expect(404);
  });
});

describe('Dispatcher and retry', () => {
  it('pollOnce 成功发送任务并标记 success', async () => {
    await createChannel().expect(201);
    const receiveResponse = await receiveMessage().expect(200);

    const dispatcher = getApp().get(NotificationDispatcherService);
    const claimed = await dispatcher.pollOnce();

    expect(claimed).toBe(true);

    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: receiveResponse.body.data.messageId })
      .expect(200);

    const settledTask = await waitForTaskStatus(
      tasks.body.data[0].id,
      NotificationTaskStatus.Success
    );

    expect(settledTask.status).toBe(NotificationTaskStatus.Success);
    expect(tasks.body.data[0].channelName).toBe('本地通知');
    expectLocalNotificationSent();
  });

  it('mapMessage 抛错时任务会立即标记为 failed', async () => {
    await createChannel().expect(201);
    await receiveMessage().expect(200);

    const registry = getApp().get(NotificationCapabilityRegistry);
    const capability = registry.get(LOCAL_CAPABILITY_ID);
    expect(capability).toBeDefined();

    const mapMessageSpy = vi
      .spyOn(capability!, 'mapMessage')
      .mockImplementation(async () => {
        throw new Error('message mapping failed');
      });

    const dispatcher = getApp().get(NotificationDispatcherService);
    await dispatcher.pollOnce();

    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A })
      .expect(200);

    const settledTask = await waitForTaskStatus(
      tasks.body.data[0].id,
      NotificationTaskStatus.Failed
    );

    expect(settledTask.lastError).toContain('message mapping failed');

    mapMessageSpy.mockRestore();
  });

  it('发送失败后任务标记为 failed，并允许 retry', async () => {
    await createChannel().expect(201);
    mockNotifyFailure('system notification unavailable');

    const receiveResponse = await receiveMessage().expect(200);
    const dispatcher = getApp().get(NotificationDispatcherService);
    await dispatcher.pollOnce();

    const failedTasksResponse = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: receiveResponse.body.data.messageId })
      .expect(200);
    const failedTask = failedTasksResponse.body.data[0];

    const settledFailedTask = await waitForTaskStatus(
      failedTask.id,
      NotificationTaskStatus.Failed
    );

    expect(settledFailedTask.status).toBe(NotificationTaskStatus.Failed);
    expect(settledFailedTask.lastError).toContain('system notification unavailable');

    mockNotifySuccess();

    await api()
      .post(`/api/notifications/tasks/${failedTask.id}/retry`)
      .expect(200);

    await dispatcher.pollOnce();

    const retriedTasksResponse = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: receiveResponse.body.data.messageId })
      .expect(200);

    const retriedTask = await waitForTaskStatus(
      retriedTasksResponse.body.data[0].id,
      NotificationTaskStatus.Success
    );

    expect(retriedTask.status).toBe(NotificationTaskStatus.Success);
  });

  it('已删除通道的 failed 历史任务不能 retry', async () => {
    const channel = await createChannel().expect(201);
    mockNotifyFailure('system notification unavailable');

    await receiveMessage().expect(200);
    const dispatcher = getApp().get(NotificationDispatcherService);
    await dispatcher.pollOnce();

    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A })
      .expect(200);

    const failedTask = await waitForTaskStatus(
      tasks.body.data[0].id,
      NotificationTaskStatus.Failed
    );

    await api()
      .delete(`/api/notifications/channels/${channel.body.data.id}`)
      .expect(200);

    await api()
      .post(`/api/notifications/tasks/${failedTask.id}/retry`)
      .expect(409);
  });

  it('retry 非 failed 任务返回 409', async () => {
    await createChannel().expect(201);
    await receiveMessage().expect(200);

    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A })
      .expect(200);

    await api()
      .post(`/api/notifications/tasks/${tasks.body.data[0].id}/retry`)
      .expect(409);
  });
});

describe('Deletion guard and maintenance', () => {
  it('有 active task 时不能删除通道', async () => {
    const channel = await createChannel().expect(201);
    await receiveMessage().expect(200);

    await api()
      .delete(`/api/notifications/channels/${channel.body.data.id}`)
      .expect(409);
  });

  it('只有历史任务时允许删除通道，且任务记录保留', async () => {
    const channel = await createChannel().expect(201);
    await receiveMessage().expect(200);

    const dispatcher = getApp().get(NotificationDispatcherService);
    await dispatcher.pollOnce();

    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A })
      .expect(200);

    await waitForTaskStatus(tasks.body.data[0].id, NotificationTaskStatus.Success);

    await api()
      .delete(`/api/notifications/channels/${channel.body.data.id}`)
      .expect(200);

    const remainingTasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A })
      .expect(200);

    expect(remainingTasks.body.data).toHaveLength(1);
    expect(remainingTasks.body.data[0].channelId).toBeNull();
    expect(remainingTasks.body.data[0].channelDeleted).toBe(true);
    expect(remainingTasks.body.data[0].channelName).toBe('本地通知');
  });

  it('resetTimedOutTasks 会重置过期 processing 任务', async () => {
    await createChannel().expect(201);
    await receiveMessage().expect(200);

    const repository = getApp().get(NotificationRepositoryService);
    const claimed = await repository.claimPendingTask();

    expect(claimed?.status).toBe(NotificationTaskStatus.Processing);

    await getPrisma().notificationTask.update({
      where: { id: claimed!.id },
      data: {
        updatedAt: new Date(Date.now() - 20 * 60 * 1000)
      }
    });

    const maintenance = getApp().get(NotificationMaintenanceService);
    const resetCount = await maintenance.checkTimeoutOnce();

    expect(resetCount).toBe(1);

    const task = await repository.findTaskById(claimed!.id);
    expect(task.status).toBe(NotificationTaskStatus.Pending);
  });

  it('cleanupOldTasks 删除过期 success 任务', async () => {
    await createChannel().expect(201);
    const receiveResponse = await receiveMessage().expect(200);

    const dispatcher = getApp().get(NotificationDispatcherService);
    await dispatcher.pollOnce();

    const tasks = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: receiveResponse.body.data.messageId })
      .expect(200);

    await waitForTaskStatus(tasks.body.data[0].id, NotificationTaskStatus.Success);

    await getPrisma().notificationTask.update({
      where: { id: tasks.body.data[0].id },
      data: {
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      }
    });

    const maintenance = getApp().get(NotificationMaintenanceService);
    const deletedCount = await maintenance.cleanupOnce();

    expect(deletedCount).toBe(1);

    const remaining = await api()
      .get('/api/notifications/tasks')
      .query({ scopeId: PROJECT_A, messageId: receiveResponse.body.data.messageId })
      .expect(200);

    expect(remaining.body.data).toHaveLength(0);
  });
});
