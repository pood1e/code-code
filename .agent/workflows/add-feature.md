---
description: Add a new full-stack feature end-to-end
---

# Add Feature

Follow this order when adding a new domain entity or feature spanning all layers.

## Phase 1: Shared Contracts

1. Define TypeScript types in `packages/shared/src/types/<entity>.ts` (Summary, Detail, Input types)
2. Define Zod schemas in `packages/shared/src/schemas/<entity>.schema.ts` (if cross-layer validation needed)
3. Export from `packages/shared/src/index.ts`

> Use the `add-shared-schema` skill for reference.

## Phase 2: Backend

4. Add Prisma model to `packages/backend/prisma/schema.prisma`
   // turbo
5. Run migration:

```bash
pnpm db:migrate
```

6. Create module: DTOs → Service → Controller → Module (under `packages/backend/src/modules/<module>/`)
7. Register module in `packages/backend/src/app.module.ts`
8. Add seed data to `packages/backend/prisma/seed.ts`

> Use the `add-backend-module` skill for reference.

// turbo 9. Verify backend via Swagger:

```bash
curl -s http://localhost:3000/api/docs | head -5
```

## Phase 3: Frontend

10. Create API module in `packages/frontend/src/api/<domain>.ts`
11. Add query keys to `packages/frontend/src/query/query-keys.ts`
12. Create TanStack Query hooks
13. Create page component with loading / empty / error states
14. Add lazy-loaded route in `packages/frontend/src/App.tsx`
15. Add sidebar navigation in `packages/frontend/src/layout/AppLayout.tsx`

> Use the `add-frontend-page` skill for reference.

## Phase 4: Verify

// turbo 16. Type-check all packages:

```bash
pnpm build
```

17. Test the full flow in browser at http://localhost:5173
