# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 09-error-handling.spec.ts >> 页面健壮性 >> 刷新页面不应丢失当前路由
- Location: tests/09-error-handling.spec.ts:135:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByPlaceholder(/按名称搜索/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByPlaceholder(/按名称搜索/i)

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
        - generic [ref=e18]:
          - paragraph [ref=e19]: 资源
          - navigation [ref=e20]:
            - button "Skills" [ref=e21]:
              - img [ref=e22]
              - text: Skills
            - button "MCPs" [ref=e23]:
              - img [ref=e24]
              - text: MCPs
            - button "Rules" [ref=e30]:
              - img [ref=e31]
              - text: Rules
            - button "Profiles" [ref=e34]:
              - img [ref=e35]
              - text: Profiles
            - button "Runners" [ref=e38]:
              - img [ref=e39]
              - text: Runners
    - main [ref=e43]:
      - generic [ref=e47]:
        - generic [ref=e48]:
          - heading "暂无 Rules" [level=3] [ref=e49]
          - paragraph [ref=e50]: 还没有任何 Rule，先创建一个新的 Rule。
        - button "新建 Rule" [ref=e52]:
          - img
          - text: 新建 Rule
  - region "Notifications alt+T"
```

# Test source

```ts
  41  |     // 应有 404 提示或重定向到首页
  42  |     const body = await page.textContent('body');
  43  |     expect(body!.length).toBeGreaterThan(0);
  44  |   });
  45  | });
  46  | 
  47  | test.describe('表单验证反馈', () => {
  48  |   test.beforeAll(async () => {
  49  |     await cleanupTestData();
  50  |   });
  51  | 
  52  |   test.afterAll(async () => {
  53  |     await cleanupTestData();
  54  |   });
  55  | 
  56  |   test('Skill 创建页不填名称直接保存应有错误提示', async ({ page }) => {
  57  |     await page.goto('/skills/new');
  58  | 
  59  |     // 不填任何内容直接保存
  60  |     await page.getByRole('button', { name: /保存/i }).click();
  61  | 
  62  |     // 用户期望：表单应展示验证错误，不能静默失败
  63  |     // 页面应仍在创建页（未跳转走）
  64  |     await expect(page).toHaveURL(/\/skills\/new/);
  65  |   });
  66  | 
  67  |   test('Rule 创建页不填名称直接保存应有错误提示', async ({ page }) => {
  68  |     await page.goto('/rules/new');
  69  | 
  70  |     await page.getByRole('button', { name: /保存/i }).click();
  71  | 
  72  |     await expect(page).toHaveURL(/\/rules\/new/);
  73  |   });
  74  | 
  75  |   test('Runner 创建页不填名称直接保存应有错误提示', async ({ page }) => {
  76  |     await page.goto('/agent-runners/new');
  77  | 
  78  |     await page.getByRole('button', { name: /保存/i }).click();
  79  | 
  80  |     await expect(page).toHaveURL(/\/agent-runners\/new/);
  81  |   });
  82  | 
  83  |   test('Project 创建对话框中 Git URL 格式错误应阻止提交', async ({ page }) => {
  84  |     await page.goto('/projects');
  85  |     await page.getByRole('button', { name: /新建 Project/i }).click();
  86  | 
  87  |     const dialog = page.getByRole('dialog');
  88  |     await expect(dialog).toBeVisible();
  89  | 
  90  |     await dialog.getByRole('textbox', { name: 'Name' }).fill('Valid Name');
  91  |     await dialog.getByRole('textbox', { name: 'Git URL' }).fill('https://not-ssh-url.com');
  92  |     await dialog.getByRole('textbox', { name: 'Workspace Path' }).fill('/tmp');
  93  | 
  94  |     await dialog.getByRole('button', { name: /创建/i }).click();
  95  | 
  96  |     // 对话框应仍然打开（验证失败）
  97  |     await expect(dialog).toBeVisible();
  98  |   });
  99  | });
  100 | 
  101 | test.describe('页面健壮性', () => {
  102 |   test('侧边栏折叠/展开不应丢失内容', async ({ page }) => {
  103 |     await page.goto('/skills');
  104 | 
  105 |     // 折叠侧栏
  106 |     const collapseBtn = page.getByRole('button', { name: /收起侧栏/i });
  107 |     if (await collapseBtn.isVisible()) {
  108 |       await collapseBtn.click();
  109 | 
  110 |       // 主内容区仍应正常展示
  111 |       const main = page.locator('main');
  112 |       await expect(main).toBeVisible();
  113 | 
  114 |       // 展开侧栏
  115 |       const expandBtn = page.getByRole('button', { name: /展开|侧栏/i }).first();
  116 |       await expandBtn.click();
  117 | 
  118 |       // 导航应恢复
  119 |       await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
  120 |     }
  121 |   });
  122 | 
  123 |   test('快速连续导航不应导致页面错误', async ({ page }) => {
  124 |     // 模拟用户快速点击多个导航项
  125 |     await page.goto('/skills');
  126 |     await page.goto('/rules');
  127 |     await page.goto('/mcps');
  128 |     await page.goto('/profiles');
  129 |     await page.goto('/agent-runners');
  130 | 
  131 |     // 最终页面应正常渲染
  132 |     await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
  133 |   });
  134 | 
  135 |   test('刷新页面不应丢失当前路由', async ({ page }) => {
  136 |     await page.goto('/rules');
  137 |     await expect(page).toHaveURL(/\/rules/);
  138 | 
  139 |     await page.reload();
  140 |     await expect(page).toHaveURL(/\/rules/);
> 141 |     await expect(page.getByPlaceholder(/按名称搜索/i)).toBeVisible();
      |                                                   ^ Error: expect(locator).toBeVisible() failed
  142 |   });
  143 | });
  144 | 
```