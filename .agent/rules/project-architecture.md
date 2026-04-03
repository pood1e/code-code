# Project Architecture

## Overview

Agent Workbench is a personal full-stack TypeScript monorepo for managing agent configurations, runner instances, and interactive chat sessions. The application provides static resource CRUD (Skill/MCP/Rule), Profile composition, Project management, AgentRunner configuration, and real-time chat sessions with CLI-based agent runners.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, Vite, TypeScript, shadcn/ui, Tailwind CSS, React Hook Form, Zod, Zustand, TanStack Query, TanStack Table, axios, CodeMirror 6, React Router, @dnd-kit/sortable, assistant-ui |
| Backend | NestJS 11, Prisma, SQLite, class-validator, class-transformer, js-yaml, @nestjs/swagger, rxjs (SSE) |
| Shared | TypeScript types, Zod schemas, enums, constants, pure functions |
| Tooling | pnpm workspace, ESLint, Prettier |

## Directory Map

```
packages/
  frontend/src/
    api/            one HTTP module per domain (resources.ts, sessions.ts, etc.)
    components/     shadcn/ui wrappers + custom shared components
    features/       business UI grouped by domain
      sessions/     session list, creation panel, detail panel
      chat/         assistant-ui chat thread rendering + runtime adapters
    hooks/          cross-domain custom hooks (useErrorMessage, useDebouncedValue)
    layout/         AppLayout.tsx — sidebar + routing shell
    pages/          route-level page components
    query/          TanStack Query client + centralized query-keys.ts
    store/          Zustand stores (ui-store, project-store, session-runtime-store)
  backend/src/
    common/         ApiResponseInterceptor, HttpExceptionFilter, resource-crud utils
    modules/        domain modules (see Domain Modules below)
    prisma/         PrismaModule + PrismaService
  backend/prisma/
    schema.prisma   database schema
    seed.ts         seed data
    migrations/     migration history
  shared/src/
    types/          TypeScript type definitions (agent-runner.ts, session.ts, etc.)
    schemas/        Zod schemas (session.schema.ts, project.schema.ts, etc.)
    index.ts        barrel export
```

## Domain Modules

Each module lives in `packages/backend/src/modules/<name>/` following `controller → service → dto`:

| Module | Responsibility |
|--------|---------------|
| `skills` | Skill CRUD — Markdown content resources |
| `mcps` | MCP server config CRUD — JSON stdio protocol configs |
| `rules` | Rule CRUD — Markdown content resources |
| `profiles` | Profile composition — ordered Skill/MCP/Rule references with configOverride |
| `projects` | Project CRUD — gitUrl (SSH), workspacePath (validated against filesystem) |
| `agent-runners` | RunnerType registry, AgentRunner CRUD, health checking, context probing |
| `sessions` | Session lifecycle, message persistence, SSE event streaming, CLI runner orchestration |

The `sessions` module is split into: `sessions-query.service`, `sessions-command.service`, `session-runtime.service`.

Skills / MCPs / Rules share a common CRUD pattern via `common/resource-crud.ts` → `createResourceCrudHandlers()`.

## API Response Envelope

All responses are wrapped by `ApiResponseInterceptor`:

```ts
{ data: T, message: string, code: number }
```

Frontend `apiClient` unwraps `.data` automatically. Use `@SkipApiResponse()` for SSE endpoints.

## SSE Event Streaming

- `SessionEventStore` holds an in-memory `rxjs.Subject<OutputChunk>` per active session.
- `GET /sessions/:id/events?afterEventId=N` replays past events from DB, then streams live.
- Frontend uses native `EventSource` via `createSessionEventSource()`.
- Chunk kinds: `session_status | thinking_delta | message_delta | message_result | tool_use | usage | error | done`.

## CLI Runner Architecture

Runners are registered via `@RunnerType()` decorator → `RunnerTypeRegistry`.

**Config layers:**

| Layer | Name | Timing | Example |
|-------|------|--------|---------|
| L1 | `runnerConfig` | Runner registration | model, baseUrl |
| L2a | `platformSessionConfig` | Session creation (platform-owned) | cwd, skillIds, ruleIds, mcps |
| L2b | `runnerSessionConfig` | Session creation (runner-specific) | maxTurns, permissionMode |
| L3 | `input` | Each message send | prompt text |
| L4 | `runtimeConfig` | Anytime during session | model override |

**Inheritance chain:** `RunnerType interface` → `CliRunnerBase` (process management, JSONL parsing, health probes) → concrete runners (`claude-code`, `cursor-cli`, `qwen-cli`, `mock`).

**Context Materializer:** `context-materializer.ts` writes MCP/Rule/Skill files to `<cwd>/.agent-workbench/<sessionId>/` in each CLI's expected format before session creation.

## SchemaDescriptor Protocol

Backend converts Zod schemas → `SchemaDescriptor` (flat field metadata) via `zodToSchemaDescriptor()` for frontend dynamic form rendering. Fields with `contextKey` (e.g., `"models"`) fetch options from runner context API.

## Frontend State

| Concern | Tool | Location |
|---------|------|----------|
| UI state | Zustand | `store/ui-store.ts`, `store/project-store.ts` |
| Server data | TanStack Query | hooks in `features/*/hooks/` via `api/*.ts` |
| Chat streaming | Zustand | `store/session-runtime-store.ts` |
| Form state | React Hook Form + Zod | per-component |

Query keys follow: `queryKeys.{domain}.all` (invalidation root), `.list(...)`, `.detail(id)`.

## Frontend Component Hierarchy

```
pages/            route-level composition + data orchestration
features/         business UI + domain hooks + panels
  sessions/       SessionSelector, CreateSessionPanel, RunnerConfigSections, etc.
  chat/runtime/   assistant-ui thread adapter, message converters, input schema
components/       generic shared UI (shadcn wrappers, JsonEditor)
```
