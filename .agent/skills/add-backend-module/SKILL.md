---
name: add-backend-module
description: Create a new NestJS domain module following established patterns
---

# Add Backend Module

Create a new domain module under `packages/backend/src/modules/<module>/`.

## File Structure

```
<module>/
  <module>.module.ts
  <module>.controller.ts
  <module>.service.ts
  dto/
    create-<entity>.dto.ts
    update-<entity>.dto.ts
```

Add `<module>-mapper.ts` or split services when complexity warrants it.

## Steps

### 1. Shared types (`packages/shared/src/types/<entity>.ts`)

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
```

Export from `packages/shared/src/index.ts`.

### 2. Zod schema (`packages/shared/src/schemas/<entity>.schema.ts`)

```ts
import { z } from 'zod';

export const createEntityInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  content: z.string().min(1),
});
```

Export from `packages/shared/src/index.ts`.

### 3. Prisma model

Add to `packages/backend/prisma/schema.prisma`:

```prisma
model Entity {
  id          String   @id @default(cuid())
  name        String
  description String?
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Run: `pnpm db:migrate`

### 4. DTO

```ts
// dto/create-entity.dto.ts
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateEntityDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsNotEmpty() content!: string;
}
```

### 5. Service

```ts
@Injectable()
export class EntityService {
  constructor(private readonly prisma: PrismaService) {}
}
```

For simple resource CRUD (like Skill/MCP/Rule), use `createResourceCrudHandlers()` from `common/resource-crud.ts`.

### 6. Controller

```ts
@ApiTags('entities')
@Controller('entities')
export class EntityController {
  constructor(private readonly service: EntityService) {}
  // receive → validate → delegate → return
}
```

### 7. Module + Registration

```ts
@Module({
  controllers: [EntityController],
  providers: [EntityService],
  exports: [EntityService],
})
export class EntityModule {}
```

Add to `imports` in `packages/backend/src/app.module.ts`.

### 8. Seed data

Add sample records to `packages/backend/prisma/seed.ts`.

## Verification

```bash
pnpm build                                    # type-check all packages
pnpm dev                                      # start dev server
curl http://localhost:3000/api/entities        # test list endpoint
```

Check Swagger at http://localhost:3000/api/docs for the new endpoints.

## Checklist

- [ ] Shared types + Zod schemas defined and exported
- [ ] Prisma model added, migration run
- [ ] DTOs with class-validator decorators
- [ ] Service with business logic
- [ ] Controller with Swagger decorators
- [ ] Module registered in AppModule
- [ ] Seed data added
- [ ] Error responses: 400/404/409/500
