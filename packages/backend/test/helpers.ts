import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { getApp, getPrisma } from './setup';

type ApiResponse<T = unknown> = {
  code: number;
  message: string;
  data: T;
};

/**
 * Helper to make typed HTTP requests against the test app.
 */
export function api() {
  return request(getApp().getHttpServer());
}

/**
 * Unwrap the wrapped API response and return only `data`.
 * Asserts the response has the expected status code.
 */
export function expectSuccess<T = unknown>(
  res: request.Response,
  expectedStatus = 200
): T {
  expect(res.status).toBe(expectedStatus);
  expect(res.body.code).toBe(expectedStatus);
  return res.body.data as T;
}

/**
 * Assert an error response with the given status code.
 */
export function expectError(
  res: request.Response,
  expectedStatus: number
): ApiResponse {
  expect(res.status).toBe(expectedStatus);
  expect(res.body.code).toBe(expectedStatus);
  return res.body as ApiResponse;
}

// ---- Common test data factories ----

export function createSkillPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Skill',
    description: 'A test skill',
    content: '# Test Skill\n\nUse this for testing.',
    ...overrides
  };
}

export function createRulePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Rule',
    description: 'A test rule',
    content: '## Rule\n\nAlways cite sources.',
    ...overrides
  };
}

export function createMcpPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test MCP',
    description: 'A test MCP server',
    content: {
      type: 'stdio',
      command: 'echo',
      args: ['hello']
    },
    ...overrides
  };
}

export function createProfilePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Profile',
    description: 'A test profile',
    ...overrides
  };
}

export function createProjectPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Project',
    description: 'A test project',
    repoGitUrl: 'git@github.com:test/test.git',
    workspaceRootPath:
      typeof overrides.workspaceRootPath === 'string'
        ? overrides.workspaceRootPath
        : '/tmp',
    docGitUrl: null,
    ...overrides
  };
}

export function createAgentRunnerPayload(
  overrides: Record<string, unknown> = {}
) {
  return {
    name: 'Test MockRunner',
    description: 'A test mock runner',
    type: 'mock',
    runnerConfig: {},
    ...overrides
  };
}

// ---- Shortcut helpers to create resources and return the data ----

export async function seedSkill(
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
  const res = await api()
    .post('/api/skills')
    .send(createSkillPayload(overrides));
  return expectSuccess(res, 201);
}

export async function seedRule(
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
  const res = await api().post('/api/rules').send(createRulePayload(overrides));
  return expectSuccess(res, 201);
}

export async function seedMcp(
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
  const res = await api().post('/api/mcps').send(createMcpPayload(overrides));
  return expectSuccess(res, 201);
}

export async function seedProfile(
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
  const res = await api()
    .post('/api/profiles')
    .send(createProfilePayload(overrides));
  return expectSuccess(res, 201);
}

export async function seedProject(
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
  const projectPayloadOverrides = { ...overrides };
  const repoGitUrlOverride =
    typeof projectPayloadOverrides.repoGitUrl === 'string'
      ? projectPayloadOverrides.repoGitUrl
      : null;

  if (repoGitUrlOverride !== null && !repoGitUrlOverride.startsWith('git@')) {
    delete projectPayloadOverrides.repoGitUrl;
  }

  const res = await api()
    .post('/api/projects')
    .send(createProjectPayload(projectPayloadOverrides));
  const project = expectSuccess<{ id: string; name: string }>(res, 201);

  if (repoGitUrlOverride !== null && !repoGitUrlOverride.startsWith('git@')) {
    await getPrisma().project.update({
      where: { id: project.id },
      data: {
        repoGitUrl: repoGitUrlOverride
      }
    });
  }

  return project;
}

export async function seedAgentRunner(
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; name: string; type: string }> {
  const res = await api()
    .post('/api/agent-runners')
    .send(createAgentRunnerPayload(overrides));
  return expectSuccess(res, 201);
}
