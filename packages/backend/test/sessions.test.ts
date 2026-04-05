import { Logger } from '@nestjs/common';
import { describe, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

import {
  setupTestApp,
  teardownTestApp,
  resetDatabase,
  getApp,
  getPrisma
} from './setup';
import {
  api,
  expectSuccess,
  expectError,
  seedProject,
  seedAgentRunner,
  seedSkill,
  seedRule,
  seedMcp
} from './helpers';
import { SessionRuntimeService } from '../src/modules/sessions/session-runtime.service';

describe('Sessions API', () => {
  let sessionSeedCounter = 0;
  const tempDirectories: string[] = [];

  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await Promise.all(
      tempDirectories.map((dir) =>
        fs.rm(dir, { recursive: true, force: true })
      )
    );
    await teardownTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    sessionSeedCounter = 0;
  });

  // ---- 辅助函数：创建一个可用的 Session ----

  type SessionMessageRecord = {
    id: string;
    role: string;
    status: string;
    createdAt: string;
    runtimeConfig?: Record<string, unknown> | null;
    outputText?: string | null;
    thinkingText?: string | null;
    contentParts?: Array<{
      type: 'text' | 'thinking' | 'tool_call';
      text?: string;
      toolName?: string;
    }>;
  };

  async function waitForSessionStatus(
    sessionId: string,
    targetStatus: string,
    timeoutMs = 5_000
  ) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const res = await api().get(`/api/sessions/${sessionId}`);
      const session = expectSuccess<{ status: string }>(res);
      if (session.status === targetStatus) {
        return session;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const res = await api().get(`/api/sessions/${sessionId}`);
    const session = expectSuccess<{ status: string }>(res);
    throw new Error(
      `Session ${sessionId} did not reach status '${targetStatus}', current: ${session.status}`
    );
  }

  async function waitForSessionMessages(
    sessionId: string,
    expectedCount: number,
    timeoutMs = 5_000
  ) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const res = await api().get(`/api/sessions/${sessionId}/messages`);
      const messages = expectSuccess<{ data: SessionMessageRecord[] }>(res);
      if (messages.data.length >= expectedCount) {
        return messages.data;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const res = await api().get(`/api/sessions/${sessionId}/messages`);
    const messages = expectSuccess<{ data: SessionMessageRecord[] }>(res);
    throw new Error(
      `Session ${sessionId} did not reach ${expectedCount} messages, current: ${messages.data.length}`
    );
  }

  async function createTestSession(options?: { withInitialMessage?: boolean }) {
    sessionSeedCounter += 1;
    const project = await seedProject({
      name: `Test Project ${sessionSeedCounter}`
    });
    const runner = await seedAgentRunner({
      name: `Test MockRunner ${sessionSeedCounter}`
    });

    const payload: Record<string, unknown> = {
      scopeId: project.id,
      runnerId: runner.id,
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    };

    if (options?.withInitialMessage) {
      payload.initialMessage = {
        input: { prompt: 'Hello Mock' }
      };
    }

    const res = await api().post('/api/sessions').send(payload);
    const session = expectSuccess<{
      id: string;
      scopeId: string;
      status: string;
    }>(res, 201);

    return { project, runner, session };
  }

  async function createTempDirectory(prefix: string) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirectories.push(dir);
    return dir;
  }

  async function createLocalGitRepository() {
    const repoDir = await createTempDirectory('agent-workbench-repo-');
    await fs.writeFile(path.join(repoDir, 'README.md'), '# demo repo\n', 'utf8');
    execSync('git init', { cwd: repoDir, stdio: 'pipe' });
    execSync('git config user.name "Agent Workbench Test"', {
      cwd: repoDir,
      stdio: 'pipe'
    });
    execSync('git config user.email "test@example.com"', {
      cwd: repoDir,
      stdio: 'pipe'
    });
    execSync('git add README.md', { cwd: repoDir, stdio: 'pipe' });
    execSync('git commit -m "init"', { cwd: repoDir, stdio: 'pipe' });
    return repoDir;
  }

  // ---- 生命周期正常路径 ----

  describe('POST /api/sessions - 创建 Session', () => {
    it('应成功创建 Session', async () => {
      const { session, project } = await createTestSession();

      expect(session.id).toBeDefined();
      expect(session.scopeId).toBe(project.id);
      expect(session.status).toBeDefined();
    });

    it('创建时可带 initialMessage', async () => {
      const { session } = await createTestSession({
        withInitialMessage: true
      });

      expect(session.id).toBeDefined();

      await waitForSessionStatus(session.id, 'ready');
      const messages = await waitForSessionMessages(session.id, 2);

      expect(messages.length).toBeGreaterThanOrEqual(2);
      const userMsg = messages.find((message) => message.role === 'user');
      expect(userMsg).toBeDefined();
    });

    it('initialMessage.runtimeConfig 应持久化为 session 默认值和首条 user message 的实际配置', async () => {
      const project = await seedProject();
      const runner = await seedAgentRunner();

      const session = expectSuccess<{ id: string }>(
        await api().post('/api/sessions').send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {},
          initialMessage: {
            input: { prompt: 'Hello Mock' },
            runtimeConfig: {
              approvalMode: 'default',
              model: 'qwen-max'
            }
          }
        }),
        201
      );

      await waitForSessionStatus(session.id, 'ready');

      const detail = expectSuccess<{
        defaultRuntimeConfig: Record<string, unknown> | null;
      }>(await api().get(`/api/sessions/${session.id}`));
      expect(detail.defaultRuntimeConfig).toEqual({
        approvalMode: 'default',
        model: 'qwen-max'
      });

      const messages = await waitForSessionMessages(session.id, 2);
      const firstUserMessage = messages.find((message) => message.role === 'user');
      expect(firstUserMessage?.runtimeConfig).toEqual({
        approvalMode: 'default',
        model: 'qwen-max'
      });
    });

    it('创建时可包含 Skills/Rules/MCPs', async () => {
      const project = await seedProject();
      const runner = await seedAgentRunner();
      const skill = await seedSkill();
      const rule = await seedRule();
      const mcp = await seedMcp();

      const res = await api()
        .post('/api/sessions')
        .send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [skill.id],
          ruleIds: [rule.id],
          mcps: [{ resourceId: mcp.id }],
          runnerSessionConfig: {}
        });
      const session = expectSuccess<{ id: string }>(res, 201);

      const detailRes = await api().get(`/api/sessions/${session.id}`);
      const detail = expectSuccess<{
        platformSessionConfig: {
          skillIds: string[];
          ruleIds: string[];
          mcps: { resourceId: string }[];
        };
      }>(detailRes);

      expect(detail.platformSessionConfig.skillIds).toContain(skill.id);
      expect(detail.platformSessionConfig.ruleIds).toContain(rule.id);
    });

    it('创建 session 时应初始化独立工作目录和 docs 目录', async () => {
      const workspaceRoot = await createTempDirectory(
        'agent-workbench-workspace-'
      );
      const project = await seedProject({
        workspacePath: workspaceRoot
      });
      const runner = await seedAgentRunner();

      const session = expectSuccess<{ id: string }>(
        await api().post('/api/sessions').send({
          scopeId: project.id,
          runnerId: runner.id,
          workspaceResources: ['doc'],
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        }),
        201
      );

      const detail = expectSuccess<{
        id: string;
        platformSessionConfig: {
          workspaceMode: string;
          workspaceRoot: string;
          cwd: string;
          workspaceResources: string[];
        };
      }>(await api().get(`/api/sessions/${session.id}`));

      expect(detail.platformSessionConfig.workspaceMode).toBe('session');
      expect(detail.platformSessionConfig.workspaceRoot).toBe(workspaceRoot);
      expect(detail.platformSessionConfig.cwd).toBe(
        path.join(workspaceRoot, session.id)
      );
      expect(detail.platformSessionConfig.workspaceResources).toEqual(['doc']);
      await expect(
        fs.stat(path.join(detail.platformSessionConfig.cwd, 'docs'))
      ).resolves.toBeDefined();
    });

    it('勾选 code 和 doc 时应 clone 项目代码并初始化 docs', async () => {
      const workspaceRoot = await createTempDirectory(
        'agent-workbench-workspace-'
      );
      const repositoryPath = await createLocalGitRepository();
      const project = await seedProject({
        workspacePath: workspaceRoot
      });
      await getPrisma().project.update({
        where: { id: project.id },
        data: {
          gitUrl: repositoryPath
        }
      });
      const runner = await seedAgentRunner();

      const session = expectSuccess<{ id: string }>(
        await api().post('/api/sessions').send({
          scopeId: project.id,
          runnerId: runner.id,
          workspaceResources: ['code', 'doc'],
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        }),
        201
      );

      const sessionDir = path.join(workspaceRoot, session.id);
      await expect(fs.stat(path.join(sessionDir, 'README.md'))).resolves.toBeDefined();
      await expect(fs.stat(path.join(sessionDir, 'docs'))).resolves.toBeDefined();
    });

    it('工作目录初始化失败时应回滚 session 和目录', async () => {
      const workspaceRoot = await createTempDirectory(
        'agent-workbench-workspace-'
      );
      const project = await seedProject({
        workspacePath: workspaceRoot
      });
      await getPrisma().project.update({
        where: { id: project.id },
        data: {
          gitUrl: path.join(workspaceRoot, 'missing-repo')
        }
      });
      const runner = await seedAgentRunner();

      const error = expectError(
        await api().post('/api/sessions').send({
          scopeId: project.id,
          runnerId: runner.id,
          workspaceResources: ['code'],
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        }),
        502
      );

      expect(error.message).toContain('Failed to initialize session workspace');
      expect(
        await getPrisma().agentSession.count({
          where: { scopeId: project.id }
        })
      ).toBe(0);
      expect(await fs.readdir(workspaceRoot)).toEqual([]);
    });
  });

  describe('GET /api/sessions - 列表查询', () => {
    it('按 scopeId 查询返回对应的 Sessions', async () => {
      const { project } = await createTestSession();
      await createTestSession(); // Another project's session

      const res = await api().get(`/api/sessions?scopeId=${project.id}`);
      const data = expectSuccess<{ id: string }[]>(res);

      expect(data).toHaveLength(1);
    });
  });

  describe('GET /api/sessions/:id - 获取详情', () => {
    it('应返回完整的 Session 详情', async () => {
      const { session } = await createTestSession();

      const res = await api().get(`/api/sessions/${session.id}`);
      const data = expectSuccess<{
        id: string;
        status: string;
        runnerType: string;
        platformSessionConfig: object;
        runnerSessionConfig: object;
      }>(res);

      expect(data.id).toBe(session.id);
      expect(data.runnerType).toBe('mock');
      expect(data.platformSessionConfig).toBeDefined();
    });
  });

  describe('POST /api/sessions/:id/messages - 发送消息', () => {
    // 语义：发送消息是一个操作（action），不是创建资源，应返回 200
    it('应成功发送消息到 Session', async () => {
      const { session } = await createTestSession();

      const res = await api()
        .post(`/api/sessions/${session.id}/messages`)
        .send({ input: { prompt: 'Test message' } });
      expectSuccess(res, 200);

      await waitForSessionStatus(session.id, 'ready');
      const messages = await waitForSessionMessages(session.id, 2);

      const userMsgs = messages.filter((message) => message.role === 'user');
      expect(userMsgs.length).toBeGreaterThanOrEqual(1);
    });

    it('发送消息时应持久化实际生效的 runtimeConfig，包括 session 默认值', async () => {
      const project = await seedProject();
      const runner = await seedAgentRunner();

      const session = expectSuccess<{ id: string }>(
        await api().post('/api/sessions').send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {},
          initialMessage: {
            input: { prompt: '初始化默认 runtime' },
            runtimeConfig: {
              model: 'qwen-max'
            }
          }
        }),
        201
      );

      await waitForSessionStatus(session.id, 'ready');

      expectSuccess(
        await api()
          .post(`/api/sessions/${session.id}/messages`)
          .send({ input: { prompt: '沿用默认 runtime' } }),
        200
      );

      await waitForSessionStatus(session.id, 'ready');
      const messages = await waitForSessionMessages(session.id, 4);
      const userMessages = messages.filter((message) => message.role === 'user');
      const latestUserMessage = userMessages[userMessages.length - 1];

      expect(latestUserMessage?.runtimeConfig).toEqual({
        model: 'qwen-max'
      });
    });

    it('已持久化的 CLI session id 在 runtime 重建后应被复用，不应被新会话覆盖', async () => {
      const project = await seedProject();
      const runner = await seedAgentRunner({
        name: 'Qwen Runner',
        type: 'qwen-cli',
        runnerConfig: {}
      });

      const session = expectSuccess<{ id: string }>(
        await api().post('/api/sessions').send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        }),
        201
      );

      await getPrisma().agentSession.update({
        where: { id: session.id },
        data: {
          runnerState: {
            contextDir: '/tmp/.agent-workbench/test-session',
            mcpConfigPath: null,
            cliSessionId: 'qwen-session-123'
          }
        }
      });

      const runtimeService = getApp().get(SessionRuntimeService);
      await runtimeService.ensureRuntime(session.id);

      const refreshedSession = await getPrisma().agentSession.findUniqueOrThrow({
        where: { id: session.id },
        select: { runnerState: true }
      });

      expect(refreshedSession.runnerState).toMatchObject({
        cliSessionId: 'qwen-session-123'
      });
    });
  });

  describe('POST /api/sessions/:id/cancel - 取消输出', () => {
    // 语义：取消是操作，不是创建资源，应返回 200
    it('应成功取消', async () => {
      const { session } = await createTestSession();

      const res = await api().post(`/api/sessions/${session.id}/cancel`);
      expectSuccess(res, 200);
    });
  });

  describe('POST /api/sessions/:id/reload - 重新加载', () => {
    // 语义：reload 是操作，不是创建资源，应返回 200
    it('应成功触发 reload', async () => {
      const { session } = await createTestSession({
        withInitialMessage: true
      });

      await waitForSessionStatus(session.id, 'ready');

      const res = await api().post(`/api/sessions/${session.id}/reload`);
      expectSuccess(res, 200);
    });

    it('reload 应复用最后一条 user message 已持久化的 runtimeConfig', async () => {
      const project = await seedProject();
      const runner = await seedAgentRunner();

      const session = expectSuccess<{ id: string }>(
        await api().post('/api/sessions').send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {},
          initialMessage: {
            input: { prompt: '初始化默认 runtime' },
            runtimeConfig: {
              model: 'qwen-max'
            }
          }
        }),
        201
      );

      await waitForSessionStatus(session.id, 'ready');

      expectSuccess(
        await api()
          .post(`/api/sessions/${session.id}/messages`)
          .send({
            input: { prompt: '本轮覆写 runtime' },
            runtimeConfig: {
              approvalMode: 'auto-edit'
            }
          }),
        200
      );

      await waitForSessionStatus(session.id, 'ready');

      const beforeReload = expectSuccess<{ data: SessionMessageRecord[] }>(
        await api().get(`/api/sessions/${session.id}/messages`)
      ).data;
      const targetUserMessage = [...beforeReload]
        .reverse()
        .find((message) => message.role === 'user');

      expect(targetUserMessage?.runtimeConfig).toEqual({
        model: 'qwen-max',
        approvalMode: 'auto-edit'
      });

      expectSuccess(await api().post(`/api/sessions/${session.id}/reload`), 200);
      await waitForSessionStatus(session.id, 'ready');

      const afterReload = expectSuccess<{ data: SessionMessageRecord[] }>(
        await api().get(`/api/sessions/${session.id}/messages`)
      ).data;
      const reloadedUserMessage = afterReload.find(
        (message) => message.id === targetUserMessage?.id
      );

      expect(reloadedUserMessage?.runtimeConfig).toEqual({
        model: 'qwen-max',
        approvalMode: 'auto-edit'
      });
    });
  });

  describe('POST /api/sessions/:id/messages/:messageId/edit - 编辑消息', () => {
    it('编辑不存在的 messageId 应返回 404', async () => {
      const { session } = await createTestSession();

      const error = expectError(
        await api()
          .post(`/api/sessions/${session.id}/messages/nonexistent-message/edit`)
          .send({ input: { prompt: 'edited prompt' } }),
        404
      );

      expect(error.message).toBe(
        'Session message not found: nonexistent-message'
      );
    });
  });

  describe('GET /api/sessions/:id/messages - 消息列表', () => {
    it('应返回分页数据结构', async () => {
      const { session } = await createTestSession();

      const res = await api().get(
        `/api/sessions/${session.id}/messages?limit=10`
      );
      const data = expectSuccess<{
        data: unknown[];
        nextCursor: string | null;
      }>(res);

      expect(Array.isArray(data.data)).toBe(true);
      expect('nextCursor' in data).toBe(true);
    });

    it('应按 cursor 正确翻页，且多页结果无重复无漏项', async () => {
      const { session } = await createTestSession();

      for (const prompt of ['msg-1', 'msg-2', 'msg-3']) {
        expectSuccess(
          await api()
            .post(`/api/sessions/${session.id}/messages`)
            .send({ input: { prompt } }),
          200
        );
        await waitForSessionStatus(session.id, 'ready');
      }

      const firstPage = expectSuccess<{
        data: SessionMessageRecord[];
        nextCursor: string | null;
      }>(
        await api().get(`/api/sessions/${session.id}/messages?limit=2`)
      );

      expect(firstPage.data).toHaveLength(2);
      expect(firstPage.nextCursor).toBeTruthy();
      expect(firstPage.data[0].createdAt <= firstPage.data[1].createdAt).toBe(
        true
      );

      const secondPage = expectSuccess<{
        data: SessionMessageRecord[];
        nextCursor: string | null;
      }>(
        await api().get(
          `/api/sessions/${session.id}/messages?limit=2&cursor=${firstPage.nextCursor}`
        )
      );

      const allMessageIds = [...firstPage.data, ...secondPage.data].map(
        (message) => message.id
      );
      expect(new Set(allMessageIds).size).toBe(allMessageIds.length);

      const allMessages = expectSuccess<{ data: SessionMessageRecord[] }>(
        await api().get(`/api/sessions/${session.id}/messages?limit=20`)
      ).data;
      expect(allMessageIds.every((id) => allMessages.some((m) => m.id === id))).toBe(
        true
      );
      expect(secondPage.data[0].createdAt <= secondPage.data.at(-1)!.createdAt).toBe(
        true
      );
    });

    it('assistant 消息应按时序落 contentParts，连续 message_delta 合并为单个 text part，并可重进回读', async () => {
      const { session } = await createTestSession();

      const sendRes = await api()
        .post(`/api/sessions/${session.id}/messages`)
        .send({ input: { prompt: '检查 contentParts 时序' } });
      expectSuccess(sendRes, 200);

      await waitForSessionStatus(session.id, 'ready');
      const messages = await waitForSessionMessages(session.id, 2);
      const assistantMessage = messages.find(
        (message) => message.role === 'assistant'
      );

      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.status).toBe('complete');
      expect(assistantMessage?.contentParts).toEqual([
        {
          type: 'thinking',
          text: 'Mock runner 正在整理上下文...'
        },
        {
          type: 'text',
          text: assistantMessage?.outputText
        }
      ]);
      expect(assistantMessage?.contentParts?.[1]?.text).toContain(
        '收到输入：检查 contentParts 时序'
      );

      const reloadRes = await api().get(`/api/sessions/${session.id}/messages`);
      const reloadedMessages = expectSuccess<{
        data: SessionMessageRecord[];
      }>(reloadRes).data;
      const reloadedAssistantMessage = reloadedMessages.find(
        (message) => message.id === assistantMessage?.id
      );

      expect(reloadedAssistantMessage?.contentParts).toEqual(
        assistantMessage?.contentParts
      );
    }, 10000);
  });

  describe('SSE /api/sessions/:id/events - 事件流', () => {
    /**
     * Test SSE by making a raw HTTP request and reading the first chunk.
     * supertest cannot handle SSE properly, so we use Node's http module.
     */
    function collectSSE(
      path: string,
      timeout = 300
    ): Promise<{
      statusCode: number;
      contentType: string;
      chunks: string[];
      events: Array<{ type: string; data: unknown }>;
    }> {
      return new Promise((resolve) => {
        const server = getApp().getHttpServer();
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;

        const chunks: string[] = [];
        const req = http.get(
          `http://127.0.0.1:${port}${path}`,
          { headers: { Accept: 'text/event-stream' } },
          (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              chunks.push(chunk);
            });

            setTimeout(() => {
              const contentType = String(res.headers['content-type'] ?? '');
              const payload = chunks.join('');
              res.destroy();
              resolve({
                statusCode: res.statusCode ?? 0,
                contentType,
                chunks,
                events: contentType.includes('text/event-stream')
                  ? parseSseEvents(payload)
                  : []
              });
            }, timeout);
          }
        );
        req.on('error', () => {
          resolve({ statusCode: 0, contentType: '', chunks, events: [] });
        });
      });
    }

    function parseSseEvents(payload: string) {
      return payload
        .split('\n\n')
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
          const lines = block.split('\n');
          const type =
            lines
              .find((line) => line.startsWith('event:'))
              ?.replace(/^event:\s*/, '') ?? 'message';
          const rawData =
            lines
              .find((line) => line.startsWith('data:'))
              ?.replace(/^data:\s*/, '') ?? 'null';

          return {
            type,
            data: JSON.parse(rawData) as unknown
          };
        });
    }

    it('应能回放已持久化事件，并包含 message_result 与 done', async () => {
      const { session } = await createTestSession();

      await api()
        .post(`/api/sessions/${session.id}/messages`)
        .send({ input: { prompt: 'SSE replay test' } });
      await waitForSessionStatus(session.id, 'ready');

      const server = getApp().getHttpServer();
      if (!server.listening) {
        await new Promise<void>((resolve) => {
          server.listen(0, '127.0.0.1', () => resolve());
        });
      }

      const result = await collectSSE(`/api/sessions/${session.id}/events`);

      expect(result.statusCode).toBe(200);
      expect(result.events.map((event) => event.type)).toContain(
        'message_result'
      );
      expect(result.events.map((event) => event.type)).toContain('done');
    }, 10000);

    it('回放事件应包含 session_status，且 done 应在最后', async () => {
      const { session } = await createTestSession();

      expectSuccess(
        await api()
          .post(`/api/sessions/${session.id}/messages`)
          .send({ input: { prompt: 'SSE order test' } }),
        200
      );
      await waitForSessionStatus(session.id, 'ready');

      const result = await collectSSE(`/api/sessions/${session.id}/events`);
      const eventTypes = result.events.map((event) => event.type);

      expect(eventTypes).toContain('session_status');
      expect(eventTypes.at(-1)).toBe('done');
    }, 10000);

    it('afterEventId 应只返回较新的事件，且 replay/live 不应重复', async () => {
      const { session } = await createTestSession();

      await api()
        .post(`/api/sessions/${session.id}/messages`)
        .send({ input: { prompt: 'SSE afterEventId first message' } });
      await waitForSessionStatus(session.id, 'ready');

      const detailRes = await api().get(`/api/sessions/${session.id}`);
      const detail = expectSuccess<{ lastEventId: number }>(detailRes);

      const streamPromise = collectSSE(
        `/api/sessions/${session.id}/events?afterEventId=${detail.lastEventId}`,
        1_000
      );

      await api()
        .post(`/api/sessions/${session.id}/messages`)
        .send({ input: { prompt: 'SSE afterEventId second message' } });
      await waitForSessionStatus(session.id, 'ready');

      const result = await streamPromise;
      const eventIds = result.events
        .map((event) =>
          event.data && typeof event.data === 'object' && 'eventId' in event.data
            ? Number((event.data as { eventId: number }).eventId)
            : null
        )
        .filter((eventId): eventId is number => eventId !== null);

      expect(eventIds.length).toBeGreaterThan(0);
      expect(eventIds.every((eventId) => eventId > detail.lastEventId)).toBe(
        true
      );
      expect(new Set(eventIds).size).toBe(eventIds.length);
    }, 10000);

    it('不存在的 Session 事件流应返回 404', async () => {
      const res = await api()
        .get('/api/sessions/nonexistent/events')
        .set('Accept', 'text/event-stream');
      expectError(res, 404);
    });

    it('非法 afterEventId 应返回 400', async () => {
      const { session } = await createTestSession();

      const res = await api().get(
        `/api/sessions/${session.id}/events?afterEventId=-1`
      );
      expectError(res, 400);
    });
  });

  describe('DELETE /api/sessions/:id - 销毁 Session', () => {
    it('应成功销毁 Session', async () => {
      const { session } = await createTestSession();

      const res = await api().delete(`/api/sessions/${session.id}`);
      expectSuccess(res);

      const detailRes = await api().get(`/api/sessions/${session.id}`);
      expectError(detailRes, 404);
    });

    it('销毁 Session 时应同步删除托管工作目录', async () => {
      const workspaceRoot = await createTempDirectory(
        'agent-workbench-workspace-'
      );
      const project = await seedProject({
        workspacePath: workspaceRoot
      });
      const runner = await seedAgentRunner();

      const session = expectSuccess<{ id: string }>(
        await api().post('/api/sessions').send({
          scopeId: project.id,
          runnerId: runner.id,
          workspaceResources: ['doc'],
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        }),
        201
      );

      const sessionDir = path.join(workspaceRoot, session.id);
      await expect(fs.stat(sessionDir)).resolves.toBeDefined();

      expectSuccess(await api().delete(`/api/sessions/${session.id}`));

      await expect(fs.stat(sessionDir)).rejects.toThrow();
    });

    it('销毁运行中的 Session 后，不应再由后台 output consumer 向已删除会话追加事件', async () => {
      const errorSpy = vi.spyOn(Logger.prototype, 'error');

      try {
        const { session } = await createTestSession();

        const sendRes = await api()
          .post(`/api/sessions/${session.id}/messages`)
          .send({ input: { prompt: 'Dispose while running' } });
        expectSuccess(sendRes);

        const disposeRes = await api().delete(`/api/sessions/${session.id}`);
        expectSuccess(disposeRes);

        await new Promise((resolve) => setTimeout(resolve, 500));

        const prisma = getPrisma();
        const [sessionCount, messageCount, eventCount] = await Promise.all([
          prisma.agentSession.count({ where: { id: session.id } }),
          prisma.sessionMessage.count({ where: { sessionId: session.id } }),
          prisma.sessionEvent.count({ where: { sessionId: session.id } })
        ]);

        expect(sessionCount).toBe(0);
        expect(messageCount).toBe(0);
        expect(eventCount).toBe(0);
        expect(
          errorSpy.mock.calls.some(([message]) =>
            String(message).includes('Runner output crashed')
          )
        ).toBe(false);
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  // ---- 边界 & 错误场景 ----

  describe('创建验证', () => {
    it('scopeId 不存在时应返回错误', async () => {
      const runner = await seedAgentRunner();

      const res = await api().post('/api/sessions').send({
        scopeId: 'nonexistent-project',
        runnerId: runner.id,
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      });

      expectError(res, 404);
    });

    it('runnerId 不存在时应返回错误', async () => {
      const project = await seedProject();

      const res = await api().post('/api/sessions').send({
        scopeId: project.id,
        runnerId: 'nonexistent-runner',
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      });

      expectError(res, 404);
    });

    it('缺少必填字段 scopeId 返回 400', async () => {
      const runner = await seedAgentRunner();

      const res = await api().post('/api/sessions').send({
        runnerId: runner.id,
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      });
      expectError(res, 400);
    });
  });

  describe('资源不存在', () => {
    it('GET 不存在的 Session 返回 404', async () => {
      const error = expectError(await api().get('/api/sessions/nonexistent'), 404);
      expect(error.message).toBe('Session not found: nonexistent');
    });

    it('发消息到不存在的 Session 返回错误', async () => {
      const res = await api()
        .post('/api/sessions/nonexistent/messages')
        .send({ input: { prompt: 'hello' } });

      expectError(res, 404);
    });
  });
});
