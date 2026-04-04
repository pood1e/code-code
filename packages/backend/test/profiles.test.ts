import { load } from 'js-yaml';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

import { setupTestApp, teardownTestApp, resetDatabase } from './setup';
import {
  api,
  expectSuccess,
  expectError,
  createProfilePayload,
  seedProfile,
  seedSkill,
  seedRule,
  seedMcp
} from './helpers';

describe('Profiles API', () => {
  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  // ---- CRUD & 聚合正常路径 ----

  describe('POST /api/profiles - 创建 Profile', () => {
    it('应成功创建空 Profile（仅 name）', async () => {
      const res = await api()
        .post('/api/profiles')
        .send(createProfilePayload({ name: 'My Profile' }));
      const data = expectSuccess<{ id: string; name: string }>(res, 201);

      expect(data.id).toBeDefined();
      expect(data.name).toBe('My Profile');
    });

    it('空白 description 应归一化为 null', async () => {
      const res = await api()
        .post('/api/profiles')
        .send(createProfilePayload({ description: '   ' }));
      const data = expectSuccess<{ description: string | null }>(res, 201);

      expect(data.description).toBeNull();
    });
  });

  describe('GET /api/profiles - 列表查询', () => {
    it('返回所有 Profiles', async () => {
      await seedProfile({ name: 'Profile A' });
      await seedProfile({ name: 'Profile B' });

      const res = await api().get('/api/profiles');
      const data = expectSuccess<{ name: string }[]>(res);

      expect(data).toHaveLength(2);
    });
  });

  describe('PUT /api/profiles/:id - 保存 Profile 聚合体', () => {
    it('应成功保存含 Skills/MCPs/Rules 的 Profile', async () => {
      const profile = await seedProfile();
      const skill = await seedSkill({ name: 'Skill 1' });
      const rule = await seedRule({ name: 'Rule 1' });
      const mcp = await seedMcp({ name: 'MCP 1' });

      const savePayload = {
        name: 'Full Profile',
        description: 'Complete profile with all resources',
        skills: [{ resourceId: skill.id, order: 0 }],
        mcps: [{ resourceId: mcp.id, order: 0 }],
        rules: [{ resourceId: rule.id, order: 0 }]
      };

      const res = await api()
        .put(`/api/profiles/${profile.id}`)
        .send(savePayload);
      const data = expectSuccess<{
        name: string;
        skills: { id: string }[];
        mcps: { id: string }[];
        rules: { id: string }[];
      }>(res);

      expect(data.name).toBe('Full Profile');
      expect(data.skills).toHaveLength(1);
      expect(data.skills[0].id).toBe(skill.id);
      expect(data.mcps).toHaveLength(1);
      expect(data.mcps[0].id).toBe(mcp.id);
      expect(data.rules).toHaveLength(1);
      expect(data.rules[0].id).toBe(rule.id);
    });

    // 业务语义：用户拖拽排序后，前端发送的 order 值可能不连续。
    // API 应该接受任意 order 值并归一化为 0-based 连续序列。
    // 如果 API 拒绝非 0-based 的 order（返回 400），那是代码 bug。
    it('应接受任意 order 值并归一化为 0-based 连续序列', async () => {
      const profile = await seedProfile();
      const skillA = await seedSkill({ name: 'Skill A' });
      const skillB = await seedSkill({ name: 'Skill B' });

      const saveRes = await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [
            { resourceId: skillB.id, order: 10 },
            { resourceId: skillA.id, order: 20 }
          ],
          mcps: [],
          rules: []
        });
      const saveData = expectSuccess<{
        skills: { id: string; name: string; order: number }[];
      }>(saveRes);

      expect(saveData.skills).toHaveLength(2);
      expect(saveData.skills[0].id).toBe(skillB.id);
      expect(saveData.skills[0].order).toBe(0);
      expect(saveData.skills[1].id).toBe(skillA.id);
      expect(saveData.skills[1].order).toBe(1);
    });

    it('MCP configOverride 应正确合并到 resolved', async () => {
      const profile = await seedProfile();
      const mcp = await seedMcp({
        content: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@mcp/original'],
          env: { LOG_LEVEL: 'info' }
        }
      });

      const saveRes = await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [],
          mcps: [
            {
              resourceId: mcp.id,
              order: 0,
              configOverride: {
                args: ['-y', '@mcp/overridden'],
                env: { LOG_LEVEL: 'debug' }
              }
            }
          ],
          rules: []
        });
      const data = expectSuccess<{
        mcps: {
          content: { command: string; args: string[] };
          configOverride: { args: string[] };
          resolved: {
            command: string;
            args: string[];
            env: Record<string, string>;
          };
        }[];
      }>(saveRes);

      const mcpItem = data.mcps[0];
      expect(mcpItem.content.command).toBe('npx');
      expect(mcpItem.configOverride.args).toEqual(['-y', '@mcp/overridden']);
      expect(mcpItem.resolved.args).toEqual(['-y', '@mcp/overridden']);
      expect(mcpItem.resolved.env).toEqual({ LOG_LEVEL: 'debug' });
    });

    it('保存为空白 description 时应归一化为 null', async () => {
      const profile = await seedProfile({ description: 'Has description' });

      const res = await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          description: '   ',
          skills: [],
          mcps: [],
          rules: []
        });
      const data = expectSuccess<{ description: string | null }>(res);

      expect(data.description).toBeNull();
    });
  });

  describe('GET /api/profiles/:id - 获取详情', () => {
    it('应返回包含 resolved 资源的完整数据', async () => {
      const profile = await seedProfile({ name: 'Detail Profile' });
      const skill = await seedSkill();

      // Save with skill
      await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [{ resourceId: skill.id, order: 0 }],
          mcps: [],
          rules: []
        });

      const res = await api().get(`/api/profiles/${profile.id}`);
      const data = expectSuccess<{
        skills: { id: string; resolved: string }[];
      }>(res);

      expect(data.skills).toHaveLength(1);
      expect(data.skills[0].resolved).toBeDefined();
      expect(typeof data.skills[0].resolved).toBe('string');
    });
  });

  describe('GET /api/profiles/:id/render - 渲染 Profile', () => {
    it('应返回渲染后的 Profile 数据', async () => {
      const profile = await seedProfile({ name: 'Render Test' });

      const res = await api().get(`/api/profiles/${profile.id}/render`);
      const data = expectSuccess<{
        id: string;
        name: string;
        skills: unknown[];
        mcps: unknown[];
        rules: unknown[];
      }>(res);

      expect(data.id).toBe(profile.id);
      expect(data.name).toBe('Render Test');
      expect(data.skills).toEqual([]);
    });

    it('不存在的 Profile render 返回 404', async () => {
      expectError(await api().get('/api/profiles/nonexistent/render'), 404);
    });
  });

  describe('GET /api/profiles/:id/export - 导出 Profile', () => {
    it('默认导出 JSON 格式', async () => {
      const profile = await seedProfile({ name: 'Export JSON' });

      const res = await api().get(`/api/profiles/${profile.id}/export`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toContain('.json');

      const body = JSON.parse(res.text);
      expect(body.name).toBe('Export JSON');
    });

    it('导出 YAML 格式', async () => {
      const profile = await seedProfile({ name: 'Export YAML' });

      const res = await api().get(
        `/api/profiles/${profile.id}/export?format=yaml`
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/x-yaml');
      expect(res.headers['content-disposition']).toContain('.yaml');
      expect(res.text).toContain('name: Export YAML');
    });

    it('复杂 Profile 的 render / JSON export / YAML export 应保持一致', async () => {
      const profile = await seedProfile({ name: 'Export Consistency' });
      const skill = await seedSkill({
        name: 'Skill Export',
        content: '# Skill Export\n\nDo X.'
      });
      const rule = await seedRule({
        name: 'Rule Export',
        content: '## Rule Export\n\nAlways do Y.'
      });
      const mcp = await seedMcp({
        name: 'MCP Export',
        content: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@mcp/base'],
          env: { LOG_LEVEL: 'info', REGION: 'cn' }
        }
      });

      expectSuccess(
        await api()
          .put(`/api/profiles/${profile.id}`)
          .send({
            name: 'Export Consistency',
            description: 'Profile with full resources',
            skills: [{ resourceId: skill.id, order: 0 }],
            mcps: [
              {
                resourceId: mcp.id,
                order: 0,
                configOverride: {
                  args: ['-y', '@mcp/override'],
                  env: { LOG_LEVEL: 'debug', REGION: 'us' }
                }
              }
            ],
            rules: [{ resourceId: rule.id, order: 0 }]
          })
      );

      const rendered = expectSuccess<unknown>(
        await api().get(`/api/profiles/${profile.id}/render`)
      );
      const exportedJson = JSON.parse(
        (
          await api().get(`/api/profiles/${profile.id}/export?format=json`)
        ).text
      );
      const exportedYaml = load(
        (await api().get(`/api/profiles/${profile.id}/export?format=yaml`)).text
      );

      expect(exportedJson).toEqual(rendered);
      expect(exportedYaml).toEqual(rendered);
    });

    it('不存在的 Profile export 返回 404', async () => {
      expectError(await api().get('/api/profiles/nonexistent/export'), 404);
    });

    it('非法 export format 返回 400', async () => {
      const profile = await seedProfile({ name: 'Export Invalid' });

      const res = await api().get(
        `/api/profiles/${profile.id}/export?format=toml`
      );

      expectError(res, 400);
    });
  });

  describe('DELETE /api/profiles/:id - 删除 Profile', () => {
    it('应成功删除 Profile 并清理联结表', async () => {
      const profile = await seedProfile();
      const skill = await seedSkill();

      await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [{ resourceId: skill.id, order: 0 }],
          mcps: [],
          rules: []
        });

      expectSuccess(await api().delete(`/api/profiles/${profile.id}`));
      expectError(await api().get(`/api/profiles/${profile.id}`), 404);

      // Skill should still exist (only the link is deleted)
      expectSuccess(await api().get(`/api/skills/${skill.id}`));
    });
  });

  // ---- 边界 & 错误场景 ----

  describe('引用验证', () => {
    it('保存时引用不存在的 skillId 返回 404', async () => {
      const profile = await seedProfile();

      const res = await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [{ resourceId: 'nonexistent-skill', order: 0 }],
          mcps: [],
          rules: []
        });
      expectError(res, 404);
    });

    it('保存时引用不存在的 mcpId 返回 404', async () => {
      const profile = await seedProfile();

      const res = await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [],
          mcps: [{ resourceId: 'nonexistent-mcp', order: 0 }],
          rules: []
        });
      expectError(res, 404);
    });

    it('保存时引用不存在的 ruleId 返回 404', async () => {
      const profile = await seedProfile();

      const res = await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [],
          mcps: [],
          rules: [{ resourceId: 'nonexistent-rule', order: 0 }]
        });
      expectError(res, 404);
    });

    it('保存时 skills 数组包含重复 resourceId 返回 400', async () => {
      const profile = await seedProfile();
      const skill = await seedSkill();

      const res = await api()
        .put(`/api/profiles/${profile.id}`)
        .send({
          name: profile.name,
          skills: [
            { resourceId: skill.id, order: 0 },
            { resourceId: skill.id, order: 1 }
          ],
          mcps: [],
          rules: []
        });
      expectError(res, 400);
    });
  });

  describe('资源不存在', () => {
    it('GET 不存在的 Profile 返回 404', async () => {
      const error = expectError(await api().get('/api/profiles/nonexistent'), 404);
      expect(error.message).toBe('Profile not found: nonexistent');
    });

    it('PUT 不存在的 Profile 返回 404', async () => {
      const res = await api()
        .put('/api/profiles/nonexistent')
        .send({ name: 'X', skills: [], mcps: [], rules: [] });
      expectError(res, 404);
    });
  });
});
