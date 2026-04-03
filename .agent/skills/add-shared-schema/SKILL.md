---
name: add-shared-schema
description: Add new cross-layer types and Zod schemas to the shared package
---

# Add Shared Schema

Add cross-layer contracts to `packages/shared/`.

## Rules

- Types in `src/types/`, Zod schemas in `src/schemas/`.
- All exports re-exported from `src/index.ts`.
- No framework imports (React, NestJS, Prisma).

## Steps

### 1. Types (`src/types/<entity>.ts`)

```ts
export type EntitySummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntityDetail = EntitySummary & {
  content: string;
};

export type CreateEntityInput = {
  name: string;
  description?: string | null;
  content: string;
};

export type UpdateEntityInput = Partial<CreateEntityInput>;
```

### 2. Zod schemas (`src/schemas/<entity>.schema.ts`)

```ts
import { z } from 'zod';

export const createEntityInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  content: z.string().min(1),
});

export const updateEntityInputSchema = createEntityInputSchema.partial();
```

### 3. Barrel export (`src/index.ts`)

```ts
export * from './types/<entity>';
export * from './schemas/<entity>.schema';
```

## Naming Suffixes

| Suffix | Usage |
|--------|-------|
| `Summary` | List/table response (lightweight) |
| `Detail` | Full entity response |
| `Input` | Mutation payload |
| `Chunk` | Streaming event payload |

## Enums

Define in types file, create Zod schema with `z.nativeEnum()`:

```ts
// types/<entity>.ts
export enum EntityStatus { Active = 'active', Inactive = 'inactive' }

// schemas/<entity>.schema.ts
export const entityStatusSchema = z.nativeEnum(EntityStatus);
```

## Verification

```bash
pnpm build   # type-check shared + downstream consumers
```

## Checklist

- [ ] Types in `src/types/`
- [ ] Zod schemas in `src/schemas/` (if needed)
- [ ] All exports in `src/index.ts`
- [ ] No framework imports
- [ ] Naming follows suffix convention
