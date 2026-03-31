# Agent Workbench

Personal agent configuration workbench for managing static Skills, MCPs, Rules, and Profiles.

## Stack

- Frontend: React, Vite, TypeScript, Ant Design, Zustand, CodeMirror, React Router
- Backend: NestJS, Prisma, SQLite, class-validator, js-yaml, Swagger
- Shared: TypeScript types and Zod schemas
- Tooling: pnpm workspace, ESLint, Prettier

## Workspace

```text
packages/
  backend/   NestJS + Prisma API
  frontend/  Vite React app
  shared/    Shared types and Zod schemas
```

## Getting Started

```bash
pnpm install
cp packages/backend/.env.example packages/backend/.env
pnpm --filter @agent-workbench/backend prisma migrate reset --force
pnpm dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

## Key Commands

```bash
pnpm build
pnpm lint
pnpm db:migrate
pnpm db:seed
```

## API Overview

### Resources

- Skill / Rule `content`: Markdown string
- MCP `content`: MCP `stdio` server config object

- `GET /api/skills?name=`
- `GET /api/skills/:id`
- `POST /api/skills`
- `PUT /api/skills/:id`
- `DELETE /api/skills/:id`

`/api/mcps` and `/api/rules` follow the same contract.

### Profiles

- `GET /api/profiles`
- `GET /api/profiles/:id`
- `POST /api/profiles`
- `PUT /api/profiles/:id`
- `DELETE /api/profiles/:id`
- `POST /api/profiles/:id/items`
- `GET /api/profiles/:id/render`
- `GET /api/profiles/:id/export?format=json|yaml`

## Notes

- All successful JSON responses use `{ data, message, code }`.
- Resource delete returns `409` with `referencedBy` when a Profile still references the resource.
- MCP `content` follows the `stdio` shape: `type`, `command`, `args`, `env`.
- Skill / Rule use Markdown editors in the frontend.
- Only MCP keeps `configOverride`; `RenderedProfile.mcps[].resolved` uses shallow merge:
  `Object.assign({}, content, configOverride ?? {})`
- `RenderedProfile.skills[].resolved` and `RenderedProfile.rules[].resolved` equal their Markdown content.
- Seed inserts 3 resources per type and 1 complete profile example.
