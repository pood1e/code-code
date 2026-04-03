# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 07-profile-editor.spec.ts >> Profile 编辑器 >> 修改 Profile 名称后保存应成功
- Location: tests/07-profile-editor.spec.ts:78:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Renamed Profile')
Expected: visible
Error: strict mode violation: getByText('Renamed Profile') resolved to 2 elements:
    1) <button type="button" class="text-left font-medium text-foreground transition-colors hover:text-primary">Renamed Profile</button> aka getByText('Renamed Profile').first()
    2) <button type="button" class="text-left font-medium text-foreground transition-colors hover:text-primary">Renamed Profile</button> aka getByRole('button', { name: 'Renamed Profile', exact: true })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Renamed Profile')

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { cleanupTestData, apiPost } from './helpers';
  3   | 
  4   | /**
  5   |  * Profile 编辑器完整流程
  6   |  *
  7   |  * 用户期望：
  8   |  * - Profile 编辑器可以添加/移除关联的 Skills、MCPs、Rules
  9   |  * - 保存后关联关系应持久化
  10  |  * - 编辑器应展示资源名称而非 ID
  11  |  * - 修改 Profile 名称后应在列表中更新
  12  |  */
  13  | test.describe('Profile 编辑器', () => {
  14  |   let skillId: string;
  15  |   let ruleId: string;
  16  |   let mcpId: string;
  17  |   let profileId: string;
  18  | 
  19  |   test.beforeAll(async () => {
  20  |     await cleanupTestData();
  21  | 
  22  |     const skill = await apiPost('/skills', { name: 'Editor Skill', content: 'content' });
  23  |     const rule = await apiPost('/rules', { name: 'Editor Rule', content: 'content' });
  24  |     const mcp = await apiPost('/mcps', {
  25  |       name: 'Editor MCP',
  26  |       content: { type: 'stdio', command: 'echo', args: ['test'] }
  27  |     });
  28  |     const profile = await apiPost('/profiles', { name: 'Editable Profile' });
  29  | 
  30  |     skillId = skill.id;
  31  |     ruleId = rule.id;
  32  |     mcpId = mcp.id;
  33  |     profileId = profile.id;
  34  |   });
  35  | 
  36  |   test.afterAll(async () => {
  37  |     await cleanupTestData();
  38  |   });
  39  | 
  40  |   test('Profile 编辑页应有名称输入框', async ({ page }) => {
  41  |     await page.goto(`/profiles/${profileId}/edit`);
  42  |     const nameInput = page.getByRole('textbox', { name: /name|名称/i }).first();
  43  |     await expect(nameInput).toBeVisible();
  44  |     await expect(nameInput).toHaveValue('Editable Profile');
  45  |   });
  46  | 
  47  |   test('Profile 编辑页应列出可选的 Skills、MCPs、Rules', async ({ page }) => {
  48  |     await page.goto(`/profiles/${profileId}/edit`);
  49  | 
  50  |     // 用户期望：Profile 编辑器中可以看到资源的添加入口
  51  |     // 应有 Skills/MCPs/Rules 分区或标签
  52  |     await expect(page.getByText(/Skills/i).first()).toBeVisible();
  53  |     await expect(page.getByText(/MCPs/i).first()).toBeVisible();
  54  |     await expect(page.getByText(/Rules/i).first()).toBeVisible();
  55  |   });
  56  | 
  57  |   test('通过 API 关联资源后，编辑页应展示资源名称', async ({ page }) => {
  58  |     // 通过 API 关联资源
  59  |     await fetch(`http://localhost:3000/api/profiles/${profileId}`, {
  60  |       method: 'PUT',
  61  |       headers: { 'Content-Type': 'application/json' },
  62  |       body: JSON.stringify({
  63  |         name: 'Editable Profile',
  64  |         skills: [{ resourceId: skillId, order: 0 }],
  65  |         mcps: [{ resourceId: mcpId, order: 0 }],
  66  |         rules: [{ resourceId: ruleId, order: 0 }]
  67  |       })
  68  |     });
  69  | 
  70  |     await page.goto(`/profiles/${profileId}/edit`);
  71  | 
  72  |     // 用户应看到资源名称（而非 ID）
  73  |     await expect(page.getByText('Editor Skill')).toBeVisible();
  74  |     await expect(page.getByText('Editor MCP')).toBeVisible();
  75  |     await expect(page.getByText('Editor Rule')).toBeVisible();
  76  |   });
  77  | 
  78  |   test('修改 Profile 名称后保存应成功', async ({ page }) => {
  79  |     await page.goto(`/profiles/${profileId}/edit`);
  80  | 
  81  |     const nameInput = page.getByRole('textbox', { name: /name|名称/i }).first();
  82  |     await nameInput.clear();
  83  |     await nameInput.fill('Renamed Profile');
  84  | 
  85  |     await page.getByRole('button', { name: /保存/i }).click();
  86  | 
  87  |     // 保存成功后回到列表，应看到新名称
  88  |     await page.goto('/profiles');
> 89  |     await expect(page.getByText('Renamed Profile')).toBeVisible();
      |                                                     ^ Error: expect(locator).toBeVisible() failed
  90  |   });
  91  | });
  92  | 
  93  | test.describe('Profile 导出与渲染', () => {
  94  |   let profileId: string;
  95  | 
  96  |   test.beforeAll(async () => {
  97  |     await cleanupTestData();
  98  |     const skill = await apiPost('/skills', { name: 'Export Skill', content: '# Exported skill' });
  99  |     const profile = await apiPost('/profiles', { name: 'Export Profile' });
  100 |     await fetch(`http://localhost:3000/api/profiles/${profile.id}`, {
  101 |       method: 'PUT',
  102 |       headers: { 'Content-Type': 'application/json' },
  103 |       body: JSON.stringify({
  104 |         name: 'Export Profile',
  105 |         skills: [{ resourceId: skill.id, order: 0 }],
  106 |         mcps: [],
  107 |         rules: []
  108 |       })
  109 |     });
  110 |     profileId = profile.id;
  111 |   });
  112 | 
  113 |   test.afterAll(async () => {
  114 |     await cleanupTestData();
  115 |   });
  116 | 
  117 |   test('Profile 渲染 API 应返回完整数据', async ({ page }) => {
  118 |     const response = await page.request.get(
  119 |       `http://localhost:3000/api/profiles/${profileId}/render`
  120 |     );
  121 |     expect(response.status()).toBe(200);
  122 | 
  123 |     const body = await response.json();
  124 |     expect(body.data.name).toBe('Export Profile');
  125 |     expect(body.data.skills).toHaveLength(1);
  126 |     expect(body.data.skills[0].content).toBeDefined();
  127 |   });
  128 | 
  129 |   test('Profile 导出 JSON 应包含关联资源内容', async ({ page }) => {
  130 |     const response = await page.request.get(
  131 |       `http://localhost:3000/api/profiles/${profileId}/export`
  132 |     );
  133 |     expect(response.status()).toBe(200);
  134 | 
  135 |     const body = await response.json();
  136 |     expect(body.name).toBe('Export Profile');
  137 |     expect(body.skills).toBeDefined();
  138 |   });
  139 | 
  140 |   test('Profile 导出 YAML 应为有效格式', async ({ page }) => {
  141 |     const response = await page.request.get(
  142 |       `http://localhost:3000/api/profiles/${profileId}/export?format=yaml`
  143 |     );
  144 |     expect(response.status()).toBe(200);
  145 | 
  146 |     const text = await response.text();
  147 |     // YAML 应包含 name 字段
  148 |     expect(text).toContain('name:');
  149 |     expect(text).toContain('Export Profile');
  150 |   });
  151 | });
  152 | 
```