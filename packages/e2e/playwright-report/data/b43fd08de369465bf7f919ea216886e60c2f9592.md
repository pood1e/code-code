# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-navigation-layout.spec.ts >> 页面加载 >> 每个主要页面应在 5 秒内完成加载
- Location: tests/04-navigation-layout.spec.ts:60:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/projects
Call log:
  - navigating to "http://localhost:5173/projects", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   |
  3   | /**
  4   |  * 导航与布局 — 验证应用整体结构
  5   |  *
  6   |  * 不依赖预置数据，只验证 UI 结构和导航行为。
  7   |  * 有错误直接暴露，不做超时重试。
  8   |  */
  9   | test.describe('全局导航结构', () => {
  10  |   test('侧边栏应有 Projects 和资源库入口', async ({ page }) => {
  11  |     await page.goto('/');
  12  |
  13  |     await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
  14  |     await expect(page.getByRole('button', { name: /资源库/i })).toBeVisible();
  15  |   });
  16  |
  17  |   test('点击资源库应跳转并展开子导航', async ({ page }) => {
  18  |     await page.goto('/');
  19  |
  20  |     await page.getByRole('button', { name: /资源库/i }).click();
  21  |     await page.waitForURL(/\/(skills|mcps|rules|profiles|agent-runners)/);
  22  |
  23  |     const sidebar = page.locator('aside, [role="complementary"]').first();
  24  |     const subItems = ['Skills', 'MCPs', 'Rules', 'Profiles', 'Runners'];
  25  |     for (const item of subItems) {
  26  |       await expect(sidebar.getByRole('button', { name: item, exact: true })).toBeVisible();
  27  |     }
  28  |   });
  29  |
  30  |   test('点击资源子菜单应切到对应页面', async ({ page }) => {
  31  |     await page.goto('/skills');
  32  |
  33  |     const sidebar = page.locator('aside, [role="complementary"]').first();
  34  |
  35  |     await sidebar.getByRole('button', { name: 'Rules', exact: true }).click();
  36  |     await expect(page).toHaveURL(/\/rules/);
  37  |
  38  |     await sidebar.getByRole('button', { name: 'MCPs', exact: true }).click();
  39  |     await expect(page).toHaveURL(/\/mcps/);
  40  |
  41  |     await sidebar.getByRole('button', { name: 'Profiles', exact: true }).click();
  42  |     await expect(page).toHaveURL(/\/profiles/);
  43  |
  44  |     await sidebar.getByRole('button', { name: 'Runners', exact: true }).click();
  45  |     await expect(page).toHaveURL(/\/agent-runners/);
  46  |
  47  |     await sidebar.getByRole('button', { name: 'Skills', exact: true }).click();
  48  |     await expect(page).toHaveURL(/\/skills/);
  49  |   });
  50  |
  51  |   test('点击 Projects 应回到项目列表', async ({ page }) => {
  52  |     await page.goto('/skills');
  53  |
  54  |     await page.getByRole('button', { name: 'Projects' }).click();
  55  |     await expect(page).toHaveURL(/\/projects/);
  56  |   });
  57  | });
  58  |
  59  | test.describe('页面加载', () => {
  60  |   test('每个主要页面应在 5 秒内完成加载', async ({ page }) => {
  61  |     const routes = ['/projects', '/skills', '/rules', '/mcps', '/profiles', '/agent-runners'];
  62  |
  63  |     for (const route of routes) {
  64  |       const start = Date.now();
> 65  |       await page.goto(route);
      |                  ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/projects
  66  |       await page.waitForLoadState('networkidle');
  67  |       const elapsed = Date.now() - start;
  68  |
  69  |       expect(elapsed).toBeLessThan(5000);
  70  |
  71  |       const bodyText = await page.locator('body').textContent();
  72  |       expect(bodyText!.length).toBeGreaterThan(0);
  73  |     }
  74  |   });
  75  |
  76  |   test('默认首页应跳转到 Projects', async ({ page }) => {
  77  |     await page.goto('/');
  78  |     await expect(page).toHaveURL(/\/projects/);
  79  |   });
  80  | });
  81  |
  82  | test.describe('资源列表页通用行为', () => {
  83  |   // 先通过 API 确保有数据
  84  |   test.beforeAll(async () => {
  85  |     await fetch('http://localhost:3000/api/skills', {
  86  |       method: 'POST',
  87  |       headers: { 'Content-Type': 'application/json' },
  88  |       body: JSON.stringify({ name: 'Nav Test Skill', content: 'content for nav test' })
  89  |     });
  90  |   });
  91  |
  92  |   test('Skills 列表页应有搜索框和新建按钮', async ({ page }) => {
  93  |     await page.goto('/skills');
  94  |
  95  |     await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
  96  |     await expect(page.getByRole('button', { name: /新建 Skill/i })).toBeVisible();
  97  |   });
  98  |
  99  |   test('MCPs 列表页应有搜索框和新建按钮', async ({ page }) => {
  100 |     await page.goto('/mcps');
  101 |
  102 |     await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
  103 |     await expect(page.getByRole('button', { name: /新建 MCP/i })).toBeVisible();
  104 |   });
  105 |
  106 |   test('Rules 列表页应有搜索框和新建按钮', async ({ page }) => {
  107 |     await page.goto('/rules');
  108 |
  109 |     await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
  110 |     await expect(page.getByRole('button', { name: /新建 Rule/i })).toBeVisible();
  111 |   });
  112 |
  113 |   test('每个列表项应有编辑和删除操作', async ({ page }) => {
  114 |     await page.goto('/skills');
  115 |
  116 |     // 应有列表项（至少 Nav Test Skill）
  117 |     await expect(page.getByText('Nav Test Skill')).toBeVisible();
  118 |
  119 |     // 列表项应有编辑和删除按钮
  120 |     const editBtns = page.getByRole('button', { name: /编辑/i });
  121 |     const deleteBtns = page.getByRole('button', { name: /删除/i });
  122 |
  123 |     const editCount = await editBtns.count();
  124 |     const deleteCount = await deleteBtns.count();
  125 |
  126 |     expect(editCount).toBeGreaterThan(0);
  127 |     expect(editCount).toBe(deleteCount);
  128 |   });
  129 | });
  130 |
  131 | test.describe('删除保护', () => {
  132 |   test('点击删除按钮应出现确认对话框', async ({ page }) => {
  133 |     await page.goto('/skills');
  134 |
  135 |     // 确保有可删除的项
  136 |     await expect(page.getByRole('button', { name: /删除/i }).first()).toBeVisible();
  137 |
  138 |     // 点击第一个删除按钮
  139 |     await page.getByRole('button', { name: /删除/i }).first().click();
  140 |
  141 |     // 用户应看到确认对话框，防止误删
  142 |     const confirmDialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  143 |     await expect(confirmDialog).toBeVisible();
  144 |   });
  145 | });
  146 |
```
