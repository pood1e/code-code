/**
 * API helper to reset/seed test data via backend REST API.
 *
 * 约定：后端统一返回 { message: string; data: T } 结构。
 * 所有 api* 函数均解包 .data 后返回，类型标注为 ApiRecord（单对象）或 ApiRecord[]（列表）。
 */

/** 后端标准响应中 data 字段的最小类型：带 id 的键值记录 */
export type ApiRecord = Record<string, unknown> & { id: string };

function resolveApiBase() {
  if (process.env.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }

  const apiOrigin = process.env.VITE_API_URL || 'http://localhost:3001';
  return `${apiOrigin.replace(/\/$/, '')}/api`;
}

const API_BASE = resolveApiBase();

function getApiUrl(path: string) {
  return `${API_BASE}${path}`;
}

/** POST — 解包 data，强制断言为 ApiRecord（单对象） */
async function apiPost(path: string, body: Record<string, unknown>): Promise<ApiRecord> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: ApiRecord };
  return json.data;
}

/** PUT — 解包 data，强制断言为 ApiRecord（单对象） */
async function apiPut(path: string, body: Record<string, unknown>): Promise<ApiRecord> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: ApiRecord };
  return json.data;
}

/**
 * GET — 解包 data。
 * 可能是 ApiRecord（单对象）或 ApiRecord[]（列表），调用方通过 Array.isArray() 区分。
 */
async function apiGet(path: string): Promise<ApiRecord | ApiRecord[]> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: ApiRecord | ApiRecord[] };
  return json.data;
}

/** DELETE — 忽略响应 body（backend 可能返回 data: null） */
async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${await res.text()}`);
  }
}

/**
 * Clean up all test data between runs.
 */
async function cleanupTestData() {
  // Delete all sessions first (depends on projects/runners)
  const projects = await apiGet('/projects');
  if (Array.isArray(projects)) {
    for (const p of projects) {
      const sessions = await apiGet(`/sessions?scopeId=${p.id}`);
      if (Array.isArray(sessions)) {
        for (const s of sessions) {
          await apiDelete(`/sessions/${s.id}`);
        }
      }
    }
  }

  // Delete profiles (releases resource refs)
  const profiles = await apiGet('/profiles');
  if (Array.isArray(profiles)) {
    for (const p of profiles) {
      await apiDelete(`/profiles/${p.id}`);
    }
  }

  // Delete resources
  for (const kind of ['skills', 'mcps', 'rules']) {
    const items = await apiGet(`/${kind}`);
    if (Array.isArray(items)) {
      for (const item of items) {
        await apiDelete(`/${kind}/${item.id}`);
      }
    }
  }

  // Delete runners
  const runners = await apiGet('/agent-runners');
  if (Array.isArray(runners)) {
    for (const r of runners) {
      await apiDelete(`/agent-runners/${r.id}`);
    }
  }

  // Delete projects
  if (Array.isArray(projects)) {
    for (const p of projects) {
      await apiDelete(`/projects/${p.id}`);
    }
  }
}

/**
 * Seed an Agent Runner with mock type for testing.
 */
async function seedMockRunner(name = 'E2E Mock Runner') {
  return apiPost('/agent-runners', {
    name,
    type: 'mock',
    runnerConfig: {}
  });
}

/**
 * Seed a Project for testing.
 */
async function seedProject(name = 'E2E Test Project') {
  return apiPost('/projects', {
    name,
    workspacePath: '/tmp',
    gitUrl: 'git@github.com:test/e2e.git'
  });
}

export {
  cleanupTestData,
  seedMockRunner,
  seedProject,
  apiPost,
  apiPut,
  apiGet,
  apiDelete,
  API_BASE,
  getApiUrl
};
