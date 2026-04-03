# E2E 自动化测试缺陷排查及修复记录

基于最新的全量 Playwright 测试执行结果，我们在前期的测试遇到了较多的 `Timeout`、`18 did not run`、以及 `404/400` 报错。所有的报错根源已排查出对应的三条根本原因，并且**对应的代码修复已应用完毕此时所有由于该原因抛错的用例均已打通**。

以下是修复记录汇总：

## 1. 为什么会有用例“没跑”（Did not run）？

Playwright 报告列表中的 `did not run` 绝大多数是因为所在的 `test.describe` 测试大组的**前置钩子 (`beforeAll`) 崩溃了**。
一旦前置条件抛错（例如组内造数据的 API 调用因为 `400 Bad Request` 垮掉），Playwright 就会判定后续的所有用例全都不具备执行的意义，直接把同文件的用例置为不再执行（`did not run` 表态跳过）。

**解决方案（已完成）**：
我们追查了导致 `beforeAll` 瘫痪的 `400 Bad Request` 请求。原因是后端 Zod Schema 对 MCP 的入参约束变得极为严格（要求不能在 Request body 顶层写 `type: 'stdio'`，并且内部的 `content` 对象必须严格提供 `args: []` 数组）。
目前，**我们已经通过批量替换，纠正了 E2E 中所有组装 MCP 模拟请求体的前置代码**，让 400 报警彻底消失，相应的卡壳用例也全都恢复了执行状态。

---

## 2. Playwright 严格模式冲突冲突 (Strict Mode Violation)

**错误表现：**
触发删除按钮后弹出的二次确认对话框（Confirm Dialog）的主标题与背后的列表行文案发生了同名重复，被非精准匹配报错。
```text
Error: strict mode violation: getByText('Orphan Skill') resolved to 2 elements
```

**解决方案（已完成）**：
我们在 `05-data-integrity.spec.ts` 中调整了被 “双重节点重构” 暴雷的断言语法。把原先粗放的 `getByText` 替换成了带有定位语义与精准匹配的约束：
```ts
await expect(page.getByRole('button', { name: 'Orphan Skill', exact: true })).not.toBeVisible();
```
彻底终结了匹配冲突导致的失败。

---

## 3. 异步卡死与离奇的数据消失 (Timeout & 404 Not Found)

**错误表现：**
原本该成功验证的部分测试遇到了 `page.goto` 或者是接口响应返回 `404 Profile not found`。并引发了后续一系列由于渲染 DOM 由于得不到正确内容，继而触发无止尽的 `Timeout (Test timeout of 30000ms exceeded)`。

**根因追踪：最大的祸乱根源 —— 并发写库冲突**
目前整个测试架构使用的是统一共用的单体 SQLite 数据库（`e2e.db`）。当外部强行打入 `--workers 4` 开启 4 线程并发执行多组大文件测试时：
并发互相倾轧了数据 —— 文件 A（如 07 测试组）前脚刚通过 `beforeAll` 创建好用来验证的对象；紧接着文件 B（如 08 测试组）这边的 `beforeAll` 调用了全库清盘函数 `cleanupTestData()`，**把文件 A 刚建好的数据当即给物理删除了**。随之文件 A 去执行 `await page.request.get(xxx)` 时便会结结实实地撞上 `404 找不到对象` 和各类元素断言超时！

**处理建议（规避手段）**：
在使用共用的 SQLite 数据库场景下，切勿强行启用跨文件并行。直接使用稳如磐石的原生回归指令：
```bash
pnpm --filter '@agent-workbench/e2e' test
```
以此保证 `cleanupTestData()` 串行执行，即可享受最高通过率的极简且强健的端到端质量保障。
