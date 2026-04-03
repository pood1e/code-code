# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 06-agent-runners.spec.ts >> Agent Runner 管理 >> 通过 API 创建的 Runner 应在列表中展示
- Location: tests/06-agent-runners.spec.ts:40:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('UI Listed Runner')
Expected: visible
Error: strict mode violation: getByText('UI Listed Runner') resolved to 2 elements:
    1) <button type="button" class="text-left font-medium text-foreground transition-colors hover:text-primary">UI Listed Runner</button> aka getByText('UI Listed Runner').first()
    2) <button type="button" class="text-left font-medium text-foreground transition-colors hover:text-primary">UI Listed Runner</button> aka getByRole('button', { name: 'UI Listed Runner', exact: true })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('UI Listed Runner')

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { cleanupTestData, apiPost } from './helpers';
  3  | 
  4  | /**
  5  |  * Agent Runner 管理 — 创建、编辑、健康检查
  6  |  *
  7  |  * 用户期望：
  8  |  * - Runner 列表展示所有已配置的 Runner
  9  |  * - 可以创建新 Runner 并选择类型
  10 |  * - 可以编辑 Runner 配置
  11 |  * - 可以查看 Runner 健康状态
  12 |  * - 被 Session 引用的 Runner 不能删除
  13 |  */
  14 | test.describe('Agent Runner 管理', () => {
  15 |   test.beforeAll(async () => {
  16 |     await cleanupTestData();
  17 |   });
  18 | 
  19 |   test.afterAll(async () => {
  20 |     await cleanupTestData();
  21 |   });
  22 | 
  23 |   test('Runners 页面应有新建按钮', async ({ page }) => {
  24 |     await page.goto('/agent-runners');
  25 |     await expect(page.getByRole('button', { name: /新建/i })).toBeVisible();
  26 |   });
  27 | 
  28 |   test('新建 Runner 页面应有类型选择', async ({ page }) => {
  29 |     await page.goto('/agent-runners/new');
  30 | 
  31 |     // 用户期望：Runner 创建页面有 Name 输入框和类型选择
  32 |     await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible();
  33 | 
  34 |     // 应有 Runner 类型选择（下拉/选择器）
  35 |     // 类型选项应包含系统支持的 runner 类型
  36 |     const typeArea = page.getByText(/type|类型/i).first();
  37 |     await expect(typeArea).toBeVisible();
  38 |   });
  39 | 
  40 |   test('通过 API 创建的 Runner 应在列表中展示', async ({ page }) => {
  41 |     await apiPost('/agent-runners', {
  42 |       name: 'UI Listed Runner',
  43 |       type: 'mock',
  44 |       runnerConfig: {}
  45 |     });
  46 | 
  47 |     await page.goto('/agent-runners');
> 48 |     await expect(page.getByText('UI Listed Runner')).toBeVisible();
     |                                                      ^ Error: expect(locator).toBeVisible() failed
  49 |   });
  50 | 
  51 |   test('Runner 编辑页应展示已有配置', async ({ page }) => {
  52 |     const runner = await apiPost('/agent-runners', {
  53 |       name: 'Editable Runner',
  54 |       type: 'mock',
  55 |       runnerConfig: {}
  56 |     });
  57 | 
  58 |     await page.goto(`/agent-runners/${runner.id}/edit`);
  59 | 
  60 |     // 用户期望：编辑页显示已有的名称
  61 |     await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Editable Runner');
  62 |   });
  63 | 
  64 |   test('Runner 列表页应有搜索框', async ({ page }) => {
  65 |     await page.goto('/agent-runners');
  66 |     await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
  67 |   });
  68 | 
  69 |   test('Runner 应展示健康状态信息', async ({ page }) => {
  70 |     await page.goto('/agent-runners');
  71 | 
  72 |     // 用户期望：列表中每个 Runner 应有某种状态指示
  73 |     // mock runner 应显示 online 或健康状态
  74 |     const body = await page.textContent('body');
  75 |     // 至少不应是空页面
  76 |     expect(body!.length).toBeGreaterThan(50);
  77 |   });
  78 | });
  79 | 
```