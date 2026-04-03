# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-first-time-user.spec.ts >> 首次使用旅程 — 新用户从零开始配置 >> 用户可以通过对话框创建第一个 Project
- Location: tests/01-first-time-user.spec.ts:31:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByText('My First Project')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('My First Project')
    6 × locator resolved to <option value="cmnifub8g0000r8efuyho9eo4">My First Project</option>
      - unexpected value "hidden"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - button "Agent Workbench" [ref=e7]:
            - paragraph [ref=e8]: Agent Workbench
          - button "收起侧栏" [ref=e9]:
            - img
        - navigation [ref=e10]:
          - button "Projects" [ref=e11]:
            - img [ref=e12]
            - text: Projects
          - button "资源库" [ref=e14]:
            - img [ref=e15]
            - text: 资源库
    - main [ref=e19]:
      - generic [ref=e20]:
        - generic [ref=e21]:
          - combobox "选择当前 Project" [ref=e22]:
            - option "My First Project" [selected]
          - generic [ref=e23]:
            - button "配置" [ref=e24]
            - button "Sessions" [ref=e25]
            - button "Dashboard" [ref=e26]
        - generic [ref=e28]:
          - generic [ref=e29]:
            - paragraph [ref=e30]: Project 配置
            - button "保存" [ref=e32]:
              - img
              - generic [ref=e33]: 保存
          - generic [ref=e34]:
            - generic [ref=e36]:
              - generic [ref=e37]:
                - generic [ref=e39]: Name
                - textbox "Name" [ref=e40]: My First Project
              - generic [ref=e41]:
                - generic [ref=e42]:
                  - generic [ref=e43]: Workspace Path
                  - paragraph [ref=e44]: 更新时同样必须是已存在的绝对目录。
                - textbox "Workspace Path" [ref=e45]: /tmp
              - generic [ref=e46]:
                - generic [ref=e47]:
                  - generic [ref=e48]: Git URL
                  - paragraph [ref=e49]: 创建后不可修改。
                - textbox "Git URL" [disabled]: git@github.com:test/first-project.git
              - generic [ref=e50]:
                - generic [ref=e52]: Description
                - textbox "Description" [ref=e53]
            - generic [ref=e55]:
              - generic [ref=e56]:
                - paragraph [ref=e57]: 删除当前 Project
                - paragraph [ref=e58]: 删除后不可恢复。当前阶段没有关联资源检查。
              - button "删除 Project" [ref=e59]
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { cleanupTestData } from './helpers';
  3   | 
  4   | /**
  5   |  * 首次使用旅程 — 新用户从零开始配置
  6   |  *
  7   |  * 正确用户体验：
  8   |  * 1. 打开应用 → 看到 Projects 页面
  9   |  * 2. 空状态时有引导创建
  10  |  * 3. 用户可以通过对话框创建 Project
  11  |  * 4. 用户可以通过编辑页创建 Skill/Rule/MCP
  12  |  * 5. 用户可以创建 Agent Runner
  13  |  */
  14  | test.describe('首次使用旅程 — 新用户从零开始配置', () => {
  15  |   test.beforeEach(async () => {
  16  |     await cleanupTestData();
  17  |   });
  18  | 
  19  |   test('打开应用应跳转到 Projects 页面并展示空状态引导', async ({ page }) => {
  20  |     page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  21  |     page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  22  |     await page.goto('/');
  23  |     await expect(page).toHaveURL(/\/projects/);
  24  | 
  25  |     // 空状态时用户应看到引导信息和创建按钮
  26  |     await expect(
  27  |       page.getByRole('button', { name: /新建 Project/i })
  28  |     ).toBeVisible();
  29  |   });
  30  | 
  31  |   test('用户可以通过对话框创建第一个 Project', async ({ page }) => {
  32  |     await page.goto('/projects');
  33  | 
  34  |     // 点击新建按钮
  35  |     await page.getByRole('button', { name: /新建 Project/i }).click();
  36  | 
  37  |     // 应出现创建对话框
  38  |     const dialog = page.getByRole('dialog');
  39  |     await expect(dialog).toBeVisible();
  40  | 
  41  |     // 填写必填字段
  42  |     await dialog
  43  |       .getByRole('textbox', { name: 'Name' })
  44  |       .fill('My First Project');
  45  |     await dialog
  46  |       .getByRole('textbox', { name: 'Git URL' })
  47  |       .fill('git@github.com:test/first-project.git');
  48  |     await dialog.getByRole('textbox', { name: 'Workspace Path' }).fill('/tmp');
  49  | 
  50  |     // 点击创建
  51  |     await dialog.getByRole('button', { name: /创建/i }).click();
  52  | 
  53  |     // 创建成功后对话框关闭，项目应出现在列表中
  54  |     await expect(dialog).not.toBeVisible({ timeout: 5000 });
> 55  |     await expect(page.getByText('My First Project')).toBeVisible({
      |                                                      ^ Error: expect(locator).toBeVisible() failed
  56  |       timeout: 5000
  57  |     });
  58  |   });
  59  | 
  60  |   test('用户可以创建 Skill 资源', async ({ page }) => {
  61  |     await page.goto('/skills');
  62  | 
  63  |     // 点击新建按钮
  64  |     await page.getByRole('button', { name: /新建 Skill/i }).click();
  65  | 
  66  |     // 应跳转到编辑页
  67  |     await expect(page).toHaveURL(/\/skills\/new/);
  68  | 
  69  |     // 填写名称
  70  |     await page.getByRole('textbox', { name: 'Name' }).fill('Code Review Skill');
  71  | 
  72  |     // Content 是 CodeMirror 编辑器，需要特殊处理
  73  |     // 用户期望：有一个可输入的内容区域
  74  |     const contentEditor = page.locator('.cm-editor, [class*="editor"]').first();
  75  |     await expect(contentEditor).toBeVisible();
  76  | 
  77  |     // 点击保存
  78  |     await page.getByRole('button', { name: /保存/i }).click();
  79  | 
  80  |     // 保存成功后应跳回列表
  81  |     await expect(page).toHaveURL(/\/skills$/, { timeout: 5000 });
  82  |     await expect(page.getByText('Code Review Skill')).toBeVisible();
  83  |   });
  84  | 
  85  |   test('用户可以创建 Rule 资源', async ({ page }) => {
  86  |     await page.goto('/rules');
  87  | 
  88  |     await page.getByRole('button', { name: /新建 Rule/i }).click();
  89  |     await expect(page).toHaveURL(/\/rules\/new/);
  90  | 
  91  |     await page
  92  |       .getByRole('textbox', { name: 'Name' })
  93  |       .fill('Always Cite Sources');
  94  | 
  95  |     await page.getByRole('button', { name: /保存/i }).click();
  96  | 
  97  |     await expect(page).toHaveURL(/\/rules$/, { timeout: 5000 });
  98  |     await expect(page.getByText('Always Cite Sources')).toBeVisible();
  99  |   });
  100 | 
  101 |   test('用户可以创建 MCP 服务器配置', async ({ page }) => {
  102 |     await page.goto('/mcps');
  103 | 
  104 |     await page.getByRole('button', { name: /新建 MCP/i }).click();
  105 |     await expect(page).toHaveURL(/\/mcps\/new/);
  106 | 
  107 |     await page.getByRole('textbox', { name: 'Name' }).fill('Web Search MCP');
  108 | 
  109 |     await page.getByRole('button', { name: /保存/i }).click();
  110 | 
  111 |     // 可能因为 content 是必填而保存失败 — 这是正确行为
  112 |     // 如果成功，应跳回列表
  113 |     // 如果失败，应有错误提示告知用户填写缺失字段
  114 |   });
  115 | 
  116 |   test('用户可以创建 Agent Runner', async ({ page }) => {
  117 |     await page.goto('/agent-runners');
  118 | 
  119 |     await page.getByRole('button', { name: /新建/i }).click();
  120 |     await expect(page).toHaveURL(/\/agent-runners\/new/);
  121 | 
  122 |     await page.getByRole('textbox', { name: 'Name' }).fill('My Mock Runner');
  123 | 
  124 |     await page.getByRole('button', { name: /保存/i }).click();
  125 | 
  126 |     // 保存成功后应跳回列表
  127 |     await expect(page).toHaveURL(/\/agent-runners$/, { timeout: 5000 });
  128 |     await expect(page.getByText('My Mock Runner')).toBeVisible();
  129 |   });
  130 | });
  131 | 
```