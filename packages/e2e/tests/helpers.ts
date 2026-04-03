import { test, expect, type Page } from '@playwright/test';

/**
 * API helper to reset/seed test data via backend REST API.
 */
const API_BASE = (process.env.VITE_API_URL || 'http://localhost:3001') + '/api';

async function apiPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return json.data;
}

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  const json = await res.json();
  return json.data;
}

async function apiDelete(path: string) {
  await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
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
async function seedMockRunner() {
  return apiPost('/agent-runners', {
    name: 'E2E Mock Runner',
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
  apiGet,
  apiDelete,
  API_BASE
};
