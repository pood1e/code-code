# Agent 配置工作台 · 执行清单 v2

## 一、项目定位与约束

- 面向个人使用的 Agent 配置工作台，第一阶段只做静态资源管理
- 前后端分离，全部 TypeScript，不做鉴权、不做版本管理、不做启用状态
- 个人项目，优先开发体验和迭代速度

---

## 二、技术栈

### 前端

| 库           | 用途                                            |
| ------------ | ----------------------------------------------- |
| React        | UI 框架                                         |
| Vite         | 构建工具                                        |
| TypeScript   | 类型系统                                        |
| Ant Design   | UI 组件 + 表单校验（不引入 React Hook Form）    |
| Zod          | 业务逻辑校验，与 Ant Design Form 解耦使用       |
| Zustand      | 全局状态，主要管 UI 状态和缓存                  |
| CodeMirror   | 替代 Monaco，轻量代码/JSON 编辑，**按需懒加载** |
| React Router | 路由                                            |

> ⚠️ 不引入 React Hook Form：Ant Design Form 有自己的校验体系，两者集成需要额外适配层，个人项目不值得。

### 后端

| 库                                  | 用途                         |
| ----------------------------------- | ---------------------------- |
| NestJS                              | 后端框架                     |
| Prisma                              | ORM                          |
| SQLite                              | 数据库（本地文件，无需部署） |
| class-validator + class-transformer | DTO 校验                     |
| js-yaml                             | YAML 导出                    |
| @nestjs/swagger                     | Swagger 文档                 |

### 工程化

| 工具              | 说明                                                             |
| ----------------- | ---------------------------------------------------------------- |
| pnpm workspace    | monorepo，packages/frontend + packages/backend + packages/shared |
| ESLint + Prettier | 共享配置放根目录                                                 |
| Husky             | **最后阶段再加**，骨架阶段跳过，避免拖慢迭代                     |
| packages/shared   | 存放前后端共用的 TS 类型和 Zod schema                            |

---

## 三、数据模型

### 设计决策

**四类资源：Skill / MCP / Rule / Profile**

Skill、MCP、Rule 结构相似，各自独立表，核心字段：

```
id          String   @id @default(cuid())
name        String
description String?
content     Json              // 存具体配置，结构由各类型自定义
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```

Profile 表：

```
id          String   @id @default(cuid())
name        String
description String?
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```

### 关联表（显式中间表，非隐式多对多）

Profile 关联资源用**显式中间表**，每张中间表含 `order` 和 `configOverride` 字段：

```prisma
model ProfileSkill {
  id             String   @id @default(cuid())
  profileId      String
  skillId        String
  order          Int                   // 保存排序，前端拖拽后写入
  configOverride Json?                 // 可选，浅合并覆盖项
  profile        Profile  @relation(fields: [profileId], references: [id])
  skill          Skill    @relation(fields: [skillId], references: [id])

  @@unique([profileId, skillId])
}
```

同理建 `ProfileMCP`、`ProfileRule`。

> ⚠️ 必须用显式中间表：Prisma 隐式多对多无法存 `order` 和 `configOverride`。

### configOverride 合并策略

统一使用**浅合并**（`Object.assign(resource.content, item.configOverride)`），在 RenderedProfile 接口文档和 README 中说明。

---

## 四、后端 API 设计

### 通用约定

- RESTful 风格，统一响应结构：

```ts
{
  data: T,
  message: string,
  code: number
}
```

- 错误码规范：

| 状态码 | 含义                     |
| ------ | ------------------------ |
| 400    | 参数校验失败             |
| 404    | 资源不存在               |
| 409    | 被引用冲突（删除前检查） |

- **409 响应体需包含引用列表**，方便前端展示提示：

```ts
{
  code: 409,
  message: "该资源被以下 Profile 引用，无法删除",
  data: {
    referencedBy: [{ id: string, name: string }]
  }
}
```

### Skill / MCP / Rule 接口（结构一致，以 Skill 为例）

```
GET    /skills              列表（支持 ?name= 模糊搜索）
GET    /skills/:id          详情
POST   /skills              创建
PUT    /skills/:id          更新
DELETE /skills/:id          删除（被引用返回 409 + referencedBy 列表）
```

### Profile 接口

```
GET    /profiles                    列表
GET    /profiles/:id                详情（含关联资源，按 order 排序）
POST   /profiles                    创建
PUT    /profiles/:id                更新基本信息
DELETE /profiles/:id                删除
POST   /profiles/:id/items          批量更新关联资源（含 order + configOverride）
GET    /profiles/:id/render         渲染 RenderedProfile（聚合 + 浅合并）
GET    /profiles/:id/export         导出（query: ?format=json|yaml）
```

---

## 五、RenderedProfile 结构

```ts
type RenderedProfile = {
  id: string;
  name: string;
  description: string | null;
  skills: ResolvedItem[];
  mcps: ResolvedItem[];
  rules: ResolvedItem[];
};

type ResolvedItem = {
  id: string;
  name: string;
  description: string | null;
  content: Record<string, unknown>; // 原始 content
  configOverride: Record<string, unknown>; // 原始覆盖项（调试用）
  resolved: Record<string, unknown>; // 浅合并后的最终结果
  order: number;
};
```

---

## 六、前端页面规划

| 页面         | 路由                       | 核心功能                                |
| ------------ | -------------------------- | --------------------------------------- |
| 资源列表     | `/skills` `/mcps` `/rules` | 表格 + 搜索 + 新建/删除                 |
| 资源编辑     | `/skills/:id/edit`         | 表单 + CodeMirror JSON 编辑器（懒加载） |
| Profile 列表 | `/profiles`                | 表格 + 新建/删除                        |
| Profile 装配 | `/profiles/:id/edit`       | 拖拽排序关联资源 + configOverride 编辑  |
| 预览导出     | `/profiles/:id/preview`    | RenderedProfile 展示 + JSON/YAML 下载   |

**删除交互要求：** 409 错误时弹窗展示"被以下 Profile 引用"列表，禁止静默失败。

---

## 七、开发阶段

### 阶段 0 · 项目骨架

- [ ] pnpm workspace 目录结构初始化
- [ ] `packages/shared`：基础 TS 类型 + Zod schema
- [ ] `packages/backend`：NestJS 初始化 + Prisma schema + `migrate dev` + seed
- [ ] `packages/frontend`：Vite + React + Router + Ant Design 初始化
- [ ] 根目录 ESLint + Prettier 共享配置
- [ ] Swagger 接入，可访问 `/api/docs`
- [ ] seed 数据：每类资源 3 条 + **1 个完整 Profile**（含 2-3 个关联资源 + configOverride 示例）

### 阶段 1 · 后端 CRUD API

- [ ] Skill / MCP / Rule 完整 CRUD（含 409 保护 + referencedBy 响应）
- [ ] Profile 基本 CRUD
- [ ] `POST /profiles/:id/items` 批量更新关联资源
- [ ] `GET /profiles/:id/render` 渲染接口（浅合并逻辑）
- [ ] `GET /profiles/:id/export` 导出接口（JSON + YAML）
- [ ] 所有接口补全 Swagger 注解（`@ApiTags` `@ApiOperation` `@ApiResponse`）

### 阶段 2 · 前端基础页面

- [ ] Layout 框架（侧边导航，Skill / MCP / Rule / Profile 四个入口）
- [ ] Skill 列表页 + 编辑页（跑通前后端联调，验证 CodeMirror 懒加载）
- [ ] 用相同模式快速复制出 MCP、Rule 页面
- [ ] 删除 409 错误的友好弹窗（展示 referencedBy Profile 列表）

### 阶段 3 · Profile 装配页

- [ ] Profile 基本信息编辑
- [ ] 关联资源多选（穿梭框或 Select 多选）
- [ ] 拖拽调整 order（推荐 `@dnd-kit/sortable`，Ant Design 内置拖拽较弱）
- [ ] 每项 `configOverride` 的 CodeMirror JSON 编辑（懒加载，可折叠）

### 阶段 4 · 预览导出页

- [ ] 调用 `/render` 接口，展示 RenderedProfile 树形结构
- [ ] CodeMirror 只读模式展示 JSON
- [ ] 下载按钮（JSON / YAML，触发 `/export?format=` 接口）

### 阶段 5 · 收尾

- [ ] 统一错误处理（前端 axios 拦截器 + 后端 `HttpExceptionFilter`）
- [ ] 加 Husky + lint-staged（pre-commit 跑 ESLint + Prettier check）
- [ ] README（本地启动步骤、目录结构说明、API 概览）
- [ ] 全流程回归测试（seed → CRUD → Profile 装配 → Render → Export）

---

## 八、目录结构

```
agent-workbench/
├── packages/
│   ├── shared/                  # 前后端共享
│   │   ├── src/
│   │   │   ├── types/           # TS 类型定义
│   │   │   └── schemas/         # Zod schema
│   │   └── package.json
│   │
│   ├── backend/                 # NestJS
│   │   ├── src/
│   │   │   ├── skill/
│   │   │   ├── mcp/
│   │   │   ├── rule/
│   │   │   ├── profile/
│   │   │   └── prisma/          # PrismaService + schema + seed
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── package.json
│   │
│   └── frontend/                # React + Vite
│       ├── src/
│       │   ├── pages/
│       │   │   ├── skills/
│       │   │   ├── mcps/
│       │   │   ├── rules/
│       │   │   └── profiles/
│       │   ├── components/      # 公共组件（JsonEditor 等）
│       │   ├── store/           # Zustand stores
│       │   └── api/             # axios 封装 + 各模块请求函数
│       └── package.json
│
├── .eslintrc.js                 # 共享 ESLint 配置
├── .prettierrc                  # 共享 Prettier 配置
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 九、关键风险提示

| 风险点                 | 说明                                        | 建议                                             |
| ---------------------- | ------------------------------------------- | ------------------------------------------------ |
| Profile items 并发写入 | 批量更新关联资源时需先删后插，注意事务      | 使用 `prisma.$transaction`                       |
| CodeMirror 懒加载时序  | 编辑页首次打开可能闪烁                      | 加 Skeleton 占位，`React.lazy` + `Suspense`      |
| YAML 序列化 Json 字段  | Prisma `Json` 类型反序列化后可能包含 `null` | 导出前做 `JSON.parse(JSON.stringify(data))` 清洗 |
| SQLite 并发写          | 本地单用户场景无碍，但要避免长事务          | seed 脚本用 `upsert` 而非 `create`，幂等执行     |
