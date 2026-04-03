# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 08-data-consistency.spec.ts >> 跨页面数据一致性 >> 新创建的 Skill 应立即在列表中可见
- Location: tests/08-data-consistency.spec.ts:21:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Fresh Skill')
Expected: visible
Error: strict mode violation: getByText('Fresh Skill') resolved to 2 elements:
    1) <button type="button" class="text-left font-medium text-foreground transition-colors hover:text-primary">Fresh Skill</button> aka getByText('Fresh Skill').first()
    2) <button type="button" class="text-left font-medium text-foreground transition-colors hover:text-primary">Fresh Skill</button> aka getByRole('button', { name: 'Fresh Skill', exact: true })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Fresh Skill')

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { cleanupTestData, apiPost, seedProject, seedMockRunner } from './helpers';
  3   | 
  4   | /**
  5   |  * 跨页面数据一致性
  6   |  *
  7   |  * 用户期望：
  8   |  * - 修改资源名称后，引用它的 Profile 中名称也要更新
  9   |  * - 删除资源后，列表不应残留旧数据
  10  |  * - 创建的资源立即在所有相关页面可见
  11  |  */
  12  | test.describe('跨页面数据一致性', () => {
  13  |   test.beforeAll(async () => {
  14  |     await cleanupTestData();
  15  |   });
  16  | 
  17  |   test.afterAll(async () => {
  18  |     await cleanupTestData();
  19  |   });
  20  | 
  21  |   test('新创建的 Skill 应立即在列表中可见', async ({ page }) => {
  22  |     await apiPost('/skills', { name: 'Fresh Skill', content: 'fresh content' });
  23  | 
  24  |     await page.goto('/skills');
> 25  |     await expect(page.getByText('Fresh Skill')).toBeVisible();
      |                                                 ^ Error: expect(locator).toBeVisible() failed
  26  |   });
  27  | 
  28  |   test('通过 API 修改 Skill 名称后，刷新页面应展示新名称', async ({ page }) => {
  29  |     const skill = await apiPost('/skills', { name: 'Old Name Skill', content: 'content' });
  30  | 
  31  |     await page.goto('/skills');
  32  |     await expect(page.getByText('Old Name Skill')).toBeVisible();
  33  | 
  34  |     // 通过 API 修改名称
  35  |     await fetch(`http://localhost:3000/api/skills/${skill.id}`, {
  36  |       method: 'PATCH',
  37  |       headers: { 'Content-Type': 'application/json' },
  38  |       body: JSON.stringify({ name: 'New Name Skill' })
  39  |     });
  40  | 
  41  |     await page.reload();
  42  |     await expect(page.getByText('New Name Skill')).toBeVisible();
  43  |     await expect(page.getByText('Old Name Skill')).not.toBeVisible();
  44  |   });
  45  | 
  46  |   test('通过 API 删除 Skill 后，刷新页面不应再显示', async ({ page }) => {
  47  |     const skill = await apiPost('/skills', { name: 'Temporary Skill', content: 'content' });
  48  | 
  49  |     await page.goto('/skills');
  50  |     await expect(page.getByText('Temporary Skill')).toBeVisible();
  51  | 
  52  |     await fetch(`http://localhost:3000/api/skills/${skill.id}`, { method: 'DELETE' });
  53  | 
  54  |     await page.reload();
  55  |     await expect(page.getByText('Temporary Skill')).not.toBeVisible();
  56  |   });
  57  | 
  58  |   test('Profile 中关联的资源名称应与资源列表一致', async ({ page }) => {
  59  |     const skill = await apiPost('/skills', { name: 'Consistent Skill', content: 'content' });
  60  |     const profile = await apiPost('/profiles', { name: 'Consistency Check' });
  61  |     await fetch(`http://localhost:3000/api/profiles/${profile.id}`, {
  62  |       method: 'PUT',
  63  |       headers: { 'Content-Type': 'application/json' },
  64  |       body: JSON.stringify({
  65  |         name: 'Consistency Check',
  66  |         skills: [{ resourceId: skill.id, order: 0 }],
  67  |         mcps: [],
  68  |         rules: []
  69  |       })
  70  |     });
  71  | 
  72  |     // Skills 列表中的名称
  73  |     await page.goto('/skills');
  74  |     await expect(page.getByText('Consistent Skill')).toBeVisible();
  75  | 
  76  |     // Profile 编辑页中的名称应一致
  77  |     await page.goto(`/profiles/${profile.id}/edit`);
  78  |     await expect(page.getByText('Consistent Skill')).toBeVisible();
  79  |   });
  80  | });
  81  | 
  82  | test.describe('多资源类型交叉验证', () => {
  83  |   test.beforeAll(async () => {
  84  |     await cleanupTestData();
  85  |   });
  86  | 
  87  |   test.afterAll(async () => {
  88  |     await cleanupTestData();
  89  |   });
  90  | 
  91  |   test('Skills/Rules/MCPs/Runners 列表页结构应一致（有搜索框和新建按钮）', async ({ page }) => {
  92  |     // Profiles 空状态只有新建按钮无搜索框，属正确行为，单独处理
  93  |     const routes = ['/skills', '/rules', '/mcps', '/agent-runners'];
  94  | 
  95  |     for (const route of routes) {
  96  |       await page.goto(route);
  97  | 
  98  |       // 每个列表页都应有搜索框
  99  |       await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
  100 | 
  101 |       // 每个列表页都应有新建按钮
  102 |       await expect(page.getByRole('button', { name: /新建/i })).toBeVisible();
  103 |     }
  104 |   });
  105 | 
  106 |   test('Profiles 列表页空状态应有新建入口', async ({ page }) => {
  107 |     await page.goto('/profiles');
  108 |     await expect(page.getByRole('button', { name: /新建/i })).toBeVisible();
  109 |   });
  110 | 
  111 |   test('所有资源编辑页应有返回按钮', async ({ page }) => {
  112 |     const skill = await apiPost('/skills', { name: 'Back Btn Skill', content: 'content' });
  113 |     const rule = await apiPost('/rules', { name: 'Back Btn Rule', content: 'content' });
  114 | 
  115 |     for (const path of [
  116 |       `/skills/${skill.id}/edit`,
  117 |       `/rules/${rule.id}/edit`
  118 |     ]) {
  119 |       await page.goto(path);
  120 |       await expect(page.getByRole('button', { name: /返回/i })).toBeVisible();
  121 |     }
  122 |   });
  123 | 
  124 |   test('编辑页返回按钮应回到列表页', async ({ page }) => {
  125 |     const skill = await apiPost('/skills', { name: 'Return Skill', content: 'content' });
```