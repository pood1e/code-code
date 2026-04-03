import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

import { setupTestApp, teardownTestApp, resetDatabase } from './setup';
import {
  api,
  expectSuccess,
  expectError,
  seedProject,
  seedAgentRunner,
  seedSkill,
  seedRule,
  seedMcp,
  seedProfile
} from './helpers';

describe('跨模块依赖测试', () => {
  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  // ---- 级联删除 ----

  describe('删除 Project 后 Session 级联清理', () => {
    it('删除 Project 应级联删除关联的所有 Sessions', async () => {
      const project = await seedProject();
      const runner = await seedAgentRunner();

      // Create two sessions under this project
      const session1Res = await api()
        .post('/api/sessions')
        .send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        });
      const session1 = expectSuccess<{ id: string }>(session1Res, 201);

      const session2Res = await api()
        .post('/api/sessions')
        .send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        });
      const session2 = expectSuccess<{ id: string }>(session2Res, 201);

      // Delete the project
      expectSuccess(await api().delete(`/api/projects/${project.id}`));

      // Both sessions should be gone
      expectError(await api().get(`/api/sessions/${session1.id}`), 404);
      expectError(await api().get(`/api/sessions/${session2.id}`), 404);
    });
  });

  // ---- 删除被 Profile 引用的资源 ----

  describe('删除被 Profile 引用的资源', () => {
    it('删除被引用的 Skill 返回 409 + referencedBy', async () => {
      const skill = await seedSkill({ name: 'Referenced Skill' });
      const profile = await seedProfile({ name: 'Using Profile' });

      await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [{ resourceId: skill.id, order: 0 }],
          mcps: [],
          rules: []
        });

      const res = await api().delete(`/api/skills/${skill.id}`);
      const error = expectError(res, 409);

      const data = error.data as { referencedBy: { id: string; name: string }[] };
      expect(data.referencedBy).toHaveLength(1);
      expect(data.referencedBy[0].name).toBe('Using Profile');
    });

    it('删除被多个 Profile 引用的 MCP 返回全部引用方', async () => {
      const mcp = await seedMcp({ name: 'Shared MCP' });
      const profileA = await seedProfile({ name: 'Profile A' });
      const profileB = await seedProfile({ name: 'Profile B' });

      await api()
        .put(`/api/profiles/${profileA.id}`)
        .send({
          name: profileA.name,
          skills: [],
          mcps: [{ resourceId: mcp.id, order: 0 }],
          rules: []
        });

      await api()
        .put(`/api/profiles/${profileB.id}`)
        .send({
          name: profileB.name,
          skills: [],
          mcps: [{ resourceId: mcp.id, order: 0 }],
          rules: []
        });

      const res = await api().delete(`/api/mcps/${mcp.id}`);
      const error = expectError(res, 409);

      const data = error.data as { referencedBy: { name: string }[] };
      expect(data.referencedBy).toHaveLength(2);
      const names = data.referencedBy.map((r) => r.name).sort();
      expect(names).toEqual(['Profile A', 'Profile B']);
    });

    it('删除被引用的 Rule 返回 409', async () => {
      const rule = await seedRule({ name: 'Referenced Rule' });
      const profile = await seedProfile();

      await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [],
          mcps: [],
          rules: [{ resourceId: rule.id, order: 0 }]
        });

      expectError(await api().delete(`/api/rules/${rule.id}`), 409);
    });
  });

  // ---- Profile 引用不存在的资源 ----

  describe('Profile 引用已删除的资源', () => {
    it('保存 Profile 引用已删除的 Skill 返回 404', async () => {
      const profile = await seedProfile();
      const skill = await seedSkill();

      // Delete the skill first
      expectSuccess(await api().delete(`/api/skills/${skill.id}`));

      // Try to save profile with deleted skill
      const res = await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [{ resourceId: skill.id, order: 0 }],
          mcps: [],
          rules: []
        });
      expectError(res, 404);
    });
  });

  // ---- Runner 删除约束 ----

  describe('Runner 删除约束', () => {
    it('有 Session 引用时无法删除 Runner', async () => {
      const project = await seedProject();
      const runner = await seedAgentRunner();

      await api()
        .post('/api/sessions')
        .send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        });

      const deleteRes = await api().delete(`/api/agent-runners/${runner.id}`);
      expectError(deleteRes, 400);

      // Runner should still exist
      expectSuccess(await api().get(`/api/agent-runners/${runner.id}`));
    });

    it('所有 Session 所属 Project 删除后，Runner 可删除', async () => {
      const project = await seedProject();
      const runner = await seedAgentRunner();

      await api()
        .post('/api/sessions')
        .send({
          scopeId: project.id,
          runnerId: runner.id,
          skillIds: [],
          ruleIds: [],
          mcps: [],
          runnerSessionConfig: {}
        });

      // Delete project (cascades sessions)
      expectSuccess(await api().delete(`/api/projects/${project.id}`));

      // Now runner can be deleted
      expectSuccess(await api().delete(`/api/agent-runners/${runner.id}`));
    });
  });

  // ---- 删除 Profile 后资源仍存在 ----

  describe('删除 Profile 后关联资源独立存在', () => {
    it('删除 Profile 不影响 Skills/MCPs/Rules', async () => {
      const skill = await seedSkill();
      const mcp = await seedMcp();
      const rule = await seedRule();
      const profile = await seedProfile();

      await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [{ resourceId: skill.id, order: 0 }],
          mcps: [{ resourceId: mcp.id, order: 0 }],
          rules: [{ resourceId: rule.id, order: 0 }]
        });

      // Delete profile
      expectSuccess(await api().delete(`/api/profiles/${profile.id}`));

      // All resources should still exist
      expectSuccess(await api().get(`/api/skills/${skill.id}`));
      expectSuccess(await api().get(`/api/mcps/${mcp.id}`));
      expectSuccess(await api().get(`/api/rules/${rule.id}`));

      // And they should be deletable now (no refs)
      expectSuccess(await api().delete(`/api/skills/${skill.id}`));
      expectSuccess(await api().delete(`/api/mcps/${mcp.id}`));
      expectSuccess(await api().delete(`/api/rules/${rule.id}`));
    });
  });
});
